import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { defineConfig, loadFhirConfig } from '../config.js';
import { applyEnvOverrides } from '../config.js';
import type { FhirEngineConfig } from '../types.js';

const TMP_DIR = resolve(__dirname, '__config_tmp__');

function tmpPath(name: string): string {
  return resolve(TMP_DIR, name);
}

function baseConfig(): FhirEngineConfig {
  return {
    database: { type: 'sqlite', path: ':memory:' },
    packages: { path: './fhir-packages' },
  };
}

describe('defineConfig', () => {
  it('returns the config unchanged (identity function)', () => {
    const config = baseConfig();
    const result = defineConfig(config);
    expect(result).toBe(config);
  });
});

describe('loadFhirConfig', () => {
  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('loads a JSON config file from explicit path', async () => {
    mkdirSync(TMP_DIR, { recursive: true });
    const configPath = tmpPath('fhir.config.json');
    writeFileSync(configPath, JSON.stringify({
      database: { type: 'sqlite', path: './test.db' },
      packages: { path: './pkgs' },
    }));

    const config = await loadFhirConfig(configPath);

    expect(config.database.type).toBe('sqlite');
    expect((config.database as { path: string }).path).toBe('./test.db');
    expect(config.packages.path).toBe('./pkgs');
  });

  it('throws on missing config file', async () => {
    await expect(
      loadFhirConfig('/nonexistent/path/fhir.config.json'),
    ).rejects.toThrow('config file not found');
  });

  it('throws on invalid JSON', async () => {
    mkdirSync(TMP_DIR, { recursive: true });
    const configPath = tmpPath('bad.json');
    writeFileSync(configPath, '{ invalid json }');

    await expect(
      loadFhirConfig(configPath),
    ).rejects.toThrow('failed to parse config file');
  });

  it('discovers fhir.config.json from cwd', async () => {
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(
      tmpPath('fhir.config.json'),
      JSON.stringify({
        database: { type: 'sqlite', path: ':memory:' },
        packages: { path: './discovered' },
      }),
    );

    // Temporarily change cwd
    const originalCwd = process.cwd();
    process.chdir(TMP_DIR);
    try {
      const config = await loadFhirConfig();
      expect(config.packages.path).toBe('./discovered');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('throws when no config file found in cwd', async () => {
    mkdirSync(TMP_DIR, { recursive: true });

    const originalCwd = process.cwd();
    process.chdir(TMP_DIR);
    try {
      await expect(loadFhirConfig()).rejects.toThrow('no config file found');
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe('applyEnvOverrides', () => {
  afterEach(() => {
    delete process.env.FHIR_DATABASE_TYPE;
    delete process.env.FHIR_DATABASE_URL;
    delete process.env.FHIR_PACKAGES_PATH;
    delete process.env.FHIR_LOG_LEVEL;
  });

  it('returns config unchanged when no env vars set', () => {
    const config = baseConfig();
    const result = applyEnvOverrides(config);
    expect(result).toEqual(config);
    expect(result).not.toBe(config); // should be a deep clone
  });

  it('FHIR_DATABASE_TYPE overrides database type to postgres', () => {
    process.env.FHIR_DATABASE_TYPE = 'postgres';
    const config = baseConfig();
    const result = applyEnvOverrides(config);
    expect(result.database.type).toBe('postgres');
  });

  it('FHIR_DATABASE_TYPE rejects invalid values', () => {
    process.env.FHIR_DATABASE_TYPE = 'mysql';
    expect(() => applyEnvOverrides(baseConfig())).toThrow(
      'FHIR_DATABASE_TYPE must be one of',
    );
  });

  it('FHIR_DATABASE_URL overrides sqlite path', () => {
    process.env.FHIR_DATABASE_URL = './override.db';
    const config = baseConfig();
    const result = applyEnvOverrides(config);
    expect((result.database as { path: string }).path).toBe('./override.db');
  });

  it('FHIR_DATABASE_URL overrides postgres url', () => {
    process.env.FHIR_DATABASE_URL = 'postgresql://override';
    const config: FhirEngineConfig = {
      database: { type: 'postgres', url: 'postgresql://original' },
      packages: { path: './pkgs' },
    };
    const result = applyEnvOverrides(config);
    expect((result.database as { url: string }).url).toBe('postgresql://override');
  });

  it('FHIR_PACKAGES_PATH overrides packages path', () => {
    process.env.FHIR_PACKAGES_PATH = '/override/pkgs';
    const config = baseConfig();
    const result = applyEnvOverrides(config);
    expect(result.packages.path).toBe('/override/pkgs');
  });

  it('multiple env overrides work together', () => {
    process.env.FHIR_DATABASE_TYPE = 'postgres';
    process.env.FHIR_DATABASE_URL = 'postgresql://combined';
    process.env.FHIR_PACKAGES_PATH = '/combined/pkgs';

    const config = baseConfig();
    const result = applyEnvOverrides(config);

    expect(result.database.type).toBe('postgres');
    expect((result.database as { url: string }).url).toBe('postgresql://combined');
    expect(result.packages.path).toBe('/combined/pkgs');
  });
});
