# Phase 1 — Core Bootstrap (Complete)

Version: v0.1.0
Date: 2026-03-14
Status: ✅ Complete

---

## Goal

`createFhirEngine(config)` runs end-to-end with local packages and SQLite, returning a fully initialized `FhirEngine` instance that provides FHIR definitions, runtime, and persistence in a single call.

---

## Delivered Files

| File | Lines | Purpose |
|---|---|---|
| `src/types.ts` | 105 | `FhirEngineConfig`, `FhirEngine`, `DatabaseConfig`, `Logger` interfaces |
| `src/engine.ts` | 132 | `createFhirEngine(config)` — end-to-end bootstrap factory |
| `src/adapter-factory.ts` | 43 | `createAdapter()` — StorageAdapter factory (sqlite / sqlite-wasm / postgres stub) |
| `src/logger.ts` | 14 | `createConsoleLogger()` — default `[fhir-engine]` prefixed console logger |
| `src/index.ts` | 22 | Barrel exports + re-exported upstream types |
| `src/__tests__/engine.test.ts` | 159 | 11 integration tests |
| `src/__tests__/fixtures/` | — | Minimal hl7.fhir.r4.core package (Patient SD + 4 SearchParameters) |

---

## Architecture

### Bootstrap Sequence

```
createFhirEngine(config)
  0. validateConfig(config)
  1. loadDefinitionPackages(config.packages.path)     → DefinitionRegistry
  2. createRuntime({ definitions, preloadCore: false }) → FhirRuntimeInstance
  3. new FhirDefinitionBridge(registry)                → DefinitionProvider bridge
     new FhirRuntimeProvider({ extractSearchValues,
       extractAllSearchValues, extractReferences })    → RuntimeProvider bridge
  4. createAdapter(config.database)                    → StorageAdapter
  5. new FhirSystem(adapter, { dialect, runtimeProvider, packageName, packageVersion })
     system.initialize(definitionBridge)               → FhirSystemReady
  6. return FhirEngine { definitions, runtime, adapter, persistence, ... stop() }
```

### Type Definitions

```ts
// Config (input)
interface FhirEngineConfig {
  database: DatabaseConfig;       // sqlite | sqlite-wasm | postgres
  packages: PackagesConfig;       // { path: string }
  packageName?: string;           // IG migration label
  packageVersion?: string;        // IG migration version
  logger?: Logger;                // pluggable, console fallback
}

type DatabaseConfig =
  | SqliteDatabaseConfig          // { type: 'sqlite', path, wal?, busyTimeout? }
  | SqliteWasmDatabaseConfig      // { type: 'sqlite-wasm', path }
  | PostgresDatabaseConfig;       // { type: 'postgres', url }

// Result (output)
interface FhirEngine {
  readonly definitions: DefinitionRegistry;      // fhir-definition
  readonly runtime: FhirRuntimeInstance;          // fhir-runtime
  readonly adapter: StorageAdapter;               // fhir-persistence
  readonly persistence: FhirPersistence;          // CRUD + Search + Indexing
  readonly sdRegistry: StructureDefinitionRegistry;
  readonly spRegistry: SearchParameterRegistry;
  readonly igResult: FhirSystemReady['igResult'];
  readonly resourceTypes: string[];
  readonly logger: Logger;
  stop(): Promise<void>;
}
```

### Public API (`src/index.ts`)

```ts
// Functions
export { createFhirEngine } from './engine.js';
export { createConsoleLogger } from './logger.js';
export { createAdapter } from './adapter-factory.js';

// Types
export type { FhirEngine, FhirEngineConfig, DatabaseConfig, ... } from './types.js';

// Re-exported upstream types
export type { DefinitionRegistry, DefinitionProvider } from 'fhir-definition';
export type { FhirRuntimeInstance } from 'fhir-runtime';
export type { FhirPersistence, StorageAdapter } from 'fhir-persistence';
```

---

## Adapter Factory

| `database.type` | Adapter | Status |
|---|---|---|
| `sqlite` | `BetterSqlite3Adapter` | ✅ Working |
| `sqlite-wasm` | `SQLiteAdapter` | ✅ Working |
| `postgres` | `PostgresAdapter` | ❌ Not exported from fhir-persistence v0.1.0 — throws with clear message |

---

## Test Results

**11/11 passing** (vitest, ~130ms total)

| Category | Test | Result |
|---|---|---|
| Config validation | throws on missing database config | ✅ |
| Config validation | throws on missing packages config | ✅ |
| Config validation | throws on postgres (not yet supported) | ✅ |
| Bootstrap | bootstraps with SQLite :memory: and returns FhirEngine | ✅ |
| Bootstrap | loads Patient StructureDefinition from fixtures | ✅ |
| Bootstrap | Patient is in resourceTypes | ✅ |
| CRUD | creates and reads a Patient resource | ✅ |
| CRUD | updates a Patient resource | ✅ |
| CRUD | deletes a Patient resource | ✅ |
| Lifecycle | stop() is idempotent | ✅ |
| Logger | accepts a custom logger | ✅ |

### Run Tests

```bash
npx vitest run --reporter=verbose
```

---

## Build

```bash
npm run build    # tsc + esbuild + api-extractor → dist/
npx tsc --noEmit # type-check only
```

Both pass with zero errors.

---

## Upstream Dependencies Used

| Package | Version | API Surface Consumed |
|---|---|---|
| `fhir-definition` | ^0.5.0 | `loadDefinitionPackages(rootPath)` → `{ registry, result }` |
| `fhir-runtime` | ^0.8.1 | `createRuntime({ definitions, preloadCore })`, `extractSearchValues`, `extractAllSearchValues`, `extractReferences` |
| `fhir-persistence` | ^0.1.0 | `FhirSystem`, `BetterSqlite3Adapter`, `SQLiteAdapter`, `FhirDefinitionBridge`, `FhirRuntimeProvider` |

---

## Workarounds & Known Issues

### fhir-runtime `preloadCore: false`

`fhir-runtime@0.8.1` has a packaging bug: the bundled core JSON definition files (Resource.json, DomainResource.json, Element.json, etc. — ~70 files) are not included in `dist/esm/` or `dist/cjs/` of the npm package. When `createRuntime()` is called with `preloadCore: true` (default), it tries to load these files from `dirname(import.meta.url)` and fails with ENOENT.

**Workaround:** Pass `preloadCore: false` since we provide all definitions via `DefinitionProvider` from fhir-definition's `DefinitionRegistry`. This is semantically correct — the engine's `DefinitionRegistry` is the single source of truth for all definitions.

**Upstream fix needed:** fhir-runtime should either bundle the JSON files in `dist/` or make `preloadCore` default to `false` when `definitions` is provided.

### PostgresAdapter not exported

`fhir-persistence@0.1.0` does not export `PostgresAdapter`. Phase 1 proceeds SQLite-only. PostgreSQL support requires fhir-persistence to add `export { PostgresAdapter }` to its `src/index.ts`.

---

## Phase 1 Acceptance Criteria Status

| Criterion | Status |
|---|---|
| `createFhirEngine({ database: { type: 'sqlite', path: ':memory:' }, packages: { path: ... } })` runs without error | ✅ |
| `engine.persistence.createResource('Patient', resource)` stores resource and indexes search columns | ✅ |
| `engine.persistence.readResource('Patient', id)` returns stored resource | ✅ |
| `engine.persistence.updateResource('Patient', resource)` creates new version | ✅ |
| `engine.persistence.deleteResource('Patient', id)` removes resource | ✅ |
| `engine.stop()` closes adapter and resolves without error | ✅ |
| `engine.stop()` is idempotent (double-call safe) | ✅ |
| In-process SQLite (`:memory:`) works for automated tests | ✅ |

---

## What Phase 1 Does NOT Include

These items are deferred to later phases per ROADMAP.md:

- **Plugin system** — Phase 2
- **Config file** (`fhir.config.ts`) — Phase 3
- **PostgreSQL support** — Phase 4 (blocked by P1: PostgresAdapter export)
- **FHIR Search** (`searchResources()`) — not yet tested end-to-end via engine
- **Validation** (`engine.runtime.validate()`) — not yet tested (requires core definitions in registry)
- **Network IG download** — Phase 6 (blocked by D2)
