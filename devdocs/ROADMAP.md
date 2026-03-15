# fhir-engine — ROADMAP

Version: v1.0
Date: 2026-03-13
Status: Active

---

## Stack Position

`fhir-engine` is the **4th project** in the FHIR Embedded Stack, assembling the three upstream packages into a running system.

| #   | Package            | Version | Role                                                  | Status      |
| --- | ------------------ | ------- | ----------------------------------------------------- | ----------- |
| 1   | `fhir-definition`  | v0.5.0  | Knowledge layer — SD / SP / VS / CS (in-memory)       | ✅ Stable   |
| 2   | `fhir-runtime`     | v0.8.0  | Logic layer — FHIRPath, validation, search extraction | ✅ Stable   |
| 3   | `fhir-persistence` | v0.1.0  | Data layer — CRUD, search, schema migration           | ✅ Stable   |
| 4   | `fhir-engine`      | v0.2.0  | Bootstrap + lifecycle + plugin orchestration          | ✅ Released |

---

## Phase 1 — Core Bootstrap

**Milestone:** `v0.1.0`
**Goal:** `createFhirEngine(config)` runs end-to-end with local packages, SQLite and PostgreSQL.

### Deliverables

- [x] `FhirEngineConfig` — complete type definition with database, packages, runtime, logger, plugins
- [x] `FhirEngine` — result interface: definitions, runtime, persistence, sdRegistry, spRegistry, stop()
- [x] `createFhirEngine(config)` — end-to-end bootstrap factory
- [x] Adapter factory — `sqlite` → `BetterSqlite3Adapter`, `sqlite-wasm` → `SQLiteAdapter`, `postgres` → stub (PostgresAdapter not exported)
- [x] Lifecycle — init → start → ready → stop (sequential, error-safe)
- [x] Logger interface — pluggable, console fallback
- [x] `src/index.ts` — clean public API barrel export

### Bootstrap sequence

```
createFhirEngine(config)
  1. validateConfig(config)
  2. loadDefinitionPackages(config.packages.path)    → DefinitionRegistry
  3. createRuntime({ definitions: registry })         → FhirRuntimeInstance
  4. new FhirDefinitionBridge(registry)               → DefinitionProvider bridge
  5. new FhirRuntimeProvider({ runtime })             → RuntimeProvider bridge
  6. createAdapter(config.database)                   → StorageAdapter
  7. new FhirSystem(adapter, { dialect, runtimeProvider, packageName, packageVersion })
  8. system.initialize(definitionBridge)
     → { persistence, sdRegistry, spRegistry, igResult }
  9. return FhirEngine instance
```

### Sub-project dependencies

| Dependency              | API Used                                                                            | Status                                     |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| fhir-definition v0.5.0  | `loadDefinitionPackages()`, `InMemoryDefinitionRegistry`                            | ✅ Ready                                   |
| fhir-runtime v0.8.0     | `createRuntime({ definitions, preloadCore: false })`, `FhirRuntimeInstance`         | ✅ Ready (R1 done, preloadCore workaround) |
| fhir-persistence v0.1.0 | `FhirSystem`, `BetterSqlite3Adapter`, `FhirDefinitionBridge`, `FhirRuntimeProvider` | ✅ Ready                                   |

### Acceptance criteria

- `createFhirEngine({ database: { type: 'sqlite', url: ':memory:' }, packages: { path: './test' } })` runs without error
- `engine.persistence.createResource('Patient', resource)` stores resource and indexes search columns
- `engine.persistence.searchResources({ resourceType: 'Patient' })` returns populated Bundle
- `engine.runtime.validate(resource, profileUrl)` returns ValidationResult
- `engine.stop()` closes adapter and resolves without error
- In-process SQLite (`':memory:'`) works for automated tests

---

## Phase 2 — Plugin System

**Milestone:** `v0.2.0`
**Goal:** Plugins hook into engine lifecycle and share EngineContext.

### Deliverables

- [x] `FhirEnginePlugin` interface — init / start / ready / stop lifecycle hooks
- [x] `EngineContext` — shared context object injected into all plugin hooks
- [x] Plugin sequencing — init/start/ready in registration order, stop in reverse
- [x] Plugin error isolation — stop errors logged but non-blocking for other plugins
- [ ] Example: `loggerPlugin()` — structured request/response logging (deferred)
- [x] Plugin can register additional SD/SP in `init()` (before `FhirSystem.initialize()`)
- [x] Plugin accesses `ctx.persistence` in `start()` (after system init)

### Interface contracts

```ts
export interface FhirEnginePlugin {
  name: string;
  init?(ctx: EngineContext): Promise<void>;
  start?(ctx: EngineContext): Promise<void>;
  ready?(ctx: EngineContext): Promise<void>;
  stop?(ctx: EngineContext): Promise<void>;
}

export interface EngineContext {
  config: FhirEngineConfig;
  definitions: DefinitionRegistry; // from fhir-definition
  runtime: FhirRuntimeInstance; // from fhir-runtime
  adapter: StorageAdapter; // from fhir-persistence
  persistence?: FhirPersistence; // available after start()
  logger: Logger;
}
```

### Lifecycle with plugins

```
init:   plugins.init(ctx)         — before FhirSystem.initialize()
start:  FhirSystem.initialize()   — schema + migration + persistence
        plugins.start(ctx)        — ctx.persistence now available
ready:  plugins.ready(ctx)        — system fully operational
stop:   plugins.stop(ctx)         — in reverse order
        adapter.close()
```

### Acceptance criteria

- Plugin `init()` runs before `FhirSystem.initialize()`
- Plugin `start()` receives non-null `ctx.persistence`
- Plugin registered second has its `stop()` called first
- Plugin throwing in `init()` aborts engine startup with clear error
- Plugin throwing in `stop()` logs the error but other plugin stops proceed

### Sub-project requirements triggered

- ~~**P2** (fhir-persistence)~~: ✅ Already available as `readVersion()` / `readHistory()` in v0.1.0

---

## Phase 3 — Config File Support

**Milestone:** `v0.3.0`
**Goal:** `fhir.config.ts` / `.json` with env variable overrides, zero-arg `createFhirEngine()`.

### Deliverables

- [x] `loadFhirConfig(path?)` — auto-discover `fhir.config.ts` → `fhir.config.js` → `fhir.config.mjs` → `fhir.config.json`
- [x] `defineConfig(config)` — typed config helper for `fhir.config.ts`
- [x] Env variable overrides:
  - `FHIR_DATABASE_TYPE` — `sqlite` | `sqlite-wasm` | `postgres`
  - `FHIR_DATABASE_URL` — file path or connection string
  - `FHIR_PACKAGES_PATH` — local directory
  - `FHIR_LOG_LEVEL` — reserved (not yet wired to logger filtering)
- [x] Config validation with readable error messages
- [x] `createFhirEngine()` (no args) auto-loads config from working directory

### Usage

```ts
// fhir.config.ts
import { defineConfig } from "fhir-engine";

export default defineConfig({
  database: { type: "postgres", url: process.env.DATABASE_URL! },
  packages: { path: "./fhir-packages" },
  plugins: [authPlugin()],
});

// Application bootstrap
const engine = await createFhirEngine(); // reads fhir.config.ts
```

### Acceptance criteria

- `createFhirEngine()` with no args reads `fhir.config.ts` from cwd
- `FHIR_DATABASE_URL` overrides `database.url`
- Missing required field (`database`) produces error: `"fhir-engine: config.database is required"`
- Invalid `database.type` produces error with allowed values

---

## Phase 4 — Production Plugins

**Milestone:** `v0.4.0`
**Goal:** First-class plugin packages for production deployments.

### Plugin packages

| Plugin Package              | Capability                                            | Priority |
| --------------------------- | ----------------------------------------------------- | -------- |
| `fhir-plugin-auth`          | JWT validation, SMART-on-FHIR, RBAC scope enforcement | P0       |
| `fhir-plugin-terminology`   | ValueSet/$expand, ConceptMap/$translate               | P1       |
| `fhir-plugin-subscriptions` | R4B/R5 subscription channels (WebSocket, REST-hook)   | P2       |
| `fhir-plugin-audit`         | AuditEvent auto-generation on every write             | P2       |
| `fhir-plugin-metrics`       | Prometheus / OpenTelemetry instrumentation            | P3       |

### Notes

- `auth-plugin` operates at application layer (HTTP middleware); engine plugin hook is for injecting RBAC context
- `terminology-plugin` requires `fhir-runtime` InMemoryTerminologyProvider + expansion logic
- Each plugin is a separate npm package with `fhir-engine` as peer dependency

### Sub-project requirements triggered

- **R3** (fhir-runtime): `runtime.getCapabilityStatement()` for auth plugin CapabilityStatement generation
- **P3** (fhir-persistence): PostgreSQL pool config options for production deployments

---

## Phase 5 — Application Integration

**Milestone:** `v0.5.0`
**Goal:** Unified engine bootstraps fhir-server, fhir-cli, and fhir-studio.

### fhir-server (HTTP FHIR R4 REST API)

```ts
const engine = await createFhirEngine({
  database: { type: "postgres", url: process.env.DATABASE_URL! },
  packages: { path: "./fhir-packages" },
  plugins: [authPlugin({ jwksUri: "..." }), metricsPlugin()],
});

const server = new FhirServer({ persistence: engine.persistence });
await server.listen(8080);
process.on("SIGTERM", () => engine.stop());
```

### fhir-cli (migration, reindex, package management)

```ts
const engine = await createFhirEngine(loadFhirConfig("./fhir.config.ts"));

// engine.migrations — IGPersistenceManager (schema migration status/apply)
// engine.persistence — searchResources, createResource, etc.
// engine.definitions — registry for SD/SP queries

await engine.stop();
```

### fhir-studio (Electron / Web)

```ts
const engine = await createFhirEngine({
  database: { type: "sqlite", url: app.getPath("userData") + "/fhir.db" },
  packages: { path: "./fhir-packages" },
});

// engine.persistence.searchResources(...)
// engine.definitions.getStructureDefinition(...)
// engine.runtime.validate(resource)
```

### Testing / embedded

```ts
const engine = await createFhirEngine({
  database: { type: "sqlite", url: ":memory:" },
  packages: { path: "./test-fixtures/packages" },
});
// Fully isolated FHIR system per test suite
```

---

## Phase 6 — Ecosystem Expansion

**Milestone:** `v0.6.0+`
**Goal:** Network-based IG download, FHIR R5 support, multi-version capability.

### Deliverables

- [ ] Network IG download — requires **D2** (fhir-definition network loader)
- [ ] FHIR R5 support — requires fhir-runtime R5 profiles + fhir-persistence R5 schema
- [ ] Multi-version engine config (R4 + R5 side-by-side instances)
- [ ] Package cache management (`~/.fhir/packages` with integrity checking)

### Config (Phase 6 — network download)

```ts
const engine = await createFhirEngine({
  packages: {
    download: [
      { name: "hl7.fhir.r4.core", version: "4.0.1" },
      { name: "hl7.fhir.us.core", version: "6.1.0" },
    ],
    cacheDir: "~/.fhir/packages",
  },
  database: { type: "sqlite", url: "./fhir.db" },
});
```

---

## Back-Requirements to Sub-Projects

Requirements that `fhir-engine` cannot satisfy alone. Upstream packages must implement these.

### fhir-definition

| ID  | Priority | Requirement                                                                                                                                 | Triggers At |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| D1  | **P0**   | Confirm v0.5.x is a non-breaking upgrade for consumers declaring `fhir-definition@^0.4.x`                                                   | Phase 1     |
| D2  | **P5**   | Network package download: `PackageLoader({ cacheDir })` + `loader.loadMany([{ name, version }], { into: registry })` from packages.fhir.org | Phase 6     |
| D3  | **P5**   | Freeze `DefinitionProvider` interface at v1.0 with semver guarantee (no additions without DefinitionProviderV2)                             | v1.0        |

### fhir-runtime

| ID  | Priority | Requirement                                                                                                                           | Triggers At |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| R1  | **P0**   | Upgrade peer dependency from `fhir-definition@0.4.0` → `fhir-definition@^0.5.0` to eliminate version duplication in consumer installs | Phase 1     |
| R2  | **P1**   | `FhirRuntimeInstance` interface stable — no breaking changes from v0.8 through v1.0 API freeze                                        | Phase 1     |
| R3  | **P4**   | `runtime.getCapabilityStatement(resourceTypes[])` → generates FHIR CapabilityStatement for fhir-server / auth plugin                  | Phase 5     |

### fhir-persistence

| ID  | Priority | Requirement                                                                                                                                                                                                                                                                                                                 | Triggers At |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --- | ------- |
| P1  | **P0**   | ~~Confirm all engine-required symbols exported~~ — **6/7 verified**: `FhirSystem` ✅, `BetterSqlite3Adapter` ✅, `SQLiteAdapter` ✅, **`PostgresAdapter` ❌ missing**, `FhirDefinitionBridge` ✅, `FhirRuntimeProvider` ✅, `IGPersistenceManager` ✅. Phase 1 proceeds SQLite-only; PostgresAdapter needed before Phase 4. | Phase 1     |
| P2  | ~~P2~~   | ~~`FhirPersistence` facade expose `vread()` and `history()`~~ — ✅ Already available as `readVersion()` and `readHistory()` in v0.1.0                                                                                                                                                                                       | Phase 2     |     | Phase 2 |
| P3  | **P4**   | PostgreSQL adapter pool options: `database.postgres.poolSize`, `database.postgres.ssl`, `database.postgres.connectionTimeout`                                                                                                                                                                                               | Phase 4     |

---

## Current Status

| Phase                                 | Status         | Target Version |
| ------------------------------------- | -------------- | -------------- |
| **Phase 1** — Core Bootstrap          | ✅ Complete    | v0.1.0         |
| **Phase 2** — Plugin System           | ✅ Complete    | v0.2.0         |
| **Phase 3** — Config File             | ✅ Complete    | v0.3.0         |
| **Phase 4** — Production Plugins      | 🔴 Not Started | v0.4.0         |
| **Phase 5** — Application Integration | 🔴 Not Started | v0.5.0         |
| **Phase 6** — Ecosystem Expansion     | 🔴 Not Started | v0.6.0+        |

### Sub-project readiness

| Package            | Version | Phase 1 Ready? | Blocker                                                                  |
| ------------------ | ------- | -------------- | ------------------------------------------------------------------------ |
| `fhir-definition`  | v0.5.0  | ✅ Yes         | D2 needed only for Phase 6                                               |
| `fhir-runtime`     | v0.8.0  | ✅ Yes         | **R1**: ✅ completed                                                     |
| `fhir-persistence` | v0.1.0  | ⚠️ Partial     | **P1**: 6/7 exported — `PostgresAdapter` missing (SQLite OK for Phase 1) |
