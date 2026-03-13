import { BetterSqlite3Adapter, SQLiteAdapter } from 'fhir-persistence';
import type { StorageAdapter } from 'fhir-persistence';
import type { DatabaseConfig, Logger } from './types.js';

/**
 * Create a StorageAdapter from the database configuration.
 *
 * Supported adapters:
 * - `sqlite`      → BetterSqlite3Adapter (native, Node.js / Electron)
 * - `sqlite-wasm` → SQLiteAdapter (sql.js WASM, browser / cross-platform)
 * - `postgres`    → not yet available (PostgresAdapter not exported from fhir-persistence)
 */
export function createAdapter(config: DatabaseConfig, logger: Logger): StorageAdapter {
  switch (config.type) {
    case 'sqlite': {
      logger.info(`Creating BetterSqlite3Adapter (path: ${config.path})`);
      return new BetterSqlite3Adapter({
        path: config.path,
        wal: config.wal ?? true,
        busyTimeout: config.busyTimeout ?? 5000,
      });
    }

    case 'sqlite-wasm': {
      logger.info(`Creating SQLiteAdapter (WASM, path: ${config.path})`);
      return new SQLiteAdapter(config.path);
    }

    case 'postgres': {
      throw new Error(
        'fhir-engine: PostgreSQL adapter is not yet available. ' +
        'PostgresAdapter is not exported from fhir-persistence v0.1.0. ' +
        'Use database.type = "sqlite" for now.',
      );
    }

    default: {
      const _exhaustive: never = config;
      throw new Error(`fhir-engine: unknown database type: ${(_exhaustive as DatabaseConfig).type}`);
    }
  }
}
