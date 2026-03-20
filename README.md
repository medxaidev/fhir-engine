# fhir-engine

[![npm version](https://img.shields.io/npm/v/fhir-engine.svg)](https://www.npmjs.com/package/fhir-engine)
[![license](https://img.shields.io/npm/l/fhir-engine.svg)](./LICENSE)

**FHIR Runtime Kernel** — Bootstrap and orchestrate the embedded FHIR stack with a single function call.

`fhir-engine` assembles [fhir-definition](https://www.npmjs.com/package/fhir-definition), [fhir-runtime](https://www.npmjs.com/package/fhir-runtime), and [fhir-persistence](https://www.npmjs.com/package/fhir-persistence) into a running system from a single configuration object.

## Features

- **One-call bootstrap** — `createFhirEngine(config)` initializes definitions, runtime, and persistence
- **Package resolution** — `resolvePackages()` downloads/caches FHIR IG packages automatically
- **Plugin system** — lifecycle hooks (`init` / `start` / `ready` / `stop`) for extensibility
- **Config file support** — `fhir.config.ts` / `.js` / `.json` with env variable overrides
- **Multi-adapter** — SQLite (native) and PostgreSQL out of the box
- **Full-text search** — SQLite FTS5 and PostgreSQL tsvector/GIN (v0.6.0+)
- **Batch validation** — `runtime.validateMany()` for bulk resource validation (v0.6.0+)
- **Reindex with progress** — `reindexAllV2()` / `reindexResourceTypeV2()` with progress callbacks (v0.6.0+)
- **Profile Slicing** — `buildSlicingDefinition()`, `makeExtensionSlicing()`, `hasSliceName()`, `extractSliceName()` for FHIR slice handling (v0.6.1+)
- **Choice Type utilities** — `isChoiceTypePath()`, `matchesChoiceType()`, `extractChoiceTypeName()` (v0.6.1+)
- **BackboneElement utilities** — `isBackboneElementType()` for detecting BackboneElement types (v0.6.1+)
- **IG Extraction** — `extractSDDependencies()`, `extractElementIndexRows()`, `flattenConceptHierarchy()` for IG data extraction (v0.6.2+)
- **Conformance module** — `IGResourceMapRepo`, `SDIndexRepo`, `ElementIndexRepo`, `ExpansionCacheRepo`, `ConceptHierarchyRepo`, `IGImportOrchestrator` for IG persistence (v0.6.2+)
- **Token search (UPS-1)** — `gender=male`, `identifier=system|code`, `identifier=code` with code-only/empty-system/full system|code formats (v0.7.0+)
- **String search (UPS-2)** — `name=Smith`, `family=Smith`, `given=John` via HumanName lookup table with case-insensitive prefix matching (v0.7.0+)
- **Optimistic locking (UPS-3)** — `ifMatch` option on `updateResource()` with `ResourceVersionConflictError` (v0.7.0+)
- **Error types** — `RepositoryError`, `ResourceNotFoundError`, `ResourceVersionConflictError`, `ResourceGoneError` (v0.7.0+)
- **Search bundle utilities** — `buildSearchBundle`, `buildPaginationContext`, `buildNextLink`, pagination helpers (v0.7.0+)
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

> v0.7.0 requires: fhir-definition ≥ 0.6.0, fhir-runtime ≥ 0.11.0, fhir-persistence ≥ 0.9.0

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
  igs?: Array<{ name: string; version?: string }>; // IG packages to resolve
  packageResolve?: { allowDownload?: boolean }; // resolution options
  packageName?: string; // IG migration label
  packageVersion?: string; // IG migration version
  logger?: Logger; // custom logger (default: console)
  plugins?: FhirEnginePlugin[]; // plugins array
}
```

When `igs` is provided, `createFhirEngine()` automatically resolves packages before loading definitions:

```ts
const engine = await createFhirEngine({
  database: { type: "sqlite", path: ":memory:" },
  packages: { path: "./fhir-packages" },
  igs: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
});
// Packages are downloaded/linked into ./fhir-packages/ automatically
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

### `resolvePackages(config, options?)`

Ensure FHIR IG packages are available in the project's packages directory.

Resolution order: local directory → system cache (`~/.fhir/packages`) → FHIR Package Registry download.

```ts
import { resolvePackages } from "fhir-engine";

const result = await resolvePackages(config);
console.log(result.success); // true if all resolved
console.log(result.packages); // ResolvedPackage[] with name, version, path, source
console.log(result.errors); // any failures

// Offline mode — cache only, no downloads
const offline = await resolvePackages(config, { allowDownload: false });
```

### `defineConfig(config)`

Type-safe identity helper for config files. Returns the config unchanged.

### `loadFhirConfig(path?)`

Loads config from a file. Auto-discovers `fhir.config.ts` → `.js` → `.mjs` → `.json` from cwd if no path given.

## Database Adapters

| `database.type` | Adapter                | Use Case                           |
| --------------- | ---------------------- | ---------------------------------- |
| `sqlite`        | `BetterSqlite3Adapter` | Node.js / Electron / CLI           |
| `postgres`      | `PostgresAdapter`      | Production servers (via `pg.Pool`) |
| `sqlite-wasm`   | —                      | Removed in v0.4.2 — use `sqlite`   |

### PostgreSQL Setup

`pg` is included as a direct dependency (v0.5.1+), no separate installation needed.

### Full-Text Search (v0.6.0+)

Full-text search is automatically enabled by fhir-persistence v0.6.0:

- **SQLite** — FTS5 virtual tables with trigram tokenizer
- **PostgreSQL** — tsvector columns with GIN indexes

No configuration required — string search parameters (e.g. `Patient?name=Smith`) automatically use FTS when available, with fallback to `LIKE` prefix matching.

## Profile Slicing (v0.6.1+)

FHIR profile slicing utilities — build slicing definitions, detect slice names, validate slicing compatibility:

```ts
import {
  buildSlicingDefinition,
  makeExtensionSlicing,
  hasSliceName,
  extractSliceName,
  getSliceSiblings,
  validateSlicingCompatibility,
} from "fhir-engine";
import type {
  SlicingDefinition,
  SlicingDiscriminatorDef,
  SlicingRules,
} from "fhir-engine";

// Build a SlicingDefinition from an ElementDefinitionSlicing
const slicingDef = buildSlicingDefinition(element.slicing);

// Create extension slicing (sliced by url, value discriminator)
const extSlicing = makeExtensionSlicing();

// Check if an element id contains a slice name
hasSliceName("Patient.identifier:MRN"); // true
hasSliceName("Patient.identifier"); // false

// Extract the slice name from an element id
extractSliceName("Patient.identifier:MRN"); // 'MRN'
```

## Choice Type Utilities (v0.6.1+)

Helpers for working with FHIR choice type elements (`value[x]`, `onset[x]`, etc.):

```ts
import {
  isChoiceTypePath,
  matchesChoiceType,
  extractChoiceTypeName,
} from "fhir-engine";
import type { ChoiceTypeField, ChoiceValue } from "fhir-engine";

// Check if a path is a choice type
isChoiceTypePath("Observation.value[x]"); // true
isChoiceTypePath("Observation.valueString"); // false

// Check if a concrete path matches a choice type path
matchesChoiceType("Observation.value[x]", "Observation.valueQuantity"); // true
matchesChoiceType("Observation.value[x]", "Observation.code"); // false

// Extract the type name from a concrete choice path
extractChoiceTypeName("Observation.value[x]", "Observation.valueQuantity"); // "Quantity"
```

## BackboneElement Utilities (v0.6.1+)

```ts
import { isBackboneElementType } from "fhir-engine";

// Check if an element defines a BackboneElement type
isBackboneElementType(element); // true if types contain BackboneElement or Element
```

## IG Extraction (v0.6.2+)

Utilities for extracting structured data from FHIR IG resources:

```ts
import {
  extractSDDependencies,
  extractElementIndexRows,
  flattenConceptHierarchy,
} from "fhir-engine";
import type { ElementIndexRow, ConceptRow } from "fhir-engine";

// Extract all dependencies from a StructureDefinition
const deps = extractSDDependencies(structureDefinition);
// ['HumanName', 'Identifier', 'http://hl7.org/fhir/us/core/StructureDefinition/...']

// Extract element index rows from a StructureDefinition snapshot
const rows: ElementIndexRow[] = extractElementIndexRows(structureDefinition);

// Flatten CodeSystem concept hierarchy into parent-child rows
const concepts: ConceptRow[] = flattenConceptHierarchy(codeSystem);
```

## Conformance Module (v0.6.2+)

IG persistence and indexing via the Conformance storage module:

```ts
import {
  IGImportOrchestrator,
  IGResourceMapRepo,
  SDIndexRepo,
  ElementIndexRepo,
  ExpansionCacheRepo,
  ConceptHierarchyRepo,
} from "fhir-engine";

// Create the orchestrator for full IG import
const orchestrator = new IGImportOrchestrator(adapter, dialect, {
  extractElementIndex: (sd) => extractElementIndexRows(sd),
  flattenConcepts: (cs) => flattenConceptHierarchy(cs),
});
await orchestrator.ensureAllTables();

// Import an entire IG bundle
const result = await orchestrator.importIG("hl7.fhir.us.core@6.1.0", igBundle);
console.log(
  `Imported ${result.resourceCount} resources, ${result.sdIndexCount} SDs`,
);

// Or use individual repos directly
const sdIndex = new SDIndexRepo(adapter, dialect);
await sdIndex.ensureTable();
const entries = await sdIndex.getByType("Patient");
```

## Token Search (v0.7.0+)

FHIR token search parameters with all standard formats:

```ts
// Code-only (any system)
const males = await engine.search("Patient", { gender: "male" });

// Empty system + code
const males2 = await engine.search("Patient", { gender: "|male" });

// Full system|code
const byMRN = await engine.search("Patient", {
  identifier: "http://example.com/mrn|MRN001",
});
```

## String Search (v0.7.0+)

FHIR string search with case-insensitive prefix matching via HumanName lookup table:

```ts
// Search by name (matches family + given)
const smiths = await engine.search("Patient", { name: "Smith" });

// Search by family name
const smiths2 = await engine.search("Patient", { family: "Smith" });

// Search by given name
const johns = await engine.search("Patient", { given: "John" });
```

## Optimistic Locking (v0.7.0+)

```ts
import { ResourceVersionConflictError } from "fhir-engine";

try {
  await engine.persistence.updateResource("Patient", updatedPatient, {
    ifMatch: expectedVersionId,
  });
} catch (e) {
  if (e instanceof ResourceVersionConflictError) {
    // 412 Precondition Failed — version mismatch
  }
}
```

## Error Types (v0.7.0+)

```ts
import {
  RepositoryError,
  ResourceNotFoundError,
  ResourceVersionConflictError,
  ResourceGoneError,
} from "fhir-engine";
```

## Batch Validation (v0.6.0+)

Validate multiple resources in a single call:

```ts
const results = await engine.runtime.validateMany(resources, {
  concurrency: 4,
});
// BatchValidationResult[]
```

## Reindex with Progress (v0.6.0+)

```ts
import { reindexAllV2 } from "fhir-engine";

await reindexAllV2(engine.adapter, engine.resourceTypes, (info) => {
  console.log(`${info.resourceType}: ${info.processed}/${info.total}`);
});
```

```ts
const engine = await createFhirEngine({
  database: {
    type: "postgres",
    url: "postgresql://user:pass@localhost:5432/fhir_db",
    max: 20, // pool size (default: 10)
    idleTimeoutMillis: 30000, // idle timeout (default: 30s)
  },
  packages: { path: "./fhir-packages" },
});
```

## Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0

## License

[MIT](./LICENSE)

## Upstream Dependency Versions

| Package          | Required | Features added in this version                                                                               |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| fhir-definition  | ≥ 0.6.0  | Semver range resolution, retry/offline for PackageRegistryClient                                             |
| fhir-runtime     | ≥ 0.11.0 | IG Extraction API, Profile Slicing, Choice Type, BackboneElement utils, `inferComplexType` bugfix            |
| fhir-persistence | ≥ 0.9.0  | Token search fix, string search fix, optimistic locking, conformance storage module, search bundle utilities |
