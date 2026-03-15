# FHIR Embedded Stack — Overall Architecture v2

ADR Ref: `devdocs/architecture/01–14.md`
Roadmap: `devdocs/ROADMAP.md`

---

# 1 整体依赖关系

```text
Application
     │
     ▼
┌─────────────────────────────────┐
│          fhir-runtime v0.8      │
│  FHIRPath · Validator · extractor│
└──────────────┬──────────────────┘
               │ 依赖（定义层）
               ▼
┌─────────────────────────────────┐
│        fhir-definition v0.4     │
│  PackageManager · Registry      │
│  SD / SP / CS / VS (in-memory)  │
└─────────────────────────────────┘
               │ 注入到
               ▼
┌─────────────────────────────────┐
│       fhir-persistence v2       │
│  Schema · CRUD · Search ·       │
│  Transaction · Migration ·      │
│  Terminology · Cache            │
└──────────┬──────────────────────┘
           │
   ┌───────┴────────┐
   ▼                ▼
SQLiteAdapter   PostgresAdapter
   │                │
SQLite         PostgreSQL
```

**单向依赖原则（不能反向）：**

```text
fhir-definition → fhir-runtime → fhir-persistence
```

**Stage 1 只使用 `SQLiteAdapter`（无 PostgreSQL 依赖）。**

---

# 2 fhir-definition v0.4 — 知识层

**职责：** 纯内存 FHIR 知识引擎，零 DB 依赖。

```text
fhir-definition
 ├── PackageManager        → 扫描目录、拓扑排序依赖、加载 JSON
 ├── InMemoryDefinitionRegistry
 │     ├── SD  Map<url, StructureDefinition>
 │     ├── SP  Map<resourceType, Map<code, SearchParameter>>
 │     ├── CS  Map<url, CodeSystem>
 │     └── VS  Map<url, ValueSet>
 └── DependencyResolver    → Kahn's algorithm，检测循环依赖
```

**fhir-persistence 消费的接口：**

```typescript
interface DefinitionProvider {
  getStructureDefinition(url: string): StructureDefinition | undefined;
  getSearchParameters(resourceType: string): SearchParameter[];
  getCodeSystem(url: string): CodeSystem | undefined;
  getValueSet(url: string): ValueSet | undefined;
  getAllResourceTypes(): string[]; // DDL 生成 + Reindex
  getLoadedPackages(): LoadedPackage[]; // 含 checksum，用于变更检测
}
```

---

# 3 fhir-runtime v0.8 — 逻辑层

**职责：** FHIRPath 评估、搜索值提取、Reference 提取、可选校验。

```text
fhir-runtime
 ├── FHIRPath Engine           → evalFhirPath(expr, resource)
 ├── SearchValueExtractor      → extractSearchValues(resource, params[])
 ├── ReferenceExtractor        → extractReferences(resource) → ExtractedReference[]
 └── Validator (optional)      → validate(resource, profileUrl)
```

**fhir-persistence 通过 RuntimeProvider 接口消费：**

```typescript
interface RuntimeProvider {
  extractSearchValues(
    resource: Resource,
    params: SearchParameter[],
  ): Record<string, unknown[]>;
  extractReferences(resource: Resource): ExtractedReference[];
  validate?(resource: Resource, profileUrl?: string): Promise<ValidationResult>;
}
```

---

# 4 fhir-persistence v2 — 数据层

## 4.1 完整模块树

```text
fhir-persistence v2
│
├── StorageAdapter layer
│     ├── StorageAdapter        (interface: execute/query/queryOne/queryStream/prepare/transaction)
│     ├── SqlDialect            (interface: placeholder/textArrayContains/like/limitOffset/...)
│     ├── SQLiteAdapter         ← Stage 1 唯一实现（BEGIN IMMEDIATE）
│     └── PostgresAdapter       ← Stage 7
│
├── Schema Engine
│     ├── TableSchemaBuilder    (SD + SP → ResourceTableSet)
│     ├── DDLGenerator          (.forSQLite() / .forPostgres())
│     └── SchemaRegistry        (in-memory current schema)
│
├── Package Registry
│     ├── PackageRegistryRepo   (fhir_packages + schema_version CRUD)
│     └── IGPersistenceManager  (startup: load → checksum → init or migrate)
│
├── Migration Engine
│     ├── SchemaDiff            (old ResourceTableSet vs new → SchemaDelta[])
│     │     └── oldTableSets 从 PackageRegistry 重建，非 DB introspection
│     ├── MigrationGenerator    (SchemaDelta → ADD COLUMN / CREATE INDEX SQL)
│     ├── MigrationRunner       (up/down/status + applyIGMigration)
│     │     └── IG migration forward-only（不可回滚）
│     └── ReindexScheduler      (异步 ReindexJob，keyset pagination)
│
├── Repository Layer
│     ├── FhirStore             (public facade，委托给子服务)
│     ├── ResourceWriter        (createResource INSERT / updateResource / deleteResource soft)
│     ├── ResourceReader        (readResource / vread)
│     ├── HistoryService        (readHistory / readTypeHistory，versionSeq 排序)
│     ├── ConditionalService    (conditionalCreate / Update / Delete)
│     └── IndexingPipeline      (组合 RowIndexer + ReferenceIndexer + LookupTableWriter)
│           ├── RowIndexer       (FHIRPath → search columns，string 存 lowercase)
│           ├── ReferenceIndexer (targetType + targetId split，过滤 contained)
│           └── LookupTableWriter(HumanName / Address / ContactPoint / Identifier)
│
├── Search Engine
│     ├── SearchParamParser     (URL → SearchRequest，OR 语义，modifiers，prefixes)
│     ├── SearchPlanner         (filter 重排，chain depth ≤ 2，include 策略)
│     ├── WhereBuilder          (per SP type → WhereFragment，TEXT[] token)
│     ├── SearchSQLBuilder      (两阶段：Phase1=SELECT id，Phase2=SELECT content)
│     ├── SearchExecutor
│     ├── IncludeExecutor       (_include via targetType+targetId，max 1000)
│     └── SearchBundleBuilder
│
├── Transaction Engine
│     ├── BundleProcessor       (transaction: atomic + strict order / batch: independent)
│     └── UrnResolver           (buildUrnMap 含 resourceType，deepResolveUrns depth=20)
│
├── Terminology Engine
│     ├── TerminologyCodeRepo   (terminology_codes: display cache，INDEX(code))
│     └── ValueSetRepo          (terminology_valuesets PRIMARY KEY (url, version))
│
└── Resource Cache
      └── ResourceCache         (LRU，optional，disabled by default)
```

---

# 5 数据库 Schema 核心设计

## 5.1 每个 Resource Type 三张表

```text
{RT}              — 当前版本 + 所有搜索列（fixed + dynamic）
{RT}_History      — 不可变版本快照，versionSeq AUTOINCREMENT 排序
{RT}_References   — outgoing references，targetType + targetId 分列
```

R4 baseline: **146 × 3 = 438 tables** + 4 lookup tables + 6 IG/terminology tables

## 5.2 固定列（每张主表）

```sql
"id"          TEXT NOT NULL              -- FHIR UUID
"versionId"   TEXT NOT NULL              -- 当前版本 UUID（ETag）
"content"     TEXT NOT NULL              -- 完整 resource JSON
"lastUpdated" TEXT NOT NULL              -- ISO 8601
"deleted"     INTEGER NOT NULL DEFAULT 0 -- 0=alive, 1=soft-deleted（content 保留）
"_profile"    TEXT                       -- SQLite: JSON array of profile URLs
"compartments"TEXT                       -- SQLite: JSON array of Patient IDs
```

## 5.3 Token 列策略（TEXT[]，非 UUID[] 哈希）

```sql
-- 示例：Patient.gender
"__gender"     TEXT    -- SQLite: JSON array '["http://hl7.org/gender|male","|male"]'
"__genderSort" TEXT    -- display text for :text modifier
```

**双格式存储：** `"system|code"` + `"|code"`，支持有无 system 的 FHIR 搜索。

## 5.4 References 表

```sql
CREATE TABLE "Patient_References" (
  resourceId   TEXT NOT NULL,
  targetType   TEXT NOT NULL,   -- 'Organization'（从 reference 字符串解析）
  targetId     TEXT NOT NULL,   -- UUID
  code         TEXT NOT NULL,   -- SP code，如 'managingOrganization'
  referenceRaw TEXT             -- 完整原始 reference（绝对 URL 时非 null）
);
CREATE INDEX ... ON (targetType, targetId, code);
```

---

# 6 关键流程

## 6.1 启动流程

```text
loadDefinitionPackages()          → InMemoryDefinitionRegistry
createRuntime({ definitions })    → FhirRuntimeInstance (singleton)
StorageAdapter.connect()          → SQLite / PostgreSQL
IGPersistenceManager.initialize()
  ├─[首次] TableSchemaBuilder → DDLGenerator → execute DDL → INSERT fhir_packages
  └─[已有] checksum 比对 → SchemaDiff → MigrationRunner.applyIGMigration()
FhirStore ready
```

## 6.2 资源写入流程

```text
FhirStore.createResource(resource)
  ├── [optional] validate(resource)
  ├── RowBuilder.buildMainRow()         → id, versionId, content, lastUpdated
  ├── IndexingPipeline.run(resource)
  │     ├── RowIndexer → search columns（TEXT[] token，lowercase string）
  │     ├── ReferenceIndexer → References rows（targetType + targetId）
  │     └── LookupTableWriter → HumanName / Address / ... rows
  └── transaction(BEGIN IMMEDIATE)
        ├── INSERT {RT}
        ├── INSERT {RT}_History
        ├── DELETE + INSERT {RT}_References
        └── DELETE + INSERT lookup rows
```

## 6.3 搜索流程

```text
FhirStore.search('Observation?code=loinc|1234-5&subject=Patient/1&_count=20')
  ├── SearchParamParser → SearchRequest
  ├── SearchPlanner → SearchPlan（filter 重排，chain depth 检查）
  ├── WhereBuilder → WhereFragment[]
  │     ├── token: json_each(value, '$') WHERE value IN ('loinc|1234-5','|1234-5')
  │     └── reference: JOIN Observation_References WHERE targetType='Patient' AND targetId='1'
  ├── SearchSQLBuilder (两阶段)
  │     ├── Phase 1: SELECT "id" FROM "Observation" WHERE ... LIMIT 20
  │     └── Phase 2: SELECT "content" FROM "Observation" WHERE "id" IN (...)
  ├── SearchExecutor → PersistedResource[]
  ├── IncludeExecutor（如有 _include/_revinclude）
  └── SearchBundleBuilder → FHIR searchset Bundle
```

## 6.4 Transaction Bundle 流程

```text
POST Bundle { type: "transaction", entry: [...] }
  ├── Phase 1: UrnResolver.buildUrnMap()  → Map<urn, {id, resourceType}>
  ├── Phase 2: UrnResolver.deepResolveUrns()  → patch all .reference fields（depth≤20）
  └── Phase 3: 严格按 entry 顺序执行（不 reorder）
        ├── BEGIN IMMEDIATE
        ├── entry[0]: createResource / updateResource / ...
        ├── entry[1]: ...
        └── COMMIT（任一失败 → ROLLBACK ALL）
```

---

# 7 核心工程原则

| 原则                | 规则                                         |
| ------------------- | -------------------------------------------- |
| **单向依赖**        | definition → runtime → persistence，禁止反向 |
| **无多租户**        | 无 projectId，单命名空间，多租户由上层处理   |
| **IG 驱动**         | schema 不 hardcode，从 SD + SP 生成          |
| **嵌入优先**        | SQLite 为默认，无需 server                   |
| **TEXT[] token**    | 不使用 UUID[] 哈希，存 `system\|code` 字符串 |
| **IG 迁移单向**     | IG 升级后不支持 migration down，需备份恢复   |
| **软删除保留内容**  | deleted=1 保留 content，History 完整保存     |
| **optimistic lock** | SQLite: BEGIN IMMEDIATE；PG: versionId CAS   |

---

# 8 Embedded vs Server 对比

| 特性          | Embedded（本项目）       | 传统 FHIR Server   |
| ------------- | ------------------------ | ------------------ |
| 运行方式      | in-process library       | 独立进程/服务      |
| 数据库        | SQLite（embedded）       | PostgreSQL / MySQL |
| 网络依赖      | 无                       | 必须 HTTP          |
| 部署复杂度    | 极低（单文件）           | 高（server + DB）  |
| 适用场景      | desktop / edge / CI      | cloud / production |
| 扩展至 server | Stage 7: PostgresAdapter | —                  |

类似产品：SQLite、DuckDB——**Embedded Architecture**。

---

# 9 未来扩展（Stage 7+）

```text
FHIR Server 阶段（非本项目范围）：

fhir-server（HTTP layer）
      │
      ▼
fhir-persistence（本项目）
      │
      ▼
PostgresAdapter → PostgreSQL
```

fhir-persistence 本身不含 HTTP 层，与 server 的集成由上层（fhir-server package）完成。
