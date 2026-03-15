# FHIR Persistence Architecture

Version: v2.0
Status: Active — Embedded Stack Refactor
Package: `@medxai/fhir-persistence`
FHIR Version: R4 (4.0.1)

---

# 1. Overview

`fhir-persistence` is the **data layer of the FHIR Embedded Stack**. It handles everything related to storing, indexing, and querying FHIR resources against a relational database — with no HTTP dependency and no FHIR server requirement.

**Responsibilities:**

- FHIR Resource CRUD (create / read / update / delete)
- Resource Version History (`{RT}_History` tables)
- FHIR Search execution (SearchParameter-driven SQL queries)
- Search Index building and maintenance (FHIRPath-based extraction)
- Reference indexing (`{RT}_References` tables)
- FHIR Bundle transaction and batch processing
- IG Schema generation (StructureDefinition + SearchParameter → DDL)
- Package Registry (installed IG version tracking in DB)
- Schema Migration (IG updates → DDL delta + apply)
- Terminology storage (CodeSystem / ValueSet from IG, stored raw in DB)
- In-memory LRU read cache (optional, disabled by default)

**Position in the stack:**

```text
FHIR Package (hl7.fhir.r4.core / hl7.fhir.us.core / medxai.core)
        │
        ▼
fhir-definition v0.4.0
  PackageManager → InMemoryDefinitionRegistry (SD / SP / CS / VS)
        │
        ▼
fhir-runtime v0.8.0
  FHIRPath Engine · Validator · SnapshotGenerator · SearchValueExtractor
        │
        ▼
fhir-persistence v2.0
  Schema Engine · Repository · Search Engine · Transaction Engine
        │
     ┌──┴──┐
     ▼     ▼
  SQLite  PostgreSQL
```

---

# 2. Design Principles

### 2.1 Strict One-Way Dependency

```text
fhir-definition → fhir-runtime → fhir-persistence
```

`fhir-persistence` imports from both `fhir-definition` (schema generation) and `fhir-runtime` (FHIRPath evaluation). Neither upstream package imports from `fhir-persistence`. This rule must never be violated.

### 2.2 Database-Agnostic via StorageAdapter

All SQL is routed through a `StorageAdapter` interface:

```text
StorageAdapter
├── SQLiteAdapter    ← default, embedded, no server required
└── PostgresAdapter  ← production, cloud, high-throughput
```

SQL dialect differences (array types, JSON operators, UPSERT syntax, index types) are fully encapsulated inside each adapter. The rest of the codebase generates adapter-aware SQL through a `SqlBuilder` helper.

### 2.3 Schema Driven by IG

The database schema is **not hardcoded**. It is generated from:

- `StructureDefinition` — defines resource types and element structure
- `SearchParameter` — defines which fields become search columns and their types

Both are loaded from `fhir-definition` at startup via `PackageManager`.

### 2.4 FHIRPath-Driven Indexing

Search index values are extracted using `extractSearchValues()` / `evalFhirPath()` from `fhir-runtime`. This is the **P0 upgrade** from the v1 (MedXAI) implementation which used an approximate path extractor (`extractPropertyPath`). Full FHIRPath support is required for correctness with US Core and custom IGs.

### 2.5 Embedded First

SQLite is the default database. It requires no server, works cross-platform, and is suitable for desktop, edge, and small-server deployments. PostgreSQL is the production-scale option, enabled via `PostgresAdapter`.

### 2.6 Single Namespace — No Multi-Tenancy

`fhir-persistence` operates in a single namespace. There is no `projectId` tenant isolation. The v1 multi-tenant design (`OperationContext.project`) is removed. If multi-tenancy is needed, it belongs in the server/application layer above `fhir-persistence`.

---

# 3. Integration Contracts

### 3.1 fhir-definition v0.4.0

`fhir-persistence` consumes `fhir-definition` for:

| Use                                            | API                                                         |
| ---------------------------------------------- | ----------------------------------------------------------- |
| Load IG packages (startup)                     | `PackageManager.loadPackages()` → `LoadPackagesOutput`      |
| Enumerate SearchParameters per resource type   | `SearchParameterResolver.resolveByResourceType(rt)`         |
| Access StructureDefinitions for DDL generation | `registry.getStructureDefinition(url)`                      |
| Persist raw CS / VS content in DB              | `registry.getCodeSystem(url)` / `registry.getValueSet(url)` |
| List loaded packages for registry comparison   | `registry.getLoadedPackages()`                              |

**Key constraints from fhir-definition:**

- Pure in-memory, zero DB operations — all persistence is our responsibility
- Does **not** expand ValueSets (raw `ValueSet` objects only)
- Does **not** manage schema versions or IG history
- `DefinitionProvider` is the minimal interface; `InMemoryDefinitionRegistry` satisfies it via structural typing

### 3.2 fhir-runtime v0.8.0

`fhir-persistence` consumes `fhir-runtime` for:

| Use                                            | API                                                  |
| ---------------------------------------------- | ---------------------------------------------------- |
| Extract search index values from resource (P0) | `extractSearchValues(resource, searchParams[])`      |
| Evaluate FHIRPath expression on resource       | `evalFhirPath(expression, resource)`                 |
| Extract outgoing references from resource      | fhir-runtime reference extractor                     |
| Optional pre-write structural validation       | `FhirRuntimeInstance.validate(resource, profileUrl)` |

**Key constraints from fhir-runtime:**

- Zero database operations — FHIRPath is a pure transformation
- Does **not** handle terminology persistence; `InMemoryTerminologyProvider` is in-memory only
- `createRuntime()` factory requires an initialized `DefinitionProvider` from fhir-definition
- fhir-persistence should hold a singleton `FhirRuntimeInstance` shared across operations

---

# 4. Module Architecture

```text
fhir-persistence
│
├── StorageAdapter
│     ├── SQLiteAdapter
│     └── PostgresAdapter
│
├── Schema Engine
│     ├── TableSchemaBuilder    (SD + SP → ResourceTableSet)
│     ├── DDLGenerator          (ResourceTableSet → DDL SQL strings)
│     └── SchemaRegistry        (in-memory: current applied schema state)
│
├── Package Registry
│     ├── PackageRegistryRepo   (fhir_packages + schema_version CRUD)
│     └── IGPersistenceManager  (orchestrate: load IG → compare → migrate → register)
│
├── Migration Engine
│     ├── MigrationRunner       (up / down / status — file-based migrations)
│     ├── SchemaDiff            (old ResourceTableSet vs new → delta)
│     └── MigrationGenerator    (delta → ADD COLUMN / CREATE INDEX / DROP INDEX SQL)
│
├── Repository Layer
│     ├── FhirStore             (facade: delegates to sub-services, public API)
│     ├── ResourceWriter        (create / update / delete)
│     ├── ResourceReader        (read / vread / everything)
│     ├── HistoryService        (readHistory / readTypeHistory — uses versionSeq ordering)
│     ├── ConditionalService    (conditionalCreate / conditionalUpdate / conditionalDelete)
│     ├── IndexingPipeline      (combines RowIndexer + ReferenceIndexer + LookupTableWriter)
│     ├── RowBuilder            (resource JSON → main table row + history row)
│     ├── RowIndexer            (resource → search index columns via fhir-runtime FHIRPath)
│     ├── ReferenceIndexer      (resource → {RT}_References rows, with targetType+targetId split)
│     └── LookupTableWriter     (resource → HumanName / Address / ContactPoint / Identifier)
│
├── Search Engine
│     ├── SearchParamParser     (URL query string → SearchRequest, values[] OR semantics)
│     ├── SearchPlanner         (plan: index strategy, filter reorder, chain depth check)
│     ├── WhereBuilder          (SearchRequest + Plan → WhereFragment[] per strategy)
│     ├── SearchSQLBuilder      (WhereFragment[] + pagination → SELECT SQL, two-phase id+content)
│     ├── SearchExecutor        (execute SQL → PersistedResource[])
│     ├── IncludeExecutor       (_include via References.targetType+targetId / _revinclude, max 1000)
│     └── SearchBundleBuilder   (PersistedResource[] → FHIR searchset Bundle)
│
├── Transaction Engine
│     ├── BundleProcessor       (transaction Bundle: atomic / batch Bundle: partial)
│     └── UrnResolver           (urn:uuid:X → real UUID pre-assignment, stores resourceType in map)
│
├── Terminology Cache
│     ├── TerminologyCodeRepo   (terminology_codes table: system + code lookup)
│     └── ValueSetRepo          (terminology_valuesets table: raw VS JSON storage)
│
├── ReindexScheduler
│     └── ReindexJob            (async background reindex with keyset pagination)
│
└── Resource Cache
      └── ResourceCache         (LRU, optional, disabled by default, cache-aside on read)
```

---

# 5. Database Schema

### 5.1 Per-Resource Table Pattern

For every FHIR R4 resource type (146 types) and every Platform IG type, three tables are generated:

| Table                       | Purpose                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `{ResourceType}`            | Current resource version + all search index columns                |
| `{ResourceType}_History`    | Immutable version snapshots (all writes append here)               |
| `{ResourceType}_References` | Outgoing FHIR references, used by `_revinclude` and chained search |

**R4 baseline**: 146 × 3 = 438 resource tables + 4 global lookup tables = **442 tables**

### 5.2 Fixed Columns (every main table)

```sql
-- Both adapters
"id"            TEXT        NOT NULL   -- FHIR resource id (UUID string)
"versionId"     TEXT        NOT NULL   -- Current version UUID (for ETag / ifMatch)
"content"       TEXT        NOT NULL   -- Full resource JSON
"lastUpdated"   TEXT        NOT NULL   -- ISO 8601 timestamp
"deleted"       INTEGER     NOT NULL   DEFAULT 0   -- 0=alive, 1=deleted (soft delete, content kept)
"_source"       TEXT
-- PostgreSQL native arrays, SQLite JSON text arrays:
"_profile"      TEXT[] / TEXT          -- declared profiles
"compartments"  TEXT[] / TEXT          -- Patient compartment IDs

-- Metadata token columns (TEXT[] format: "system|code" and "|code", NOT UUID[] hash):
"___tag"        TEXT[] / TEXT          -- meta.tag values as "system|code"
"___tagSort"    TEXT                   -- display text for :text modifier
"___security"   TEXT[] / TEXT          -- meta.security values as "system|code"
"___securitySort" TEXT
```

### 5.3 Dynamic Search Columns (per SearchParameter)

Three storage strategies, determined by `SearchParameterRegistry`:

| SP Type                                       | Strategy     | PostgreSQL Columns                  | SQLite Columns                |
| --------------------------------------------- | ------------ | ----------------------------------- | ----------------------------- |
| `string` / `uri`                              | column       | `TEXT`                              | `TEXT`                        |
| `date`                                        | column       | `TIMESTAMPTZ`                       | `TEXT` (ISO 8601)             |
| `number` / `quantity`                         | column       | `DOUBLE PRECISION`                  | `REAL`                        |
| `reference`                                   | column       | `TEXT`                              | `TEXT`                        |
| `token`                                       | token-column | `TEXT[]` + `TEXT` (2 cols)          | `TEXT` + `TEXT` (JSON arrays) |
| `name` / `address` / `telecom` / `identifier` | lookup-table | Sort `TEXT` col + global lookup row | Same                          |
| `composite` / `special`                       | skipped      | —                                   | —                             |

**Token column example** for `Patient.gender` (token):

```sql
"__gender"     TEXT[]  -- PostgreSQL: ["system|code", "|code"] (NOT UUID[] hash)
               TEXT    -- SQLite: JSON array '["system|code","|code"]'
"__genderSort" TEXT    -- display text, used for :text modifier search
```

**Note:** Token columns store `"system|code"` strings directly (not SHA-256 UUID hashes). Both `"http://loinc.org|8480-6"` and `"|8480-6"` are stored to support both system-qualified and unqualified searches.

### 5.4 Global Lookup Tables

Shared across all resource types:

```sql
HumanName    (resourceId TEXT, name TEXT, given TEXT, family TEXT)
Address      (resourceId TEXT, address TEXT, city TEXT, country TEXT, postalCode TEXT, state TEXT, use TEXT)
ContactPoint (resourceId TEXT, system TEXT, value TEXT, use TEXT)
Identifier   (resourceId TEXT, system TEXT, value TEXT)
```

### 5.5 IG Metadata Tables

```sql
fhir_packages (
  package_name  TEXT    NOT NULL,
  version       TEXT    NOT NULL,
  checksum      TEXT    NOT NULL,   -- SHA-256 of package content
  installed_at  TEXT    NOT NULL,   -- ISO 8601
  status        TEXT    NOT NULL,   -- 'active' | 'superseded'
  source        TEXT    NOT NULL DEFAULT 'bundled',  -- 'bundled' | 'npm' | 'platform'
  dependencies  TEXT,               -- JSON: {"pkg": "version"}
  PRIMARY KEY (package_name, version)
)

schema_version (
  version       INTEGER NOT NULL PRIMARY KEY,  -- auto-increment
  type          TEXT    NOT NULL DEFAULT 'ig', -- 'ig' | 'file'
  description   TEXT,
  applied_at    TEXT    NOT NULL,
  checksum      TEXT,               -- IG migration: package checksum
  package_list  TEXT    NOT NULL   -- JSON: [{name, version}]
)
```

### 5.6 Terminology Tables

```sql
terminology_codes (
  system    TEXT NOT NULL,
  code      TEXT NOT NULL,
  display   TEXT,
  PRIMARY KEY (system, code)
  -- INDEX (code) for code-only queries
)

terminology_valuesets (
  url       TEXT NOT NULL,
  version   TEXT NOT NULL DEFAULT '',  -- include version in PK
  content   TEXT NOT NULL,
  PRIMARY KEY (url, version)
)
```

---

# 6. Operational Flows

### 6.1 Initialization Flow

```text
Start
  │
  ▼
Load FHIR Packages (fhir-definition PackageManager)
  └── R4 core + US Core + medxai.core (if present)
  │
  ▼
Build InMemoryDefinitionRegistry (SD / SP / CS / VS in memory)
  │
  ▼
Connect StorageAdapter (SQLite file or PostgreSQL pool)
  │
  ▼
Check fhir_packages table
  │
  ├─[first run]─────────────────────────────────────────────
  │             TableSchemaBuilder → DDLGenerator → execute DDL
  │             Insert package rows → schema_version v1
  │
  └─[existing]──Compare checksums per package
                  │
                  ├─[no change]──────── skip, proceed
                  └─[changed / new]──── SchemaDiff → MigrationGenerator
                                        → MigrationRunner.up() → update registry
  │
  ▼
Populate terminology_codes + terminology_valuesets from registry CS/VS
  │
  ▼
Ready — FhirStore available
```

### 6.2 Resource Write Flow

```text
FHIR Resource JSON
  │
  ▼
[Optional] fhir-runtime.validate(resource, profileUrl)
  │
  ▼
RowBuilder.buildMainRow()        → id, content, lastUpdated, deleted, _source, _profile
RowBuilder.buildHistoryRow()     → versionId, id, content, lastUpdated
  │
  ▼
IndexingPipeline.run(resource)
  ├── RowIndexer.buildSearchColumns(resource, searchParams[])
  │     └── fhir-runtime: extractSearchValues(resource, sp.expression)
  │           ├── token      → TEXT[] ["system|code", "|code"] + __XSort display
  │           ├── string     → normalized lowercase TEXT (stored pre-lowercased)
  │           ├── date       → ISO range start + end
  │           ├── reference  → TEXT "ResourceType/id"
  │           └── quantity   → REAL value + system + unit
  ├── ReferenceIndexer (fhir-runtime reference extractor)
  │     └── {RT}_References rows: (resourceId, targetType, targetId, code, referenceRaw)
  └── LookupTableWriter
        └── HumanName / Address / ContactPoint / Identifier rows
  │
  ▼
Transaction Executor (single DB transaction)
  ├── INSERT/UPDATE {ResourceType}           ← main row + search columns + versionId
  ├── INSERT {ResourceType}_History          ← immutable snapshot (versionSeq ordering)
  ├── DELETE + INSERT {ResourceType}_References  ← (targetType, targetId split)
  └── DELETE + INSERT global lookup rows
  │
  ▼
Commit (or Rollback on any error)
  │
  ▼
Cache.invalidate(resourceType, id)
```

### 6.3 Search Flow

```text
FHIR Search Request  GET /Observation?code=loinc|1234-5&subject=Patient/1&_count=20
  │
  ▼
SearchParamParser
  └── SearchRequest { resourceType, params[], modifiers, includes, sort, count, offset }
  │
  ▼
SearchPlanner
  └── analyze params: reorder filters, check chain depth ≤ 2, select index strategy
  │
  ▼
WhereBuilder (per param, dispatches to strategy)
  ├── token-column   → "__code" && ARRAY[$1]::text[] (PG) / json_each (SQLite)
  ├── column         → "subject" = $2
  ├── lookup-table   → "__nameSort" LIKE LOWER($3) || '%'  (pre-normalized)
  └── reference      → JOIN {RT}_References WHERE targetType=$4 AND targetId=$5 AND code='subject'
  → WhereFragment[]
  │
  ▼
SearchSQLBuilder (two-phase)
  ├── Phase 1: SELECT "id" FROM "Observation" WHERE ... LIMIT ... OFFSET ...
  └── Phase 2: SELECT "content" FROM "Observation" WHERE "id" IN (...)
  │
  ▼
SearchExecutor → PersistedResource[]
  │
  ▼
[if _include]    IncludeExecutor via {RT}_References.targetType+targetId (max 1000)
[if _revinclude] IncludeExecutor via {SourceType}_References WHERE targetType+targetId IN (...)
  │
  ▼
SearchBundleBuilder → FHIR searchset Bundle { total, link, entry[] }
```

### 6.4 Schema Migration Flow

```text
IG version change detected (checksum mismatch in fhir_packages)
  │
  ▼
Load new SD + SP from fhir-definition registry (already in memory)
  │
  ▼
TableSchemaBuilder → new ResourceTableSet (new schema model)
  │
  ▼
SchemaDiff (current ResourceTableSet vs new ResourceTableSet)
  └── delta: { addedColumns[], removedColumns[], newIndexes[], changedExpressions[] }
  │
  ▼
MigrationGenerator → SQL migration statements
  ├── ADD COLUMN "new_search_col" TEXT
  ├── CREATE INDEX {RT}_new_search_idx ON {RT}("new_search_col")
  └── [if expression changed] → reindex: UPDATE {RT} SET col = ... for all rows
  │
  ▼
MigrationRunner.up() → apply within transaction
  │
  ▼
Update fhir_packages (status, checksum) + INSERT schema_version row
  │
  ▼
[if SearchParameter expression changed] → trigger reindex for affected resource type
```

### 6.5 Transaction Bundle Flow

```text
POST /Bundle  { type: "transaction", entry: [...] }
  │
  ▼
BundleProcessor.processTransaction(bundle)
  │
  ▼
Phase 1: Pre-assign urn:uuid → real UUID for all entries
  └── UrnResolver: build urn→uuid map
  │
  ▼
Phase 2: Deep-patch .reference fields in all entry resources
  └── UrnResolver.deepResolveUrns(entry.resource, urnMap)
  │
  ▼
Phase 3: Execute all entries inside single DB transaction
  ├── POST entry → repo._prepareCreate → repo._executeCreate
  ├── PUT entry  → repo._prepareUpdate → repo._executeUpdate
  └── DELETE entry → repo._executeDelete
  │
  ▼
Commit (success) or Rollback (any single failure → all rolled back)
  │
  ▼
Build BundleResponse { type: "transaction-response", entry[] }
```

---

# 7. StorageAdapter Design

### Interface

```typescript
interface StorageAdapter {
  execute(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  queryStream<T>(sql: string, params?: unknown[]): AsyncIterable<T>;
  prepare<T>(sql: string): PreparedStatement<T>;
  transaction<T>(fn: (tx: TransactionContext) => T | Promise<T>): Promise<T>;
  close(): Promise<void>;
}
```

### Dialect Differences

| Feature           | SQLite                                        | PostgreSQL                           |
| ----------------- | --------------------------------------------- | ------------------------------------ |
| Array columns     | `TEXT` (JSON serialized)                      | `TEXT[]` (native)                    |
| Array contains    | `JSON_EACH` sub-select                        | `col && ARRAY[...]::text[]`          |
| GIN index         | Not available (BTree only)                    | Available for `TEXT[]` / JSONB       |
| UPSERT            | `INSERT OR REPLACE` / `ON CONFLICT DO UPDATE` | `INSERT ... ON CONFLICT DO UPDATE`   |
| Timestamp         | `TEXT` (ISO 8601)                             | `TIMESTAMPTZ`                        |
| Full-text         | FTS5 (limited)                                | `pg_trgm` + trigram index            |
| Extensions needed | None                                          | `pg_trgm`, `btree_gin`               |
| Token sort search | `LOWER(col) LIKE ?`                           | `LOWER(col) LIKE $1` + trigram index |

The `WhereBuilder` and `SearchSQLBuilder` generate adapter-aware SQL through a `SqlDialect` strategy object injected from the active adapter.

---

# 8. Inherited Components from v1

The following components from the MedXAI v1 (`@medxai/fhir-persistence`) are **proven and inherited**, with targeted upgrades noted:

| Component                                                                   | Inherit Status    | Upgrade Required                                                       |
| --------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------- |
| DDL generation pipeline (`TableSchemaBuilder` + `DDLGenerator`)             | ✅ Inherit        | Adapt for SQLite dialect                                               |
| 3-table-per-resource schema design                                          | ✅ Inherit        | Remove `projectId` column                                              |
| Token column strategy (`TEXT[]` + `TEXT`, 2 cols: `__X` + `__XSort`)        | ⚠️ **Changed**    | No UUID[] hash; store `"system\|code"` strings directly                |
| Global lookup tables (HumanName / Address / ContactPoint / Identifier)      | ✅ Inherit        | —                                                                      |
| Write path (INSERT for create / UPDATE for update + History INSERT + ...)   | ✅ Inherit        | Remove `projectId`, use adapter; createResource uses INSERT not UPSERT |
| Bundle transaction / batch processing                                       | ✅ Inherit        | —                                                                      |
| WHERE builder (all modifiers + prefixes, all SP types)                      | ✅ Inherit        | Dialect-aware SQL                                                      |
| Search SQL builder (composable, parameterized)                              | ✅ Inherit        | Adapter dialect                                                        |
| MigrationRunner (up / down / status)                                        | ✅ Inherit        | Extend for IG-driven migrations                                        |
| ResourceCache (LRU, cache-aside)                                            | ✅ Inherit        | —                                                                      |
| Optimistic locking (`ifMatch` / SELECT FOR UPDATE)                          | ✅ Inherit        | SQLite equivalent                                                      |
| Soft delete semantics (`deleted=1`, history entry preserved)                | ✅ Inherit        | —                                                                      |
| Conditional ops (conditionalCreate / conditionalUpdate / conditionalDelete) | ✅ Inherit        | —                                                                      |
| **Row indexer** (search column extraction)                                  | ⚠️ **P0 Upgrade** | Replace `extractPropertyPath` with `fhir-runtime extractSearchValues`  |
| **`_include` executor**                                                     | ⚠️ **P2 Upgrade** | Use `{RT}_References` table instead of JSON scan                       |
| **Lookup-table search**                                                     | ⚠️ **P1 Upgrade** | Add JOIN-based path alongside sort-column fallback                     |
| **History / readVersion**                                                   | ⚠️ Minor          | Remove `OperationContext.project` parameter                            |
| **Adapter pattern**                                                         | ⚠️ **P5 New**     | Add `SQLiteAdapter`; extract `PostgresAdapter` from existing pg code   |

---

# 9. Platform IG Support

MedXAI maintains a custom FHIR Implementation Guide:

```text
medxai.core
```

Platform resource types (defined as FHIR `StructureDefinition`, kind=resource):

```text
User · Bot · Project · Agent · APIKey
```

The Schema Engine processes `medxai.core` identically to clinical IGs. `PackageManager` loads it alongside `hl7.fhir.r4.core`. The generated tables follow the same 3-table pattern:

```sql
User              -- current + search cols
User_History      -- version snapshots
User_References   -- outgoing references
```

No special-casing of platform resources in `fhir-persistence`. The application layer above is responsible for any access control on these resource types.

---

# 10. Future Extensions

Outside scope for v2.0, tracked as future phases:

```text
FHIR Subscriptions (R4B / R5)
Compartment-based search ($everything, /Patient/123/Observation)
Distributed search sharding (multi-node PostgreSQL)
Event sourcing / full audit log
Terminology server (full ValueSet expansion, ConceptMap translation)
FHIR REST API server layer (HTTP + routing above fhir-persistence)
```

---
