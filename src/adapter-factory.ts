import { BetterSqlite3Adapter, PostgresAdapter } from 'fhir-persistence';
import type { StorageAdapter } from 'fhir-persistence';
import type { DatabaseConfig, Logger } from './types.js';

/**
 * Create a StorageAdapter from the database configuration.
 *
 * Supported adapters:
 * - `sqlite`      → BetterSqlite3Adapter (native, Node.js / Electron)
 * - `sqlite-wasm` → removed in fhir-persistence v0.3.0; use `sqlite` instead
 * - `postgres`    → PostgresAdapter (pg connection pool)
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
      throw new Error(
        'fhir-engine: sqlite-wasm adapter was removed in fhir-persistence v0.3.0. ' +
        'Use database.type = "sqlite" (BetterSqlite3Adapter) instead.',
      );
    }

    case 'postgres': {
      logger.info(`Creating PostgresAdapter (url: ${config.url.replace(/\/\/.*@/, '//*****@')})`);
      // Lazy-import pg to avoid hard dependency when using SQLite only
      let Pool: any;
      try {
        Pool = require('pg').Pool;
      } catch {
        throw new Error(
          'fhir-engine: PostgreSQL requires the "pg" package. Install it with: npm install pg',
        );
      }
      const pool = new Pool({
        connectionString: config.url,
        max: config.max ?? 10,
        idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
        connectionTimeoutMillis: config.connectionTimeoutMillis ?? 0,
      });
      return new PostgresAdapter(pool);
    }

    default: {
      const _exhaustive: never = config;
      throw new Error(`fhir-engine: unknown database type: ${(_exhaustive as DatabaseConfig).type}`);
    }
  }
}
