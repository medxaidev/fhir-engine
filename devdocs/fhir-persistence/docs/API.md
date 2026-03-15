# fhir-persistence — API Reference

Version: 0.1.0

---

## Core Facade

### `FhirPersistence`

End-to-end FHIR persistence facade with automatic search indexing.

```typescript
import { FhirPersistence } from 'fhir-persistence';

const persistence = new FhirPersistence(options: FhirPersistenceOptions);
```

**Options:**

| Property | Type | Required | Description |
|---|---|---|---|
| `adapter` | `StorageAdapter` | Yes | Database adapter |
| `searchParameterRegistry` | `SearchParameterRegistry` | Yes | Indexed search parameters |
| `runtimeProvider` | `RuntimeProvider` | No | FHIRPath extraction (from fhir-runtime) |

**Methods:**

| Method | Returns | Description |
|---|---|---|
| `createResource(type, resource)` | `Promise<PersistedResource>` | Create with auto-indexing |
| `readResource(type, id)` | `Promise<PersistedResource>` | Read by ID |
| `updateResource(type, resource)` | `Promise<PersistedResource>` | Update with re-indexing |
| `deleteResource(type, id)` | `Promise<void>` | Soft delete |
| `searchResources(request)` | `Promise<SearchResult>` | Search with pagination |
| `searchStream(request)` | `AsyncIterable<PersistedResource>` | Streaming search results |

---

### `FhirStore`

Basic CRUD without search indexing (lower-level).

```typescript
import { FhirStore } from 'fhir-persistence';

const store = new FhirStore(adapter: StorageAdapter);
```

**Methods:**

| Method | Returns | Description |
|---|---|---|
| `create(type, resource)` | `Promise<PersistedResource>` | Insert resource |
| `read(type, id)` | `Promise<PersistedResource>` | Read by ID |
| `update(type, resource)` | `Promise<PersistedResource>` | Update resource |
| `delete(type, id)` | `Promise<void>` | Soft delete |
| `history(type, id, options?)` | `Promise<HistoryEntry[]>` | Instance history |

---

## Storage Adapters

### `StorageAdapter` (interface)

```typescript
import type { StorageAdapter } from 'fhir-persistence';
```

| Method | Signature |
|---|---|
| `execute` | `(sql: string, params?: unknown[]) => Promise<{ changes: number }>` |
| `query` | `<T>(sql: string, params?: unknown[]) => Promise<T[]>` |
| `queryOne` | `<T>(sql: string, params?: unknown[]) => Promise<T \| undefined>` |
| `queryStream` | `<T>(sql: string, params?: unknown[]) => AsyncIterable<T>` |
| `prepare` | `<T>(sql: string) => PreparedStatement<T>` |
| `transaction` | `<R>(fn: (tx: TransactionContext) => R) => Promise<R>` |
| `close` | `() => Promise<void>` |

### `BetterSqlite3Adapter`

Native SQLite via better-sqlite3. **Recommended for production Node.js.**

```typescript
import { BetterSqlite3Adapter } from 'fhir-persistence';

const adapter = new BetterSqlite3Adapter({ path: './fhir.db' });
// or in-memory:
const adapter = new BetterSqlite3Adapter({ path: ':memory:' });
```

**Options (`BetterSqlite3Options`):**

| Property | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | `':memory:'` | Database file path |

### `SQLiteAdapter`

WASM-based SQLite via sql.js. Cross-platform (browser, Electron, Node.js).

```typescript
import { SQLiteAdapter } from 'fhir-persistence';

const adapter = new SQLiteAdapter(':memory:');
```

---

## Registries

### `SearchParameterRegistry`

```typescript
import { SearchParameterRegistry } from 'fhir-persistence';

const registry = new SearchParameterRegistry();
registry.indexBundle(searchParameterBundle);    // bulk index
registry.index(searchParam);                    // single index

const params = registry.getForResource('Patient');
const param = registry.get('Patient', 'birthdate');
```

### `StructureDefinitionRegistry`

```typescript
import { StructureDefinitionRegistry } from 'fhir-persistence';

const sdRegistry = new StructureDefinitionRegistry();
sdRegistry.register(structureDefinition);

const sd = sdRegistry.get('Patient');
const all = sdRegistry.getAll();
```

---

## Schema & DDL

### Schema Builder

```typescript
import { buildResourceTableSet, buildAllResourceTableSets } from 'fhir-persistence';

// Single resource type
const tableSet = buildResourceTableSet('Patient', sdRegistry, spRegistry);

// All registered resource types
const allSets = buildAllResourceTableSets(sdRegistry, spRegistry);
```

### DDL Generator

```typescript
import {
  generateCreateMainTable,
  generateCreateHistoryTable,
  generateCreateReferencesTable,
} from 'fhir-persistence';

const mainDDL = generateCreateMainTable(tableSet.main, 'sqlite');
const historyDDL = generateCreateHistoryTable(tableSet.history, 'sqlite');
const refDDL = generateCreateReferencesTable(tableSet.references, 'sqlite');
```

---

## Search

### Parse & Build

```typescript
import { parseSearchRequest, buildSearchSQLv2, buildCountSQLv2 } from 'fhir-persistence';

const request = parseSearchRequest('Patient', {
  birthdate: 'ge1990-01-01',
  active: 'true',
  _sort: '-birthdate',
  _count: '50',
}, registry);

const { sql, params } = buildSearchSQLv2(request, registry);
const { sql: countSql, params: countParams } = buildCountSQLv2(request, registry);
```

### Chain Search

```typescript
const request = parseSearchRequest('Observation', {
  'subject:Patient.birthdate': 'ge1990-01-01',
}, registry);
```

### Search Planner

```typescript
import { planSearch, buildTwoPhaseSearchSQLv2 } from 'fhir-persistence';

const plan = planSearch(request, registry, { estimatedRowCount: 100_000 });
if (plan.useTwoPhase) {
  const { phase1, phase2Template } = buildTwoPhaseSearchSQLv2(plan.request, registry);
}
```

### Where Builder

```typescript
import { buildWhereFragmentV2, buildWhereClauseV2 } from 'fhir-persistence';

const fragment = buildWhereFragmentV2(parsedParam, registry);
const clause = buildWhereClauseV2(request, registry);
```

---

## Migration Engine

### `IGPersistenceManager`

```typescript
import { IGPersistenceManager } from 'fhir-persistence';

const igManager = new IGPersistenceManager(adapter, 'sqlite');

const result = await igManager.initialize({
  name: 'hl7.fhir.r4.core',
  version: '4.0.1',
  checksum: computedChecksum,
  tableSets: generatedTableSets,
});

// result: { action: 'new'|'upgrade'|'consistent', ddlCount, reindexCount }
```

### Schema Diff

```typescript
import { compareSchemas, generateMigration } from 'fhir-persistence';

const deltas = compareSchemas(oldTableSets, newTableSets);
const migration = generateMigration(deltas, 'sqlite');
// migration.up: string[] — DDL statements to apply
```

### Package Registry

```typescript
import { PackageRegistryRepo } from 'fhir-persistence';

const repo = new PackageRegistryRepo(adapter);
const status = await repo.checkStatus('hl7.fhir.r4.core', checksum);
const pkg = await repo.getPackage('hl7.fhir.r4.core');
```

---

## Indexing

### `IndexingPipeline`

```typescript
import { IndexingPipeline } from 'fhir-persistence';

const pipeline = new IndexingPipeline({
  adapter,
  searchParameterRegistry: spRegistry,
  runtimeProvider,  // optional — enables FHIRPath extraction
});

const result = await pipeline.index('Patient', resource, tableSet);
```

---

## Provider Bridges

### `FhirDefinitionBridge`

Wraps `fhir-definition`'s `DefinitionRegistry` into `fhir-persistence`'s `DefinitionProvider`.

```typescript
import { FhirDefinitionBridge } from 'fhir-persistence';
import { loadDefinitionPackages } from 'fhir-definition';

const { registry } = loadDefinitionPackages('./fhir-packages');
const bridge = new FhirDefinitionBridge(registry);
// bridge satisfies DefinitionProvider
```

### `FhirRuntimeProvider`

Wraps `fhir-runtime`'s `FhirRuntimeInstance` into `fhir-persistence`'s `RuntimeProvider`.

```typescript
import { FhirRuntimeProvider } from 'fhir-persistence';
import { createRuntime } from 'fhir-runtime';

const runtime = await createRuntime({ definitions: registry });
const provider = new FhirRuntimeProvider({ runtime });
// provider satisfies RuntimeProvider
```

---

## Startup Orchestrator

### `FhirSystem`

End-to-end bootstrap: definitions → registries → schema → persistence.

```typescript
import { FhirSystem, BetterSqlite3Adapter, FhirDefinitionBridge } from 'fhir-persistence';

const adapter = new BetterSqlite3Adapter({ path: './fhir.db' });
const system = new FhirSystem(adapter, {
  dialect: 'sqlite',
  runtimeProvider,     // optional
  packageName: 'my-app',
  packageVersion: '1.0.0',
});

const result = await system.initialize(definitionBridge);
// result.persistence: FhirPersistence
// result.sdRegistry: StructureDefinitionRegistry
// result.spRegistry: SearchParameterRegistry
// result.igResult: IGInitResult
```

---

## Terminology

```typescript
import { TerminologyCodeRepo, ValueSetRepo } from 'fhir-persistence';

const termRepo = new TerminologyCodeRepo(adapter);
const vsRepo = new ValueSetRepo(adapter);
```

---

## Production Utilities

```typescript
import { ResourceCacheV2, SearchLogger, reindexAllV2 } from 'fhir-persistence';

// In-memory cache
const cache = new ResourceCacheV2({ maxSize: 1000, ttlMs: 60_000 });

// Search logging
const logger = new SearchLogger();

// Reindex CLI
await reindexAllV2(adapter, spRegistry, pipeline);
```

---

## Types

Key exported types:

| Type | Module | Description |
|---|---|---|
| `StorageAdapter` | db | Database abstraction |
| `TransactionContext` | db | Transaction callback context |
| `BetterSqlite3Options` | db | better-sqlite3 config |
| `FhirPersistenceOptions` | store | Persistence facade config |
| `FhirResource` | repo | Base FHIR resource shape |
| `PersistedResource` | repo | Resource with id/versionId/lastUpdated |
| `SearchRequest` | search | Parsed search parameters |
| `SearchResult` | repo | Search result with pagination |
| `SearchBundle` | search | FHIR Bundle search response |
| `ResourceTableSet` | schema | Main + History + References schema |
| `SearchParameterImpl` | registry | Indexed search parameter |
| `SchemaDelta` | migration | Schema diff entry |
| `GeneratedMigration` | migration | Migration DDL statements |
| `IGInitResult` | migration | IG initialization result |
| `IndexResult` | repo | Indexing pipeline result |
