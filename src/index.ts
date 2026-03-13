// fhir-engine — public API

export { createFhirEngine } from './engine.js';
export { createConsoleLogger } from './logger.js';
export { createAdapter } from './adapter-factory.js';

export type {
  FhirEngine,
  FhirEngineConfig,
  DatabaseConfig,
  SqliteDatabaseConfig,
  SqliteWasmDatabaseConfig,
  PostgresDatabaseConfig,
  PackagesConfig,
  Logger,
} from './types.js';

// Re-export key upstream types for convenience
export type { DefinitionRegistry, DefinitionProvider } from 'fhir-definition';
export type { FhirRuntimeInstance } from 'fhir-runtime';
export type { FhirPersistence, StorageAdapter } from 'fhir-persistence';
