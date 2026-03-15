import type { DefinitionRegistry } from 'fhir-definition';
import type { FhirRuntimeInstance } from 'fhir-runtime';
import type {
  FhirPersistence,
  FhirSystemReady,
  SearchParameterRegistry,
  SearchResult,
  SearchOptions,
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
  /** PostgreSQL connection string (e.g. 'postgresql://user:pass@localhost:5432/fhir_db'). */
  url: string;
  /** Maximum number of clients in the pool (default: 10). */
  max?: number;
  /** Idle timeout in milliseconds before a client is closed (default: 30000). */
  idleTimeoutMillis?: number;
  /** Connection timeout in milliseconds (default: 0 = no timeout). */
  connectionTimeoutMillis?: number;
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
  /** IG list to resolve before loading (downloaded/linked into packages.path). */
  igs?: Array<{ name: string; version?: string }>;
  /** Package resolution options. */
  packageResolve?: { allowDownload?: boolean };
  /** IG migration label (default: package.json name or 'fhir-engine.default'). */
  packageName?: string;
  /** IG migration version (default: package.json version or '1.0.0'). */
  packageVersion?: string;
  /** Logger instance (default: console-based logger). */
  logger?: Logger;
  /** Plugins to register (executed in registration order). */
  plugins?: FhirEnginePlugin[];
}

// ---------------------------------------------------------------------------
// Package resolution
// ---------------------------------------------------------------------------

export interface ResolvePackagesOptions {
  /** Packages to resolve. Defaults to config.igs. */
  packages?: Array<{ name: string; version?: string }>;
  /** Target directory for resolved packages. Defaults to config.packages.path. */
  packagesPath?: string;
  /** Allow network downloads. Default: true. */
  allowDownload?: boolean;
  /** Logger instance. */
  logger?: Logger;
}

export interface ResolvedPackage {
  /** Package name (e.g. 'hl7.fhir.r4.core'). */
  name: string;
  /** Resolved version. */
  version: string;
  /** Path in the project packages directory. */
  path: string;
  /** How the package was resolved. */
  source: 'cache' | 'download' | 'local';
}

export interface ResolvePackagesResult {
  /** True if all packages resolved without errors. */
  success: boolean;
  /** Successfully resolved packages. */
  packages: ResolvedPackage[];
  /** Packages that failed to resolve. */
  errors: Array<{ name: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Plugin system
// ---------------------------------------------------------------------------

export interface FhirEnginePlugin {
  /** Unique plugin name (used in logs and error messages). */
  name: string;
  /** Called before FhirSystem.initialize(). ctx.persistence is undefined. */
  init?(ctx: EngineContext): Promise<void>;
  /** Called after FhirSystem.initialize(). ctx.persistence is available. */
  start?(ctx: EngineContext): Promise<void>;
  /** Called after all plugins have started. System is fully operational. */
  ready?(ctx: EngineContext): Promise<void>;
  /** Called on shutdown, in reverse registration order. */
  stop?(ctx: EngineContext): Promise<void>;
}

export interface EngineContext {
  /** The resolved engine configuration. */
  readonly config: FhirEngineConfig;
  /** DefinitionRegistry from fhir-definition (always available). */
  readonly definitions: DefinitionRegistry;
  /** FhirRuntimeInstance from fhir-runtime (always available). */
  readonly runtime: FhirRuntimeInstance;
  /** StorageAdapter from fhir-persistence (always available). */
  readonly adapter: StorageAdapter;
  /** FhirPersistence facade — undefined during init(), available from start() onward. */
  readonly persistence: FhirPersistence | undefined;
  /** Logger instance. */
  readonly logger: Logger;
}

// ---------------------------------------------------------------------------
// Engine status
// ---------------------------------------------------------------------------

export interface FhirEngineStatus {
  /** FHIR versions loaded (e.g. ['4.0.1']). */
  fhirVersions: string[];
  /** Loaded package identifiers (e.g. ['hl7.fhir.r4.core@4.0.1']). */
  loadedPackages: string[];
  /** Resource types with database tables. */
  resourceTypes: string[];
  /** Database adapter type in use. */
  databaseType: 'sqlite' | 'sqlite-wasm' | 'postgres';
  /** IG migration action performed at startup. */
  igAction: 'new' | 'upgrade' | 'consistent';
  /** Timestamp when the engine finished bootstrapping. */
  startedAt: Date;
  /** Registered plugin names. */
  plugins: string[];
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
  /** Shared context (same object plugins receive). */
  readonly context: EngineContext;
  /**
   * High-level FHIR search — parses query params, executes search, returns results.
   *
   * @param resourceType - The FHIR resource type (e.g. 'Patient').
   * @param queryParams - URL query parameters (e.g. `{ name: 'Smith', _count: '10' }`).
   * @param options - Optional search options (e.g. `{ total: 'accurate' }`).
   * @returns Search result with matched resources, includes, and optional total.
   */
  search(
    resourceType: string,
    queryParams: Record<string, string | string[] | undefined>,
    options?: SearchOptions,
  ): Promise<SearchResult>;
  /** Return engine health/status information. */
  status(): FhirEngineStatus;
  /** Gracefully shut down the engine (closes adapter). */
  stop(): Promise<void>;
}
