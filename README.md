# fhir-engine

[![npm version](https://img.shields.io/npm/v/fhir-engine.svg)](https://www.npmjs.com/package/fhir-engine)
[![license](https://img.shields.io/npm/l/fhir-engine.svg)](./LICENSE)

**FHIR Runtime Kernel** — Bootstrap and orchestrate the embedded FHIR stack with a single function call.

`fhir-engine` assembles [fhir-definition](https://www.npmjs.com/package/fhir-definition), [fhir-runtime](https://www.npmjs.com/package/fhir-runtime), and [fhir-persistence](https://www.npmjs.com/package/fhir-persistence) into a running system from a single configuration object.

## Features

- **One-call bootstrap** — `createFhirEngine(config)` initializes definitions, runtime, and persistence
- **Plugin system** — lifecycle hooks (`init` / `start` / `ready` / `stop`) for extensibility
- **Config file support** — `fhir.config.ts` / `.js` / `.json` with env variable overrides
- **Multi-adapter** — SQLite (native + WASM) out of the box, PostgreSQL planned
- **TypeScript-first** — full type safety, dual ESM/CJS builds

## Install

```bash
npm install fhir-engine
```

### Peer dependencies

`fhir-engine` depends on the three upstream FHIR packages:

```bash
npm install fhir-definition fhir-runtime fhir-persistence
```

## Quick Start

```ts
import { createFhirEngine } from "fhir-engine";

const engine = await createFhirEngine({
  database: { type: "sqlite", path: ":memory:" },
  packages: { path: "./fhir-packages" },
});

// Create a Patient
const patient = await engine.persistence.createResource("Patient", {
  resourceType: "Patient",
  name: [{ family: "Smith", given: ["John"] }],
  gender: "male",
  birthDate: "1990-01-15",
});

// Read it back
const read = await engine.persistence.readResource("Patient", patient.id!);

// Shut down
await engine.stop();
```

## Config File

Create a `fhir.config.ts` (or `.js` / `.json`) in your project root:

```ts
// fhir.config.ts
import { defineConfig } from "fhir-engine";

export default defineConfig({
  database: { type: "sqlite", path: "./data/fhir.db" },
  packages: { path: "./fhir-packages" },
  plugins: [],
});
```

Then bootstrap with zero arguments:

```ts
const engine = await createFhirEngine(); // auto-discovers fhir.config.ts
```

### Environment Variable Overrides

| Variable             | Overrides                         | Example                         |
| -------------------- | --------------------------------- | ------------------------------- |
| `FHIR_DATABASE_TYPE` | `database.type`                   | `sqlite` / `postgres`           |
| `FHIR_DATABASE_URL`  | `database.path` or `database.url` | `:memory:` / `postgresql://...` |
| `FHIR_PACKAGES_PATH` | `packages.path`                   | `./fhir-packages`               |

## Plugin System

Plugins hook into the engine lifecycle:

```ts
import { createFhirEngine, FhirEnginePlugin, EngineContext } from "fhir-engine";

const myPlugin: FhirEnginePlugin = {
  name: "my-plugin",
  async init(ctx: EngineContext) {
    // Before persistence init — ctx.persistence is undefined
    ctx.logger.info("Plugin initializing...");
  },
  async start(ctx: EngineContext) {
    // After persistence init — ctx.persistence is available
    await ctx.persistence!.createResource("Patient", {
      resourceType: "Patient",
      name: [{ family: "Seed" }],
    });
  },
  async ready(ctx: EngineContext) {
    ctx.logger.info("System fully operational");
  },
  async stop(ctx: EngineContext) {
    ctx.logger.info("Cleaning up...");
  },
};

const engine = await createFhirEngine({
  database: { type: "sqlite", path: ":memory:" },
  packages: { path: "./fhir-packages" },
  plugins: [myPlugin],
});
```

### Lifecycle

```
init    → plugins.init(ctx)          — before FhirSystem.initialize()
start   → FhirSystem.initialize()   — schema + migration
          plugins.start(ctx)         — ctx.persistence now available
ready   → plugins.ready(ctx)        — system fully operational
stop    → plugins.stop(ctx)         — reverse registration order
          adapter.close()
```

- **init/start/ready** errors abort startup with clear message
- **stop** errors are logged but don't block other plugins

## API Reference

### `createFhirEngine(config?)`

Creates and bootstraps a fully initialized FHIR engine.

**Parameters:**

- `config` (optional) — `FhirEngineConfig`. If omitted, auto-loads from `fhir.config.*` in cwd.

**Returns:** `Promise<FhirEngine>`

### `FhirEngine`

| Property        | Type                                             | Description                                    |
| --------------- | ------------------------------------------------ | ---------------------------------------------- |
| `definitions`   | `DefinitionRegistry`                             | FHIR definitions from fhir-definition          |
| `runtime`       | `FhirRuntimeInstance`                            | FHIRPath, validation from fhir-runtime         |
| `persistence`   | `FhirPersistence`                                | CRUD + search + indexing from fhir-persistence |
| `adapter`       | `StorageAdapter`                                 | Underlying database adapter                    |
| `sdRegistry`    | `StructureDefinitionRegistry`                    | Loaded StructureDefinitions                    |
| `spRegistry`    | `SearchParameterRegistry`                        | Loaded SearchParameters                        |
| `resourceTypes` | `string[]`                                       | Resource types with database tables            |
| `context`       | `EngineContext`                                  | Shared context (same object plugins receive)   |
| `logger`        | `Logger`                                         | Logger instance                                |
| `search()`      | `(type, params, opts?) => Promise<SearchResult>` | High-level FHIR search                         |
| `status()`      | `() => FhirEngineStatus`                         | Engine health and status information           |
| `stop()`        | `() => Promise<void>`                            | Gracefully shut down the engine                |

### `FhirEngineConfig`

```ts
interface FhirEngineConfig {
  database: DatabaseConfig; // sqlite | sqlite-wasm | postgres
  packages: PackagesConfig; // { path: string }
  packageName?: string; // IG migration label
  packageVersion?: string; // IG migration version
  logger?: Logger; // custom logger (default: console)
  plugins?: FhirEnginePlugin[]; // plugins array
}
```

### `FhirEngineStatus`

Returned by `engine.status()`:

```ts
interface FhirEngineStatus {
  fhirVersions: string[]; // e.g. ['4.0']
  loadedPackages: string[]; // e.g. ['hl7.fhir.r4.core@4.0.1']
  resourceTypes: string[]; // e.g. ['Patient', 'Observation', ...]
  databaseType: "sqlite" | "sqlite-wasm" | "postgres";
  igAction: "new" | "upgrade" | "consistent";
  startedAt: Date;
  plugins: string[]; // registered plugin names
}
```

### `engine.search(resourceType, queryParams, options?)`

High-level FHIR search — parses URL query parameters and executes search in one call:

```ts
const result = await engine.search("Patient", { name: "Smith", _count: "10" });
console.log(result.resources); // PersistedResource[]
console.log(result.total); // number (if options.total = 'accurate')
```

### Search Utilities (re-exported from fhir-persistence)

For lower-level search control:

```ts
import { parseSearchRequest, executeSearch } from "fhir-engine";
import type { SearchRequest, SearchResult, SearchOptions } from "fhir-engine";

const request = parseSearchRequest(
  "Patient",
  { name: "Smith" },
  engine.spRegistry,
);
const result = await executeSearch(engine.adapter, request, engine.spRegistry);
```

### FHIRPath Evaluation (re-exported from fhir-runtime)

```ts
import {
  evalFhirPath,
  evalFhirPathBoolean,
  evalFhirPathString,
} from "fhir-engine";

const values = evalFhirPath("Patient.name.family", patient); // unknown[]
const active = evalFhirPathBoolean("Patient.active", patient); // boolean
const family = evalFhirPathString("Patient.name.family", patient); // string | undefined
```

### `defineConfig(config)`

Type-safe identity helper for config files. Returns the config unchanged.

### `loadFhirConfig(path?)`

Loads config from a file. Auto-discovers `fhir.config.ts` → `.js` → `.mjs` → `.json` from cwd if no path given.

## Database Adapters

| `database.type` | Adapter                | Use Case                    |
| --------------- | ---------------------- | --------------------------- |
| `sqlite`        | `BetterSqlite3Adapter` | Node.js / Electron / CLI    |
| `sqlite-wasm`   | `SQLiteAdapter`        | Browser / WASM              |
| `postgres`      | —                      | Not yet available (planned) |

## Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0

## License

[MIT](./LICENSE)
