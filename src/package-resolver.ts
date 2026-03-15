import { resolve, join } from 'node:path';
import { existsSync, mkdirSync, symlinkSync, readFileSync, lstatSync, copyFileSync } from 'node:fs';
import { PackageCache, PackageRegistryClient } from 'fhir-definition';

import type { FhirEngineConfig, ResolvePackagesOptions, ResolvedPackage, ResolvePackagesResult, Logger } from './types.js';

/**
 * Ensure the given directory exists (recursive mkdir).
 */
function ensureDirSync(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Check if a directory contains a FHIR package manifest.
 * Checks both root/package.json and package/package.json
 * (cached packages store content in a 'package' subdirectory).
 */
function hasManifest(dir: string): boolean {
  return existsSync(join(dir, 'package.json')) || existsSync(join(dir, 'package', 'package.json'));
}

/**
 * Read the version from a package.json file.
 * Checks both root and package/ subdirectory.
 * Returns the version string or 'local' if not found.
 */
function readLocalVersion(pkgDir: string): string {
  for (const candidate of [join(pkgDir, 'package.json'), join(pkgDir, 'package', 'package.json')]) {
    try {
      const raw = readFileSync(candidate, 'utf-8');
      const manifest = JSON.parse(raw);
      return manifest.version ?? 'local';
    } catch {
      // try next candidate
    }
  }
  return 'local';
}

/**
 * Resolve FHIR packages into a project's packages directory.
 *
 * Resolution order for each package:
 * 1. Already exists in packagesPath → use as-is (source: 'local')
 * 2. Found in system cache (~/.fhir/packages) → create symlink/junction (source: 'cache')
 * 3. Download from FHIR Package Registry → cache → create symlink (source: 'download')
 *
 * @param config  Engine configuration (uses config.igs and config.packages.path)
 * @param options Override packages list, target path, download policy, or logger
 * @returns       Result with resolved packages and any errors
 *
 * @example
 * ```ts
 * const result = await resolvePackages(config);
 * if (!result.success) {
 *   console.warn('Some packages failed:', result.errors);
 * }
 * ```
 */
export async function resolvePackages(
  config: FhirEngineConfig,
  options?: ResolvePackagesOptions,
): Promise<ResolvePackagesResult> {
  const packagesPath = resolve(options?.packagesPath ?? config.packages.path);
  const igs = options?.packages ?? config.igs ?? [];
  const allowDownload = options?.allowDownload ?? config.packageResolve?.allowDownload ?? true;
  const logger: Logger | undefined = options?.logger ?? config.logger;

  const cache = new PackageCache();
  const client = new PackageRegistryClient();
  const results: ResolvedPackage[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  ensureDirSync(packagesPath);

  for (const ig of igs) {
    try {
      // 1. Already exists locally?
      const localPath = join(packagesPath, ig.name);
      if (hasManifest(localPath)) {
        const localVersion = readLocalVersion(localPath);
        logger?.debug(`Package ${ig.name} already exists locally at ${localPath}`);
        results.push({ name: ig.name, version: localVersion, path: localPath, source: 'local' });
        continue;
      }

      // 2. Resolve version
      let version = ig.version ?? 'latest';
      if (version === 'latest') {
        if (!allowDownload) {
          errors.push({
            name: ig.name,
            error: `Cannot resolve "latest" version for ${ig.name} without network access`,
          });
          continue;
        }
        logger?.info(`Resolving latest version for ${ig.name}...`);
        version = await client.getLatestVersion(ig.name);
        logger?.info(`Latest version for ${ig.name}: ${version}`);
      }

      // 3. Check system cache
      const cachePath = cache.getPath(ig.name, version);
      if (cachePath) {
        // Cache hit — create symlink
        logger?.info(`Found ${ig.name}@${version} in system cache, linking...`);
        ensureCacheRootManifest(cachePath);
        createLink(cachePath, localPath);
        results.push({ name: ig.name, version, path: localPath, source: 'cache' });
        continue;
      }

      // 4. Download
      if (!allowDownload) {
        errors.push({
          name: ig.name,
          error: `Package ${ig.name}@${version} not found in cache, and downloads are disabled`,
        });
        continue;
      }

      logger?.info(`Downloading ${ig.name}@${version} from registry...`);
      const tarball = await client.download(ig.name, version);
      cache.put(ig.name, version, tarball);
      logger?.info(`Downloaded and cached ${ig.name}@${version}`);

      // Create symlink from cache to project packages dir
      const newCachePath = cache.getPath(ig.name, version);
      if (!newCachePath) {
        errors.push({ name: ig.name, error: `Failed to locate cached package after download` });
        continue;
      }
      ensureCacheRootManifest(newCachePath);
      createLink(newCachePath, localPath);
      results.push({ name: ig.name, version, path: localPath, source: 'download' });
    } catch (err) {
      errors.push({
        name: ig.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    success: errors.length === 0,
    packages: results,
    errors,
  };
}

/**
 * Ensure the cache root directory has a package.json manifest.
 * Some tools (e.g. Firely Terminal) only place package.json inside the
 * package/ subdirectory. Without a root manifest, PackageScanner discovers
 * the package at the wrong depth, causing PackageLoader to construct a
 * double-nested "package/package" path that doesn't exist (→ 0 resources).
 */
function ensureCacheRootManifest(cachePath: string): void {
  const rootManifest = join(cachePath, 'package.json');
  const nestedManifest = join(cachePath, 'package', 'package.json');
  if (!existsSync(rootManifest) && existsSync(nestedManifest)) {
    copyFileSync(nestedManifest, rootManifest);
  }
}

/**
 * Create a directory junction (Windows) or symlink (Unix) from target to linkPath.
 * Idempotent — if link already exists, does nothing.
 */
function createLink(target: string, linkPath: string): void {
  if (existsSync(linkPath)) {
    // Already exists (either real dir or symlink) — skip
    try {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink() || stat.isDirectory()) {
        return;
      }
    } catch {
      // If stat fails, try to create anyway
    }
  }
  // Use 'junction' on Windows (no admin needed), 'dir' on Unix
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  symlinkSync(target, linkPath, linkType);
}
