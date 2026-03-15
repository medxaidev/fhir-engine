# Phase 2 — Plugin System

Version: v0.2.0
Date: 2026-03-14
Status: 🔵 In Progress

---

## Goal

Plugins hook into the engine lifecycle and share an `EngineContext`. The bootstrap sequence becomes:

```
init  →  start  →  ready  →  stop
```

Plugins can register additional definitions in `init()`, access persistence in `start()`, and perform cleanup in `stop()`.

---

## Design

### Lifecycle Phases

| Phase | Timing | ctx.persistence | Use Case |
|---|---|---|---|
| `init` | Before `FhirSystem.initialize()` | ❌ undefined | Register additional SD/SP, validate config |
| `start` | After `FhirSystem.initialize()` | ✅ available | Seed data, open connections, start background tasks |
| `ready` | After all plugins started | ✅ available | Log readiness, emit events, start accepting traffic |
| `stop` | Shutdown (reverse order) | ✅ available | Close connections, flush buffers, cleanup |

### Plugin Interface

```ts
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
```

### Engine Context

```ts
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
```

### Config Change

```ts
export interface FhirEngineConfig {
  database: DatabaseConfig;
  packages: PackagesConfig;
  packageName?: string;
  packageVersion?: string;
  logger?: Logger;
  plugins?: FhirEnginePlugin[];   // ← NEW
}
```

### Bootstrap Sequence (Updated)

```
createFhirEngine(config)
  0. validateConfig(config)
  1. loadDefinitionPackages(config.packages.path)       → DefinitionRegistry
  2. createRuntime({ definitions, preloadCore: false })  → FhirRuntimeInstance
  3. Build provider bridges (FhirDefinitionBridge, FhirRuntimeProvider)
  4. createAdapter(config.database)                      → StorageAdapter
  5. Build EngineContext { config, definitions, runtime, adapter, persistence: undefined }
  6. ── INIT PHASE ──
     for each plugin (registration order):
       await plugin.init(ctx)                            // ctx.persistence = undefined
  7. FhirSystem.initialize(definitionBridge)              → FhirSystemReady
     ctx.persistence = persistence                       // now available
  8. ── START PHASE ──
     for each plugin (registration order):
       await plugin.start(ctx)                           // ctx.persistence available
  9. ── READY PHASE ──
     for each plugin (registration order):
       await plugin.ready(ctx)
 10. return FhirEngine instance

engine.stop()
  1. ── STOP PHASE ──
     for each plugin (reverse registration order):
       try { await plugin.stop(ctx) } catch → log error, continue
  2. await adapter.close()
```

---

## Error Handling

| Phase | Error Behavior |
|---|---|
| `init()` throws | **Abort** — engine startup fails, error propagated to caller |
| `start()` throws | **Abort** — engine startup fails, error propagated to caller |
| `ready()` throws | **Abort** — engine startup fails, error propagated to caller |
| `stop()` throws | **Log & continue** — other plugins still get their `stop()` called, adapter still closes |

Error messages include the plugin name:

```
fhir-engine: plugin "my-plugin" failed during init: <original error message>
```

---

## FhirEngine Interface Update

```ts
export interface FhirEngine {
  // ... all existing Phase 1 fields ...
  readonly definitions: DefinitionRegistry;
  readonly runtime: FhirRuntimeInstance;
  readonly adapter: StorageAdapter;
  readonly persistence: FhirPersistence;
  readonly sdRegistry: StructureDefinitionRegistry;
  readonly spRegistry: SearchParameterRegistry;
  readonly igResult: FhirSystemReady['igResult'];
  readonly resourceTypes: string[];
  readonly logger: Logger;
  readonly context: EngineContext;     // ← NEW: shared context
  stop(): Promise<void>;
}
```

---

## Implementation Plan

### Step 1: Types (`src/types.ts`)

Add `FhirEnginePlugin`, `EngineContext` interfaces. Add `plugins?: FhirEnginePlugin[]` to `FhirEngineConfig`. Add `context: EngineContext` to `FhirEngine`.

### Step 2: Engine (`src/engine.ts`)

Refactor `createFhirEngine()` to:

1. Build a mutable `EngineContext` object (with `persistence` starting as `undefined`)
2. Run `plugin.init(ctx)` for each plugin before `FhirSystem.initialize()`
3. Set `ctx.persistence` after initialization
4. Run `plugin.start(ctx)` and `plugin.ready(ctx)` in sequence
5. In `stop()`: iterate plugins in reverse, catch errors per-plugin, then close adapter

### Step 3: Exports (`src/index.ts`)

Add `FhirEnginePlugin` and `EngineContext` to barrel exports.

### Step 4: Tests (`src/__tests__/plugin.test.ts`)

New test file for plugin lifecycle. Existing engine.test.ts continues to work (no plugins = no-op).

---

## Acceptance Criteria

| # | Criterion | Test |
|---|---|---|
| 1 | Plugin `init()` runs before `FhirSystem.initialize()` | Plugin checks `ctx.persistence === undefined` in init |
| 2 | Plugin `start()` receives non-undefined `ctx.persistence` | Plugin asserts `ctx.persistence !== undefined` in start |
| 3 | Plugin registered second has its `stop()` called first | Record call order, verify reverse |
| 4 | Plugin throwing in `init()` aborts engine startup | `expect(createFhirEngine(...)).rejects.toThrow()` |
| 5 | Plugin throwing in `stop()` logs error but others proceed | Both plugins' stop called, error logged |
| 6 | No plugins = Phase 1 behavior unchanged | Existing 11 tests still pass |
| 7 | `engine.context` is accessible | `expect(engine.context.persistence).toBeDefined()` |

---

## Sub-Project Requirements

**None.** Phase 2 has no upstream blockers. P2 (vread/history) was already resolved in v0.1.0.

---

## Files Changed

| File | Change |
|---|---|
| `src/types.ts` | Add `FhirEnginePlugin`, `EngineContext`, update `FhirEngineConfig` and `FhirEngine` |
| `src/engine.ts` | Refactor bootstrap with plugin lifecycle |
| `src/index.ts` | Export new types |
| `src/__tests__/plugin.test.ts` | New test file — plugin lifecycle tests |
| `src/__tests__/engine.test.ts` | Unchanged — backward compatibility |
