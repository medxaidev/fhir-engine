import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync, lstatSync } from 'node:fs';
import { resolvePackages } from '../package-resolver.js';
import type { FhirEngineConfig, Logger } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TMP_ROOT = resolve(__dirname, '__tmp_resolve__');
const silent: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

function tmpDir(name: string): string {
  const dir = join(TMP_ROOT, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function baseConfig(packagesPath: string, overrides?: Partial<FhirEngineConfig>): FhirEngineConfig {
  return {
    database: { type: 'sqlite', path: ':memory:' },
    packages: { path: packagesPath },
    logger: silent,
    ...overrides,
  };
}

/**
 * Create a fake local package directory with a package.json.
 */
function createLocalPackage(packagesPath: string, name: string, version: string): string {
  const pkgDir = join(packagesPath, name);
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name, version }));
  return pkgDir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolvePackages', () => {
  beforeEach(() => {
    mkdirSync(TMP_ROOT, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(TMP_ROOT, { recursive: true, force: true });
    } catch {
      // Windows may hold locks briefly
    }
  });

  // ── Test 1: Package already in local packages.path → source: 'local' ──

  it('returns source "local" when package already exists in packages.path', async () => {
    const pkgPath = tmpDir('test1-packages');
    createLocalPackage(pkgPath, 'hl7.fhir.r4.core', '4.0.1');

    const config = baseConfig(pkgPath, {
      igs: [{ name: 'hl7.fhir.r4.core', version: '4.0.1' }],
    });

    const result = await resolvePackages(config, { logger: silent });

    expect(result.success).toBe(true);
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].name).toBe('hl7.fhir.r4.core');
    expect(result.packages[0].source).toBe('local');
    expect(result.packages[0].version).toBe('4.0.1');
    expect(result.errors).toHaveLength(0);
  });

  // ── Test 2: Package in system cache → source: 'cache' ──

  it('returns source "cache" when package is in system cache but not local', async () => {
    const pkgPath = tmpDir('test2-packages');
    const config = baseConfig(pkgPath, {
      igs: [{ name: 'hl7.fhir.r4.core', version: '4.0.1' }],
    });

    // hl7.fhir.r4.core@4.0.1 is typically in system cache if previously used
    // We rely on it existing at ~/.fhir/packages from prior test runs
    const { PackageCache } = await import('fhir-definition');
    const cache = new PackageCache();
    const cachePath = cache.getPath('hl7.fhir.r4.core', '4.0.1');

    if (!cachePath) {
      // Skip if not in cache — can't test without network or pre-cached data
      console.log('SKIP: hl7.fhir.r4.core@4.0.1 not in system cache');
      return;
    }

    const result = await resolvePackages(config, { logger: silent });

    expect(result.success).toBe(true);
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].name).toBe('hl7.fhir.r4.core');
    expect(result.packages[0].source).toBe('cache');
    expect(result.packages[0].version).toBe('4.0.1');
    // Verify symlink was created
    const linkPath = join(pkgPath, 'hl7.fhir.r4.core');
    expect(existsSync(linkPath)).toBe(true);
  });

  // ── Test 3: Download disabled + not in cache → error ──

  it('returns error when package not in cache and allowDownload is false', async () => {
    const pkgPath = tmpDir('test3-packages');
    const config = baseConfig(pkgPath, {
      igs: [{ name: 'some.nonexistent.package', version: '1.0.0' }],
      packageResolve: { allowDownload: false },
    });

    const result = await resolvePackages(config, { logger: silent });

    expect(result.success).toBe(false);
    expect(result.packages).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].name).toBe('some.nonexistent.package');
    expect(result.errors[0].error).toContain('disabled');
  });

  // ── Test 4: Version "latest" with allowDownload=false → error ──

  it('returns error when version is "latest" and allowDownload is false', async () => {
    const pkgPath = tmpDir('test4-packages');
    const config = baseConfig(pkgPath, {
      igs: [{ name: 'some.package' }], // no version = "latest"
      packageResolve: { allowDownload: false },
    });

    const result = await resolvePackages(config, { logger: silent });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].name).toBe('some.package');
    expect(result.errors[0].error).toContain('latest');
  });

  // ── Test 5: Empty igs or no igs → returns empty results ──

  it('returns empty results when igs is empty', async () => {
    const pkgPath = tmpDir('test5-packages');
    const config = baseConfig(pkgPath, { igs: [] });

    const result = await resolvePackages(config, { logger: silent });

    expect(result.success).toBe(true);
    expect(result.packages).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('returns empty results when igs is undefined', async () => {
    const pkgPath = tmpDir('test6-packages');
    const config = baseConfig(pkgPath);

    const result = await resolvePackages(config, { logger: silent });

    expect(result.success).toBe(true);
    expect(result.packages).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  // ── Test 6: Link already exists → idempotent, no error ──

  it('is idempotent when symlink already exists', async () => {
    const pkgPath = tmpDir('test7-packages');
    const config = baseConfig(pkgPath, {
      igs: [{ name: 'hl7.fhir.r4.core', version: '4.0.1' }],
    });

    const { PackageCache } = await import('fhir-definition');
    const cache = new PackageCache();
    const cachePath = cache.getPath('hl7.fhir.r4.core', '4.0.1');

    if (!cachePath) {
      console.log('SKIP: hl7.fhir.r4.core@4.0.1 not in system cache');
      return;
    }

    // Resolve twice — second call should be idempotent
    const result1 = await resolvePackages(config, { logger: silent });
    expect(result1.success).toBe(true);

    const result2 = await resolvePackages(config, { logger: silent });
    expect(result2.success).toBe(true);
    // Second call finds existing link → local
    expect(result2.packages[0].source).toBe('local');
  });

  // ── Test 7: options.packages overrides config.igs ──

  it('options.packages overrides config.igs', async () => {
    const pkgPath = tmpDir('test8-packages');
    createLocalPackage(pkgPath, 'custom.ig', '1.0.0');

    const config = baseConfig(pkgPath, {
      igs: [{ name: 'hl7.fhir.r4.core', version: '4.0.1' }],
    });

    const result = await resolvePackages(config, {
      packages: [{ name: 'custom.ig', version: '1.0.0' }],
      logger: silent,
    });

    expect(result.success).toBe(true);
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].name).toBe('custom.ig');
  });

  // ── Test 8: options.allowDownload overrides config.packageResolve ──

  it('options.allowDownload overrides config.packageResolve.allowDownload', async () => {
    const pkgPath = tmpDir('test9-packages');
    const config = baseConfig(pkgPath, {
      igs: [{ name: 'nonexistent.package', version: '1.0.0' }],
      packageResolve: { allowDownload: true }, // config says true
    });

    // But options says false → should NOT download
    const result = await resolvePackages(config, {
      allowDownload: false,
      logger: silent,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('disabled');
  });

  // ── Test 9: ensureDirSync creates packagesPath if missing ──

  it('creates packagesPath directory if it does not exist', async () => {
    const pkgPath = join(TMP_ROOT, 'test10-nonexistent-dir', 'sub');
    const config = baseConfig(pkgPath, { igs: [] });

    const result = await resolvePackages(config, { logger: silent });

    expect(result.success).toBe(true);
    expect(existsSync(pkgPath)).toBe(true);
  });

  // ── Test 10: resolvePackages is re-exported from index ──

  it('resolvePackages is re-exported from fhir-engine index', async () => {
    const index = await import('../index.js');
    expect(typeof index.resolvePackages).toBe('function');
  });
});
