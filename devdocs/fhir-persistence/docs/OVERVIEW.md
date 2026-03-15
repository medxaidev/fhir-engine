# fhir-persistence — Overview

Version: 0.1.0

---

## What is fhir-persistence?

`fhir-persistence` is an **embedded FHIR R4 persistence layer** that provides:

- CRUD operations on FHIR resources
- Automatic search parameter indexing
- FHIR search with chain search, _include, _revinclude
- Schema generation from StructureDefinitions + SearchParameters
- Automatic schema migration when IGs change
- SQLite (native + WASM) and PostgreSQL support

It is designed to be the **storage engine** behind `fhir-engine`, which bootstraps the full FHIR stack.

---

## Architecture Position

```
┌──────────────────────────────────────────────┐
│              fhir-engine                     │
│       (bootstrap + lifecycle + plugins)      │
└──────────┬───────────────────────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
fhir-runtime   fhir-persistence  ◄── this package
     │
     ▼
fhir-definition
```

- **fhir-definition** — provides StructureDefinitions, SearchParameters, ValueSets
- **fhir-runtime** — provides FHIRPath evaluation, validation, search value extraction
- **fhir-persistence** — stores resources, indexes search parameters, generates schema DDL
- **fhir-engine** — assembles all three into a running FHIR system

---

## Core Design Principles

### 1. StorageAdapter Abstraction

All database access goes through the `StorageAdapter` interface. No code in fhir-persistence directly imports `better-sqlite3`, `sql.js`, or `pg`. This allows:

- Swapping databases without changing application code
- Running tests with in-memory SQLite
- Production with native SQLite or PostgreSQL

### 2. Three-Table-Per-Resource Pattern

Each FHIR resource type gets three tables:

| Table | Purpose |
|---|---|
| `"Patient"` | Main table with current resource + search columns |
| `"Patient_History"` | All historical versions |
| `"Patient_References"` | Extracted resource references |

Plus shared lookup tables for complex types:
- `"HumanName_Lookup"` — name search
- `"Address_Lookup"` — address search
- `"ContactPoint_Lookup"` — telecom search
- `"Identifier_Lookup"` — identifier search

### 3. IG-Driven Schema

Schema is generated from FHIR StructureDefinitions and SearchParameters — not hand-written:

```
StructureDefinition → resource type → table name
SearchParameter     → search columns → indexes
```

When an IG is upgraded, `IGPersistenceManager` computes a diff and applies only the delta.

### 4. Parameterized SQL (`?` Placeholders)

All generated SQL uses `?` positional placeholders (not PostgreSQL `$1`). This is compatible with both SQLite and PostgreSQL adapters.

### 5. Provider Bridge Pattern

`fhir-persistence` defines its own minimal interfaces (`DefinitionProvider`, `RuntimeProvider`) and provides bridge classes that wrap the real `fhir-definition` and `fhir-runtime` packages:

```
fhir-definition DefinitionRegistry
    └── FhirDefinitionBridge → DefinitionProvider

fhir-runtime FhirRuntimeInstance
    └── FhirRuntimeProvider → RuntimeProvider
```

This keeps `fhir-persistence` loosely coupled — it can run without `fhir-runtime` (using fallback property-path extraction).

---

## Module Map

```
src/
  index.ts                     ← public API barrel (252 exports)

  db/
    adapter.ts                 ← StorageAdapter interface
    sqlite-adapter.ts          ← sql.js WASM adapter
    better-sqlite3-adapter.ts  ← native SQLite adapter
    sqlite-dialect.ts          ← SQLite SQL dialect helpers

  store/
    fhir-persistence.ts        ← FhirPersistence (main facade)
    fhir-store.ts              ← FhirStore (basic CRUD)
    conditional-service.ts     ← Conditional CRUD operations

  repo/
    indexing-pipeline.ts       ← Automatic search column population
    lookup-table-writer.ts     ← HumanName/Address/etc. lookup tables
    reference-indexer.ts       ← Reference extraction
    row-indexer.ts             ← Search column value extraction
    sql-builder.ts             ← INSERT/UPDATE/SELECT SQL generation

  search/
    search-parser.ts           ← Parse FHIR search URL params
    where-builder.ts           ← WHERE clause + chain search
    search-sql-builder.ts      ← Full SELECT query generation
    search-planner.ts          ← Optimization (filter reorder, two-phase)
    search-executor.ts         ← _include/_revinclude resolution

  schema/
    table-schema-builder.ts    ← SD + SP → ResourceTableSet
    ddl-generator.ts           ← ResourceTableSet → CREATE TABLE DDL

  migration/
    schema-diff.ts             ← Compare old/new schemas
    migration-generator.ts     ← Diff → DDL statements
    ig-persistence-manager.ts  ← Three-way branch: new/upgrade/consistent
    reindex-scheduler.ts       ← Schedule reindex for SP changes

  registry/
    search-parameter-registry.ts    ← SP indexing and lookup
    structure-definition-registry.ts ← SD registration
    package-registry-repo.ts        ← Package version tracking

  providers/
    definition-provider.ts     ← DefinitionProvider interface
    runtime-provider.ts        ← RuntimeProvider interface
    fhir-definition-provider.ts ← Bridge: DefinitionRegistry → DefinitionProvider
    fhir-runtime-provider.ts   ← Bridge: FhirRuntimeInstance → RuntimeProvider

  startup/
    fhir-system.ts             ← End-to-end startup orchestrator

  terminology/
    terminology-code-repo.ts   ← Code system storage
    valueset-repo.ts           ← Value set storage

  cache/
    resource-cache.ts          ← In-memory TTL cache

  observability/
    search-logger.ts           ← Search diagnostics

  cli/
    reindex.ts                 ← Reindex utilities

  platform/
    platform-ig-definitions.ts ← Built-in platform resource types
    platform-ig-loader.ts      ← Platform IG initialization
```

---

## Data Flow

### Create Resource

```
createResource('Patient', resource)
    │
    ▼
FhirStore.create()
    │  INSERT INTO "Patient" (id, versionId, content, lastUpdated, deleted, ...)
    │
    ▼
IndexingPipeline.index()
    ├── RuntimeProvider.extractSearchValues()     (if available)
    │   or buildSearchColumns()                   (fallback)
    │   → populate __birthDate, __active, __name, ... columns
    │
    ├── extractReferencesV2()
    │   → INSERT INTO "Patient_References"
    │
    └── LookupTableWriter.write()
        → INSERT INTO "HumanName_Lookup", "Identifier_Lookup", ...
```

### Search

```
searchResources({ resourceType: 'Patient', queryParams: { birthdate: 'ge1990-01-01' } })
    │
    ▼
parseSearchRequest('Patient', params, spRegistry)
    │
    ▼
buildSearchSQLv2(request, spRegistry)
    │  SELECT id, versionId, content, lastUpdated, deleted
    │  FROM "Patient"
    │  WHERE deleted = 0 AND "__birthDate" >= ?
    │  ORDER BY ... LIMIT ? OFFSET ?
    │
    ▼
adapter.query(sql, params)
    │
    ▼
SearchExecutor: resolve _include / _revinclude
    │
    ▼
buildSearchBundle() → FHIR Bundle response
```

### Schema Migration

```
IGPersistenceManager.initialize(input)
    │
    ▼
PackageRegistryRepo.checkStatus(name, checksum)
    │
    ├── 'consistent' → no-op (return immediately)
    ├── 'new'        → apply full DDL
    └── 'upgrade'    → diff + apply delta
            │
            ▼
        compareSchemas(old, new) → SchemaDelta[]
            │
            ▼
        generateMigration(deltas, dialect) → { up: string[], reindexDeltas }
            │
            ▼
        MigrationRunnerV2.applyIGMigration(migration)
            │
            ▼
        ReindexScheduler.schedule(reindexDeltas)
```

---

## Test Coverage

```
1035 tests passing (v2)

Stage 1-9:      295 tests  (StorageAdapter → Production Hardening)
Second-Pass:     92 tests  (ADR compliance verification)
Phase A:         37 tests  (IndexingPipeline, LookupTableWriter, FhirPersistence)
Phase B:         23 tests  (Chain search, SearchPlanner, Two-phase SQL)
Stage B1-B6:     94 tests  (Provider bridges, FhirSystem, PackageRegistry, ConditionalService)
Production:     ~50 tests  (BetterSqlite3Adapter, _include:iterate, streaming, benchmark)
+ additional test suites
```

---

## Compatibility

| Environment | Adapter | Status |
|---|---|---|
| Node.js 18+ | `BetterSqlite3Adapter` | Production recommended |
| Node.js 18+ | `SQLiteAdapter` (sql.js) | Supported |
| Browser / WASM | `SQLiteAdapter` (sql.js) | Supported |
| PostgreSQL | `PostgresAdapter` | Supported (needs `pg`) |
| Electron | `BetterSqlite3Adapter` | Supported |

---

## What's Next

`fhir-persistence` v0.1.0 is the foundation for:

- **fhir-engine** — central orchestrator that bootstraps definition + runtime + persistence
- **fhir-server** — HTTP FHIR R4 REST API
- **fhir-cli** — migration and reindex CLI tools
- **fhir-studio** — GUI for FHIR resource browsing and editing
