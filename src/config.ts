import { existsSync, readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FhirEngineConfig, DatabaseConfig } from './types.js';

// ---------------------------------------------------------------------------
// defineConfig — typed identity helper for fhir.config.ts / .js
// ---------------------------------------------------------------------------

/**
 * Type-safe config helper for `fhir.config.ts` / `fhir.config.js`.
 *
 * @example
 * ```ts
 * // fhir.config.ts
 * import { defineConfig } from 'fhir-engine';
 *
 * export default defineConfig({
 *   database: { type: 'sqlite', path: './fhir.db' },
 *   packages: { path: './fhir-packages' },
 * });
 * ```
 */
export function defineConfig(config: FhirEngineConfig): FhirEngineConfig {
  return config;
}

// ---------------------------------------------------------------------------
// Config file discovery order
// ---------------------------------------------------------------------------

const CONFIG_FILENAMES = [
  'fhir.config.ts',
  'fhir.config.js',
  'fhir.config.mjs',
  'fhir.config.json',
] as const;

// ---------------------------------------------------------------------------
// loadFhirConfig — auto-discover and load config
// ---------------------------------------------------------------------------

/**
 * Load engine configuration from a file.
 *
 * If `configPath` is provided, loads that exact file.
 * Otherwise, searches the current working directory for config files
 * in this order: `fhir.config.ts` → `fhir.config.js` → `fhir.config.mjs` → `fhir.config.json`.
 *
 * Environment variable overrides are applied on top of the loaded config.
 *
 * @param configPath - Explicit path to a config file (optional).
 * @returns The resolved `FhirEngineConfig`.
 */
export async function loadFhirConfig(configPath?: string): Promise<FhirEngineConfig> {
  let resolvedPath: string;

  if (configPath) {
    resolvedPath = resolve(configPath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`fhir-engine: config file not found: ${resolvedPath}`);
    }
  } else {
    const cwd = process.cwd();
    const found = CONFIG_FILENAMES
      .map((name) => resolve(cwd, name))
      .find((p) => existsSync(p));
    if (!found) {
      throw new Error(
        `fhir-engine: no config file found in ${cwd}. ` +
        `Expected one of: ${CONFIG_FILENAMES.join(', ')}`,
      );
    }
    resolvedPath = found;
  }

  const config = await loadConfigFile(resolvedPath);
  return applyEnvOverrides(config);
}

// ---------------------------------------------------------------------------
// File loaders
// ---------------------------------------------------------------------------

async function loadConfigFile(filePath: string): Promise<FhirEngineConfig> {
  const ext = extname(filePath);

  if (ext === '.json') {
    return loadJsonConfig(filePath);
  }

  if (ext === '.ts' || ext === '.js' || ext === '.mjs') {
    return loadModuleConfig(filePath);
  }

  throw new Error(`fhir-engine: unsupported config file extension: ${ext}`);
}

function loadJsonConfig(filePath: string): FhirEngineConfig {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as FhirEngineConfig;
  } catch (err) {
    throw new Error(
      `fhir-engine: failed to parse config file ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}

async function loadModuleConfig(filePath: string): Promise<FhirEngineConfig> {
  try {
    const fileUrl = pathToFileURL(filePath).href;
    const mod = await import(fileUrl);
    const config = mod.default ?? mod;

    if (!config || typeof config !== 'object') {
      throw new Error('config file must export a FhirEngineConfig object as default export');
    }

    return config as FhirEngineConfig;
  } catch (err) {
    if (err instanceof Error && err.message.includes('must export')) {
      throw err;
    }
    throw new Error(
      `fhir-engine: failed to load config file ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}

// ---------------------------------------------------------------------------
// Environment variable overrides
// ---------------------------------------------------------------------------

const VALID_DB_TYPES = ['sqlite', 'sqlite-wasm', 'postgres'] as const;

/**
 * Apply environment variable overrides on top of a loaded config.
 *
 * | Env Variable        | Overrides                        |
 * |---------------------|----------------------------------|
 * | FHIR_DATABASE_TYPE  | config.database.type             |
 * | FHIR_DATABASE_URL   | config.database.path / .url      |
 * | FHIR_PACKAGES_PATH  | config.packages.path             |
 * | FHIR_LOG_LEVEL      | (stored for logger filtering)    |
 */
export function applyEnvOverrides(config: FhirEngineConfig): FhirEngineConfig {
  const result = structuredClone(config);

  const dbType = process.env.FHIR_DATABASE_TYPE;
  const dbUrl = process.env.FHIR_DATABASE_URL;
  const pkgPath = process.env.FHIR_PACKAGES_PATH;

  if (dbType) {
    if (!VALID_DB_TYPES.includes(dbType as typeof VALID_DB_TYPES[number])) {
      throw new Error(
        `fhir-engine: FHIR_DATABASE_TYPE must be one of: ${VALID_DB_TYPES.join(', ')}. Got: "${dbType}"`,
      );
    }
    // Rebuild database config with overridden type
    const validType = dbType as DatabaseConfig['type'];
    if (validType === 'postgres') {
      result.database = { type: 'postgres', url: (result.database as { url?: string }).url ?? '' };
    } else if (validType === 'sqlite-wasm') {
      result.database = { type: 'sqlite-wasm', path: (result.database as { path?: string }).path ?? '' };
    } else {
      result.database = { type: 'sqlite', path: (result.database as { path?: string }).path ?? '' };
    }
  }

  if (dbUrl) {
    const type = result.database?.type;
    if (type === 'postgres') {
      result.database = { ...result.database, type: 'postgres', url: dbUrl };
    } else if (type === 'sqlite-wasm') {
      result.database = { ...result.database, type: 'sqlite-wasm', path: dbUrl };
    } else {
      result.database = { ...result.database, type: 'sqlite', path: dbUrl };
    }
  }

  if (pkgPath) {
    result.packages = { ...result.packages, path: pkgPath };
  }

  return result;
}
