import type { DefinitionRegistry } from 'fhir-definition';
import type { FhirRuntimeInstance } from 'fhir-runtime';
import type {
  FhirPersistence,
  FhirSystemReady,
  SearchParameterRegistry,
  StorageAdapter,
  StructureDefinitionRegistry,
} from 'fhir-persistence';

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// ---------------------------------------------------------------------------
// Database config
// ---------------------------------------------------------------------------

export interface SqliteDatabaseConfig {
  type: 'sqlite';
  /** File path or ':memory:' for in-memory database. */
  path: string;
  /** Enable WAL journal mode (default: true). */
  wal?: boolean;
  /** Busy timeout in milliseconds (default: 5000). */
  busyTimeout?: number;
}

export interface SqliteWasmDatabaseConfig {
  type: 'sqlite-wasm';
  /** File path or ':memory:'. */
  path: string;
}

export interface PostgresDatabaseConfig {
  type: 'postgres';
  /** PostgreSQL connection string. */
  url: string;
}

export type DatabaseConfig =
  | SqliteDatabaseConfig
  | SqliteWasmDatabaseConfig
  | PostgresDatabaseConfig;

// ---------------------------------------------------------------------------
// Packages config
// ---------------------------------------------------------------------------

export interface PackagesConfig {
  /** Local directory containing FHIR packages (NPM tarballs or extracted). */
  path: string;
}

// ---------------------------------------------------------------------------
// Engine config
// ---------------------------------------------------------------------------

export interface FhirEngineConfig {
  /** Database configuration. */
  database: DatabaseConfig;
  /** FHIR package loading configuration. */
  packages: PackagesConfig;
  /** IG migration label (default: package.json name or 'fhir-engine.default'). */
  packageName?: string;
  /** IG migration version (default: package.json version or '1.0.0'). */
  packageVersion?: string;
  /** Logger instance (default: console-based logger). */
  logger?: Logger;
}

// ---------------------------------------------------------------------------
// Engine result
// ---------------------------------------------------------------------------

export interface FhirEngine {
  /** The loaded DefinitionRegistry from fhir-definition. */
  readonly definitions: DefinitionRegistry;
  /** The FhirRuntimeInstance from fhir-runtime. */
  readonly runtime: FhirRuntimeInstance;
  /** The StorageAdapter from fhir-persistence. */
  readonly adapter: StorageAdapter;
  /** The FhirPersistence facade (CRUD + Search + Indexing). */
  readonly persistence: FhirPersistence;
  /** StructureDefinition registry (populated from IG). */
  readonly sdRegistry: StructureDefinitionRegistry;
  /** SearchParameter registry (populated from IG). */
  readonly spRegistry: SearchParameterRegistry;
  /** IG initialization result. */
  readonly igResult: FhirSystemReady['igResult'];
  /** Resource types with database tables. */
  readonly resourceTypes: string[];
  /** Logger in use. */
  readonly logger: Logger;
  /** Gracefully shut down the engine (closes adapter). */
  stop(): Promise<void>;
}
