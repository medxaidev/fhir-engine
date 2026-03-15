# fhir-engine — Architecture

Version: v1.1
Date: 2026-03-13
Status: Active

---

## 1. Overview

`fhir-engine` is the **FHIR Runtime Kernel** — the single bootstrap entry point for all FHIR applications.

It assembles the full FHIR stack from configuration, manages the lifecycle of all components, and hosts the plugin system.

```ts
const engine = await createFhirEngine(config);
```

All applications use this single entry point:

| Application        | Role                                   |
| ------------------ | -------------------------------------- |
| `fhir-server`      | HTTP FHIR R4 REST API                  |
| `fhir-cli`         | Migration, reindex, package management |
| `fhir-studio`      | GUI (Electron / Web)                   |
| Custom Node.js app | Embedded SDK                           |

---

## 2. Layer Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Applications                      │
│    fhir-server  │  fhir-cli  │  fhir-studio          │
└──────────────────────┬───────────────────────────────┘
                       │  createFhirEngine(config)
                       ▼
┌──────────────────────────────────────────────────────┐
│                   fhir-engine                        │
│         Bootstrap · Lifecycle · Plugin System        │
└──────────┬──────────────────────────┬────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐      ┌───────────────────────────┐
│   fhir-runtime   │      │     fhir-persistence      │
│  FHIRPath        │      │  Storage / Search          │
│  Validation      │      │  Schema Migration          │
│  Extraction      │      │  CRUD / Indexing           │
└────────┬─────────┘      └───────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│                  fhir-definition                     │
│  StructureDefinition · SearchParameter               │
│  ValueSet · CodeSystem · Package Loader              │
└──────────────────────────────────────────────────────┘
```

### Dependency direction

```
fhir-definition
      ↓
fhir-runtime
      ↓
fhir-persistence
      ↓
fhir-engine
      ↓
Applications
```

**fhir-engine only composes — it implements no FHIR logic.**

---

## 3. Component Responsibilities

| Component                        | Package (Version)         | Responsibility                                                                    |
| -------------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `InMemoryDefinitionRegistry`     | fhir-definition (v0.5.0)  | In-memory store for SD/SP/VS/CS definitions                                       |
| `loadDefinitionPackages()`       | fhir-definition (v0.5.0)  | Scan + load FHIR packages from local directory; returns `{ registry, result }`    |
| `DefinitionRegistry`             | fhir-definition (v0.5.0)  | Interface — satisfies `DefinitionProvider` structurally (no cast needed)          |
| `FhirRuntimeInstance`            | fhir-runtime (v0.8.0)     | Unified runtime: `validate()` / `extractSearchValues()` / `getSearchParameters()` |
| `createRuntime({ definitions })` | fhir-runtime (v0.8.0)     | Async factory — accepts `DefinitionProvider` injection, preloads R4 core          |
| `BetterSqlite3Adapter`           | fhir-persistence (v0.1.0) | Native SQLite (Node.js / Electron) — recommended for production Node.js           |
| `SQLiteAdapter`                  | fhir-persistence (v0.1.0) | WASM SQLite — browser / cross-platform                                            |
| `PostgresAdapter`                | fhir-persistence (v0.1.0) | PostgreSQL — production server                                                    |
| `FhirSystem`                     | fhir-persistence (v0.1.0) | Startup orchestrator: schema generation → IG migration → persistence init         |
| `FhirPersistence`                | fhir-persistence (v0.1.0) | Public CRUD + Search + Indexing facade                                            |
| `IGPersistenceManager`           | fhir-persistence (v0.1.0) | IG-driven schema migration controller                                             |
| `FhirDefinitionBridge`           | fhir-persistence (v0.1.0) | `DefinitionRegistry` → `DefinitionProvider` bridge for persistence                |
| `FhirRuntimeProvider`            | fhir-persistence (v0.1.0) | `FhirRuntimeInstance` → `RuntimeProvider` bridge for FHIRPath indexing            |
| `createFhirEngine()`             | **fhir-engine**           | Assembles all of the above into a running FHIR system                             |

---

## 4. What Engine Does NOT Do

```
❌ HTTP server
❌ Authentication / Authorization
❌ UI / GUI rendering
❌ Workflow orchestration
❌ Scheduling
❌ Built-in audit logging
❌ Terminology expansion (ValueSet/$expand)
❌ Subscriptions
```

These belong to the **Application Layer** or the **Plugin System**.

---

## 5. Lifecycle

```
createFhirEngine(config)
        │
       init
        │  Load config, packages, create adapters, plugin.init()
        ▼
      start
        │  Schema migration, FhirSystem.initialize(), plugin.start()
        ▼
      ready
        │  All plugins started — system fully operational
        ▼
     running
        │
     engine.stop()
        │  plugin.stop() in reverse order, adapter.close()
        ▼
     stopped
```

Plugin lifecycle mirrors engine lifecycle exactly:

```
Engine: init → start → ready → stop
Plugin: init → start → ready → stop
```

| Phase   | Plugin can do                                            |
| ------- | -------------------------------------------------------- |
| `init`  | Register additional SD/SP into DefinitionRegistry        |
| `start` | Access `ctx.persistence` for CRUD, start servers/workers |
| `ready` | Notify readiness (e.g., HTTP server start listening)     |
| `stop`  | Close connections, flush buffers                         |

---

## 6. Plugin Architecture

Plugins extend engine capabilities without modifying any core package.

```ts
export interface FhirEnginePlugin {
  name: string;
  init?(ctx: EngineContext): Promise<void>;
  start?(ctx: EngineContext): Promise<void>;
  ready?(ctx: EngineContext): Promise<void>;
  stop?(ctx: EngineContext): Promise<void>;
}
```

All plugins share `EngineContext`:

```ts
export interface EngineContext {
  config: FhirEngineConfig;
  definitions: DefinitionRegistry; // from fhir-definition
  runtime: FhirRuntimeInstance; // from fhir-runtime
  adapter: StorageAdapter; // from fhir-persistence
  persistence?: FhirPersistence; // available after start
  logger: Logger;
}
```

### Plugin categories

| Category           | Examples                                          |
| ------------------ | ------------------------------------------------- |
| **Infrastructure** | auth, audit, logging, metrics, tracing            |
| **FHIR Core**      | terminology/$expand, Subscriptions, AuditEvent    |
| **Integration**    | REST API, GraphQL, CLI commands, Studio UI panels |

---

## 7. Storage Adapter Selection

Engine creates the correct adapter based on `config.database.type`:

| `database.type` | Adapter                | Recommended for                 |
| --------------- | ---------------------- | ------------------------------- |
| `sqlite`        | `BetterSqlite3Adapter` | Local / embedded / studio / CLI |
| `sqlite-wasm`   | `SQLiteAdapter`        | Browser / WASM environments     |
| `postgres`      | `PostgresAdapter`      | Production server               |

---

## 8. Bootstrap Sequence (Detailed)

```
createFhirEngine(config)
        │
        ▼
loadDefinitionPackages(config.packages.path)   ← fhir-definition
→ DefinitionRegistry (SD/SP/VS/CS populated)
        │
        ▼
createRuntime({ definitions: registry })        ← fhir-runtime
→ FhirRuntimeInstance (FHIRPath + validation)
        │
        ▼
new FhirDefinitionBridge(registry)              ← bridge (fhir-persistence)
new FhirRuntimeProvider({ runtime })            ← bridge (fhir-persistence)
        │
        ▼
createAdapter(config.database)                  ← fhir-persistence
→ BetterSqlite3Adapter / SQLiteAdapter / PostgresAdapter
        │
        ▼
plugins.init(ctx)
        │
        ▼
FhirSystem.initialize(definitionBridge)         ← fhir-persistence
  ├─ buildResourceTableSets(sdRegistry, spRegistry)
  ├─ IGPersistenceManager.initialize()           (schema migration)
  └─ new FhirPersistence(adapter, spRegistry, { runtimeProvider })
        │
        ▼
plugins.start(ctx)
        │
        ▼
return FhirEngine {
  definitions, runtime, persistence,
  sdRegistry, spRegistry, migrations, stop()
}
```

---

## 9. Application Integration

### fhir-server (HTTP REST API)

```ts
const engine = await createFhirEngine({
  database: { type: "postgres", url: process.env.DATABASE_URL! },
  packages: { path: "./fhir-packages" },
  plugins: [authPlugin(), subscriptionPlugin()],
});

const server = new FhirServer({ persistence: engine.persistence });
await server.listen(8080);

process.on("SIGTERM", () => engine.stop());
```

### fhir-cli

```ts
const engine = await createFhirEngine(loadConfig("./fhir.config.ts"));

// Use engine.migrations, engine.persistence, engine.sdRegistry...

await engine.stop();
```

### fhir-studio (Electron / local)

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
```

---

## 10. Design Constraints

| Constraint                       | Rationale                                |
| -------------------------------- | ---------------------------------------- |
| Engine only bootstraps           | No FHIR logic in engine                  |
| Database via adapter             | No direct SQLite/PG dependency in engine |
| Config-driven                    | All initialization from config           |
| Single engine per process        | Avoid connection pool conflicts          |
| All apps share one engine        | Consistent init, unified config          |
| Plugins are independent packages | No coupling in core                      |

---

## 11. Roadmap

See **[ROADMAP.md](./ROADMAP.md)** for the full phased plan with deliverables, acceptance criteria, sub-project dependencies, and back-requirements.

| Phase | Goal                                                     | Milestone |
| ----- | -------------------------------------------------------- | --------- |
| **1** | `createFhirEngine(config)` — local packages, SQLite + PG | v0.1.0    |
| **2** | Plugin system + full lifecycle                           | v0.2.0    |
| **3** | `fhir.config.ts` / `.json` + env overrides               | v0.3.0    |
| **4** | Production plugins (auth / terminology / subscriptions)  | v0.4.0    |
| **5** | fhir-server / fhir-cli / fhir-studio integration         | v0.5.0    |
| **6** | Network IG download, FHIR R5, multi-version              | v0.6.0+   |

---

## 12. Confirmed Sub-Project API Surface

The following APIs are confirmed stable in current sub-project releases and are directly consumed by `fhir-engine`.

### fhir-definition v0.5.0

```ts
// Load all packages from a local directory (synchronous)
const { registry, result } = loadDefinitionPackages(rootPath);
// registry: DefinitionRegistry — satisfies DefinitionProvider structurally
// result.packages: LoadedPackage[]

// Empty registry (for plugin-driven registration)
const registry = new InMemoryDefinitionRegistry();

// DefinitionProvider interface (fhir-runtime + fhir-persistence contract)
interface DefinitionProvider {
  getStructureDefinition(url: string): StructureDefinition | undefined;
  getValueSet(url: string): ValueSet | undefined;
  getCodeSystem(url: string): CodeSystem | undefined;
  getSearchParameters(resourceType: string): SearchParameter[];
}
```

### fhir-runtime v0.8.0

```ts
// Async factory — DefinitionRegistry satisfies DefinitionProvider structurally
const runtime = await createRuntime({ definitions: registry });
// runtime: FhirRuntimeInstance

interface FhirRuntimeInstance {
  validate(resource: unknown, profileUrl?: string): Promise<ValidationResult>;
  extractSearchValues(
    resource: unknown,
    params: SearchParameter[],
  ): Record<string, unknown[]>;
  getSearchParameters(resourceType: string): SearchParameter[];
}
```

### fhir-persistence v0.1.0

```ts
// Provider bridges
const definitionBridge = new FhirDefinitionBridge(registry);
const runtimeProvider = new FhirRuntimeProvider({ runtime });

// Startup orchestrator
const system = new FhirSystem(adapter, {
  dialect: "sqlite" | "postgres",
  runtimeProvider, // optional — enables FHIRPath indexing
  packageName: string, // IG migration label
  packageVersion: string,
});

const { persistence, sdRegistry, spRegistry, igResult } =
  await system.initialize(definitionBridge);
// persistence: FhirPersistence — main CRUD + Search facade
// sdRegistry:  StructureDefinitionRegistry
// spRegistry:  SearchParameterRegistry
// igResult:    { action: 'new' | 'upgrade' | 'consistent' }
```

---

## 13. Back-Requirements to Sub-Projects

Requirements that `fhir-engine` cannot satisfy alone. Upstream packages must deliver these for the corresponding engine phase.

### fhir-definition

| ID  | Priority | Requirement                                                                                                                                       | Engine Phase |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| D1  | **P0**   | Confirm v0.5.x is forward-compatible with all consumers declaring `fhir-definition@^0.4.x`                                                        | Phase 1      |
| D2  | **P5**   | Network-based package download: `PackageLoader({ cacheDir })` + `loader.loadMany([{ name, version }], { into: registry })` from packages.fhir.org | Phase 6      |
| D3  | **P5**   | `DefinitionProvider` interface frozen and semver-guaranteed at v1.0                                                                               | v1.0         |

### fhir-runtime

| ID  | Priority | Requirement                                                                                                | Engine Phase |
| --- | -------- | ---------------------------------------------------------------------------------------------------------- | ------------ |
| R1  | ~~P0~~   | ~~Upgrade peer dependency~~ — ✅ Completed                                                                 | Phase 1      |
| R2  | **P1**   | `FhirRuntimeInstance` interface stability — no breaking changes from v0.8 through v1.0 API freeze          | Phase 1      |
| R3  | **P4**   | `runtime.getCapabilityStatement(resourceTypes[])` — auto-generate FHIR CapabilityStatement for fhir-server | Phase 5      |

### fhir-persistence

| ID  | Priority | Requirement                                                                                                                         | Engine Phase |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| P1  | **P0**   | ~~Confirm exports~~ — 6/7 verified: `PostgresAdapter` **missing**. Phase 1 proceeds SQLite-only.                                    | Phase 1      |
| P2  | ~~P2~~   | ~~Expose `vread()` and `history()`~~ — ✅ Already available as `readVersion()` / `readHistory()` in v0.1.0                          | Phase 2      |
| P3  | **P4**   | PostgreSQL adapter pool configuration: `database.postgres.poolSize`, `database.postgres.ssl`, `database.postgres.connectionTimeout` | Phase 4      |

---

## 14. Known Gaps

| Gap                                                                       | Impact                                                    | Resolution                                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ~~`fhir-runtime@0.8.0` declares `fhir-definition@0.4.0`~~                 | ~~Duplicate package install~~                             | **R1** — ✅ Resolved                                                             |
| ~~`FhirPersistence` facade has no `vread()` / `history()`~~               | ~~Engine cannot expose full FHIR history~~                | **P2** — ✅ Already available as `readVersion()` / `readHistory()` in v0.1.0     |
| No network-based IG download in fhir-definition v0.5                      | Engine Phase 6 blocked                                    | **D2** — planned as fhir-definition future upgrade                               |
| ~~No `src/` directory in fhir-engine yet~~                                | ~~Phase 1 not started~~                                   | ✅ Phase 1 complete — `createFhirEngine()` implemented, 11 tests passing         |
| `fhir-runtime@0.8.1` missing bundled core JSON definitions in `dist/esm/` | `createRuntime()` with `preloadCore: true` fails (ENOENT) | Workaround: `preloadCore: false` — definitions provided via `DefinitionProvider` |
