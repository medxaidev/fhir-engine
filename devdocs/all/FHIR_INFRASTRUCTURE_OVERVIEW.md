# FHIR 基础设施总体架构

**文档类型：** 主架构参考文档
**状态：** 生效
**版本：** 1.1.0
**日期：** 2026-03-15
**范围：** FHIR 全生态 — 基础设施到平台层

---

## 1. 文档目的

本文档是整个 FHIR 生态系统的**权威架构参考**，用于：

- 定义各模块边界与职责
- 规定依赖关系（硬约束，不可违反）
- 统一数据库与 IG 支持要求
- 规定测试标准
- 定义 API 契约边界
- 指导开发优先级与推进顺序

**所有模块级架构决策必须与本文档保持一致。**

---

## 2. 生态系统层次架构

整个生态分为 **4 层**：

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 4 — 企业平台 (MedXAI)                                       │
│                                                                      │
│  medxai-cloud  medxai-server  medxai-auth  medxai-admin             │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 3 — 开发者平台                                               │
│                                                                      │
│  fhir-cli（独立 repo）                                              │
│                                                                      │
│  fhir-studio monorepo:                                              │
│    fhir-server   fhir-client   fhir-react   studio(IDE)             │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2 — FHIR 引擎层                                             │
│                                                                      │
│  fhir-engine                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 1 — FHIR 核心基础设施                                       │
│                                                                      │
│  fhir-definition   fhir-runtime   fhir-persistence                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 关于 fhir-cli 的位置说明

**fhir-cli 是 Layer 3 的具体应用，不是引擎层。** 它直接嵌入 `fhir-engine`（不走 HTTP），
为开发者提供命令行操作界面。`fhir-cli` 的配置加载模式（`fhir.config.json`）是后续
`fhir-server` 也将复用的标准初始化模式。

---

## 3. 调用链架构

### 3.1 完整远程调用链（生产环境）

```
应用程序 (Application)
      │
      ▼
fhir-client (HTTP SDK)          ← Layer 3，仅 HTTP 调用
      │  HTTP/REST
      ▼
fhir-server                     ← Layer 3，HTTP 服务
      ├── HTTP Router（内部）
      ├── FHIR REST Controller
      ├── Bundle Processor
      │
      ▼
fhir-engine                     ← Layer 2，运行时内核
      │  createFhirEngine(config)
      ▼
fhir-persistence                ← Layer 1，存储引擎
      │
      ▼
SQLite / PostgreSQL
```

### 3.2 嵌入式调用链（CLI / 开发工具）

```
fhir-cli                        ← Layer 3，命令行工具
      │  createFhirEngine(config)
      ▼
fhir-engine                     ← Layer 2，直接嵌入
      │
      ▼
fhir-persistence (SQLite)       ← Layer 1
```

### 3.3 内部依赖链（自下而上）

```
fhir-definition                 (零外部依赖)
      ↓  DefinitionProvider 接口
fhir-runtime                    (依赖: fhir-definition)
      ↓  FhirDefinitionBridge, FhirRuntimeProvider
fhir-persistence                (依赖: fhir-definition, fhir-runtime)
      ↓  FhirSystem, FhirPersistence
fhir-engine                     (依赖: 上述三个)
      ↓  createFhirEngine()
fhir-cli / fhir-server          (Layer 3 应用，使用 fhir-engine)
```

---

## 4. 模块清单与状态

| 模块               | 版本   | 层次  | 状态         | 描述                                    |
| ------------------ | ------ | ----- | ------------ | --------------------------------------- |
| `fhir-definition`  | 0.5.0  | L1    | ✅ 稳定      | FHIR 知识引擎 — 定义加载与注册          |
| `fhir-runtime`     | 0.8.1  | L1    | ✅ 稳定      | FHIR 运行时 — 解析、验证、FHIRPath      |
| `fhir-persistence` | 0.1.0  | L1    | 🔧 Beta     | 存储引擎 — CRUD、搜索、迁移             |
| `fhir-engine`      | 0.0.1  | L2    | 🔧 Alpha    | 引擎内核 — 组装 L1 组件（SQLite 可用）  |
| `fhir-cli`         | —      | L3    | 📋 规划中   | 开发者命令行工具                        |
| `fhir-server`      | —      | L3    | 📋 规划中   | FHIR REST API 服务器（fhir-studio monorepo） |
| `fhir-client`      | —      | L3    | 📋 规划中   | HTTP SDK（fhir-studio monorepo）        |
| `fhir-react`       | —      | L3    | 📋 规划中   | React 组件库（fhir-studio monorepo）    |
| `fhir-studio`      | —      | L3    | 📋 规划中   | FHIR 开发者 IDE（fhir-studio monorepo） |
| `medxai-server`    | —      | L4    | 🔮 未来      | 企业级 FHIR 服务器                      |
| `medxai-auth`      | —      | L4    | 🔮 未来      | SMART on FHIR / OAuth2 认证             |

---

## 5. 依赖规则（硬约束）

### 5.1 允许的依赖方向

| 模块               | 允许依赖                                          |
| ------------------ | ------------------------------------------------- |
| `fhir-definition`  | 无（零外部依赖）                                   |
| `fhir-runtime`     | `fhir-definition`（通过 DefinitionProvider 接口） |
| `fhir-persistence` | `fhir-definition`, `fhir-runtime`                 |
| `fhir-engine`      | `fhir-definition`, `fhir-runtime`, `fhir-persistence` |
| `fhir-cli`         | `fhir-engine`（仅此一个）                         |
| `fhir-server`      | `fhir-engine`                                     |
| `fhir-client`      | 无 fhir-* 运行时依赖（纯 HTTP SDK）               |

### 5.2 禁止的依赖（绝对禁止）

| 模块               | 禁止引入                                               |
| ------------------ | ------------------------------------------------------ |
| `fhir-definition`  | 任何其他 fhir-* 包                                     |
| `fhir-runtime`     | `fhir-persistence`, `fhir-engine`, `fhir-server`       |
| `fhir-persistence` | `fhir-engine`, `fhir-server`                           |
| `fhir-engine`      | `fhir-server`, `fhir-client`, `fhir-studio`            |
| `fhir-cli`         | `fhir-definition`, `fhir-runtime`, `fhir-persistence`（必须通过 fhir-engine） |

### 5.3 阻断原则

> **如果所依赖的包功能缺失，下游包的开发必须中断，等待上游包完成后再继续。**

不允许用生产代码中的 Mock、Workaround 或循环依赖绕过此规则。

---

## 6. 设计原则

### P1 — 单向依赖
所有依赖严格向下流动，绝无循环引用。`DefinitionProvider` 接口是范例：
`fhir-runtime` 通过 TypeScript 结构化类型消费该接口，不直接 import `fhir-definition`。

### P2 — 接口驱动集成
每个层次边界由 TypeScript 接口契约定义：

| 边界                        | 接口                     |
| --------------------------- | ------------------------ |
| fhir-definition → runtime   | `DefinitionProvider`     |
| fhir-runtime → persistence  | `RuntimeProvider`        |
| fhir-persistence → engine   | `StorageAdapter`         |
| fhir-engine → 应用层        | `FhirEngine`             |

### P3 — 核心层无 HTTP
Layer 1 与 Layer 2（fhir-definition / fhir-runtime / fhir-persistence / fhir-engine）
不包含任何 HTTP、REST 或网络代码。HTTP 仅在 Layer 3 引入（fhir-server / fhir-client）。

### P4 — 核心层无 UI
Layer 1–2 不包含任何 UI 代码、React 组件或浏览器专用 API。

### P5 — fhir-definition 零依赖
`fhir-definition` 保持零外部运行时依赖，确保可在任何环境中嵌入使用。

### P6 — 快速失败 & 明确错误
所有模块抛出带模块前缀的描述性类型化错误（如 `fhir-engine: ...`），不允许静默失败。

---

## 7. 数据库支持

### 7.1 支持矩阵

| 数据库                    | 目标环境                      | 状态                         | 优先级   |
| ------------------------- | ----------------------------- | ---------------------------- | -------- |
| SQLite (better-sqlite3)   | Node.js / Electron / CLI      | ✅ 已实现并测试               | **P0**   |
| PostgreSQL                | 生产服务器 / 企业部署         | 🔧 适配器存在但未导出         | **P1**   |
| SQLite WASM (sql.js)      | 浏览器                        | ⚠️ 已实现，**实用价值有限**   | P3（低） |

> **关于浏览器 SQLite（sql.js/WASM）：** 浏览器端直接运行 FHIR 引擎的场景极为罕见，
> 实用意义不大。fhir-studio 前端通过 `fhir-client` → `fhir-server` 访问数据，
> 无需在浏览器中嵌入 SQLite。此功能保留但不投入主要开发资源。

### 7.2 PostgreSQL 解除阻断路径

`PostgresAdapter` 已在 `fhir-persistence/src/db/` 中存在，但：
- 未从 `fhir-persistence/src/index.ts` 导出
- SQL 参数化使用 `?` 占位符（SQLite 风格），PostgreSQL 需要 `$N` 风格
- 无 PostgreSQL 测试套件

**解除阻断任务（按顺序）：**
1. `fhir-persistence`：修复 SQL 参数化方言（`?` → `$N`）
2. `fhir-persistence`：添加 PostgreSQL 完整测试套件（每条关键路径 5+ 测试）
3. `fhir-persistence`：从 `index.ts` 导出 `PostgresAdapter`
4. `fhir-engine`：连接 `PostgresAdapter`（`adapter-factory.ts`）
5. `fhir-engine`：添加 PostgreSQL 集成测试

### 7.3 方言特定搜索优化

| 功能                  | SQLite                        | PostgreSQL                       |
| --------------------- | ----------------------------- | -------------------------------- |
| 全文搜索              | FTS5 虚拟表（待实现）         | `tsvector` / GIN 索引（待实现）  |
| Token 搜索            | Lookup 表 + B-tree ✅         | GIN on JSONB（待实现）           |
| 两阶段搜索            | ID 优先查询 ✅                | CTE + LIMIT/OFFSET               |
| 并发写入              | WAL 模式 ✅                   | MVCC 原生                        |
| 连接池                | 不适用                        | `pg` pool 配置（待设计）         |

---

## 8. FHIR IG 支持要求

### 8.1 必须支持的 FHIR 版本

| 版本       | 状态          | 包名                        |
| ---------- | ------------- | --------------------------- |
| FHIR R4    | ✅ 必须支持   | `hl7.fhir.r4.core@4.0.1`   |
| FHIR R4B   | 🔮 未来       | `hl7.fhir.r4b.core`         |
| FHIR R5    | 🔮 未来       | `hl7.fhir.r5.core`          |

### 8.2 必须支持的 IG

| IG             | 状态          | 包名                         |
| -------------- | ------------- | ---------------------------- |
| US Core        | ✅ 必须支持   | `hl7.fhir.us.core@6.x`      |
| 自定义 IG      | ✅ 必须支持   | 用户自定义                   |
| 其他 HL7 IG    | 🔧 尽力支持   | 可变                         |

### 8.3 IG 加载机制

所有 IG 遵循 NPM 包约定（`package.json` + `package/` 目录），通过
`fhir-definition` 的拓扑排序（Kahn 算法）按依赖顺序加载。

### 8.4 动态 IG 升级流水线

```
fhir-definition 加载新 IG 版本
      ↓
fhir-persistence: SchemaDiff → 检测表结构变化
      ↓
fhir-persistence: MigrationGenerator → 生成 ALTER TABLE / CREATE 语句
      ↓
fhir-persistence: MigrationRunnerV2 → 应用迁移，记录历史
      ↓
fhir-persistence: ReindexScheduler → 对受影响资源重新索引
```

此流水线幂等：对未变化的 IG 重新运行结果为 `action: 'consistent'`，无副作用。

---

## 9. 测试要求

### 9.1 最低覆盖率规则

> **每个关键行为必须有最少 5 个测试用例。**

"关键行为"包含所有：
- 公开 API 方法
- 错误条件（类型化错误）
- 边界条件（空输入、null、最大值）
- 模块间集成点
- SQL 查询生成路径

### 9.2 测试类型矩阵

| 测试类型       | fhir-definition | fhir-runtime | fhir-persistence  | fhir-engine   |
| -------------- | --------------- | ------------ | ----------------- | ------------- |
| 单元测试       | ✅              | ✅           | ✅                | ⚠️ 不足       |
| 集成测试       | ✅              | ✅           | ✅ (SQLite)        | ⚠️ 不足       |
| 契约测试       | ✅              | ✅           | 需要              | 需要          |
| 性能测试       | ✅              | 需要         | 需要              | 需要          |
| E2E 测试       | 不适用          | 不适用       | ✅                | 需要          |
| 方言测试       | 不适用          | 不适用       | SQLite ✅ / PG ❌ | 需要          |

### 9.3 当前测试数量

| 模块               | 测试数量 | 状态            |
| ------------------ | -------- | --------------- |
| fhir-definition    | 236      | ✅ 通过         |
| fhir-runtime       | 4,153    | ✅ 通过         |
| fhir-persistence   | 待统计   | 🔧 SQLite 部分  |
| fhir-engine        | 待统计   | 🔧 Alpha 不足   |

---

## 10. API 契约边界

### 10.1 fhir-definition 公开 API 核心

```typescript
interface DefinitionRegistry {
  register(resource: FhirDefinitionResource): void
  getStructureDefinition(url: string): StructureDefinition | undefined
  getValueSet(url: string): ValueSet | undefined
  getCodeSystem(url: string): CodeSystem | undefined
  getSearchParameters(resourceType: string): SearchParameter[]
  getStatistics(): RegistryStatistics
}

// 便捷加载函数
function loadFromDirectory(path: string): DefinitionRegistry
function loadDefinitionPackages(path: string): { registry, result }
async function loadPackagesByName(pkgs: NamedPackageSpec[]): Promise<{ registry, packages }>
```

### 10.2 fhir-runtime 公开 API 核心

```typescript
async function createRuntime(options?: RuntimeOptions): Promise<FhirRuntimeInstance>

interface FhirRuntimeInstance {
  validate(resource: unknown, profileUrl?: string): Promise<ValidationResult>
  evalFhirPath(expression: string, resource: unknown): unknown[]
  extractAllSearchValues(resource: unknown, params: SearchParameter[]): SearchIndexEntry[]
  extractReferences(resource: unknown): ReferenceInfo[]
  generateCapabilityStatement(baseUrl: string): CapabilityStatement
}
```

### 10.3 fhir-persistence 公开 API 核心

```typescript
class FhirPersistence {
  createResource(type: string, resource: FhirResource, opts?): Promise<PersistedResource>
  readResource(type: string, id: string): Promise<PersistedResource>
  updateResource(type: string, id: string, resource: FhirResource, opts?): Promise<PersistedResource>
  deleteResource(type: string, id: string): Promise<void>
  searchResources(options: SearchOptions): Promise<SearchResult>
  processBundle(bundle: FhirResource): Promise<FhirResource>
  getHistory(type: string, id: string): Promise<HistoryBundle>
}
```

### 10.4 fhir-engine 公开 API 核心

```typescript
async function createFhirEngine(config: FhirEngineConfig): Promise<FhirEngine>

interface FhirEngine {
  definitions: DefinitionRegistry       // fhir-definition
  runtime: FhirRuntimeInstance          // fhir-runtime
  persistence: FhirPersistence          // fhir-persistence（CRUD 门面）
  adapter: StorageAdapter               // 原始 DB 适配器
  sdRegistry: StructureDefinitionRegistry
  spRegistry: SearchParameterRegistry
  igResult: { action: 'new' | 'upgrade' | 'consistent' }
  resourceTypes: string[]
  status(): FhirEngineStatus            // ← v0.1.0 新增（当前缺失）
  stop(): Promise<void>
}
```

---

## 11. 开发阶段

### 阶段 1 — 核心基础设施（已完成）

```
✅ fhir-definition v0.5.0
✅ fhir-runtime v0.8.1
✅ fhir-persistence v0.1.0（SQLite 完整）
✅ fhir-engine v0.0.1（SQLite，bootstrap + plugin 可用）
```

### 阶段 2 — 开发工具（进行中）

```
🔧 fhir-engine v0.1.0：
   - 添加 engine.status() 方法
   - 完善测试套件
📋 fhir-cli v0.1.0 MVP：
   - fhir.config.json 配置加载器（fhir-server 将复用此模式）
   - 核心命令：new, resource, query, validate, path, ig, doctor
```

### 阶段 3 — fhir-server + PostgreSQL 解除阻断

```
📋 fhir-persistence：PostgreSQL 完整支持
📋 fhir-engine v0.2.0：PostgreSQL 连接
📋 fhir-server v0.1.0：FHIR R4 REST API（HTTP Router + 控制器）
📋 fhir-client v0.1.0：HTTP SDK
```

### 阶段 4 — 开发者平台（fhir-studio）

```
📋 fhir-react v0.1.0
📋 fhir-studio v0.1.0：Server Explorer + Resource Studio + Query Studio
```

### 阶段 5 — 企业平台（MedXAI）

```
🔮 medxai-server / medxai-auth / medxai-cloud / medxai-admin
```

---

## 12. 质量门控

每个模块发布前必须满足所有质量门控条件：

### Gate 1 — 完整性
- [ ] 所有公开 API 方法已文档化
- [ ] 所有错误类型已导出并文档化
- [ ] CHANGELOG 已更新

### Gate 2 — 测试
- [ ] 每条关键行为最少 5 个测试用例
- [ ] 100% 测试通过
- [ ] 与直接依赖的集成测试
- [ ] 无无理由跳过的测试

### Gate 3 — 依赖合规
- [ ] 无循环依赖（通过 `madge` 或等效工具验证）
- [ ] 无禁止的跨层引用
- [ ] `package.json` 中对等依赖版本锁定

### Gate 4 — 数据库支持
- [ ] SQLite 测试通过（fhir-persistence 起）
- [ ] PostgreSQL 测试通过（fhir-server 相关模块必须）

---

## 13. 关键架构决策

### ADR-001 — fhir-runtime 不直接引入 fhir-definition

**决策：** `fhir-runtime` 通过 TypeScript 结构化类型消费 `DefinitionProvider` 接口（4 个方法）。
**理由：** 解耦验证引擎与加载引擎。`fhir-runtime` 可与任何定义源配合使用。

### ADR-002 — 每资源类型 3 张表

**决策：** 每个资源类型创建 3 张表：`{type}_main`、`{type}_history`、`{type}_references`。
**理由：** 清晰分离当前状态（main）、版本历史（history）和引用图（references）。

### ADR-003 — IG 驱动的动态 Schema 迁移

**决策：** Schema 不硬编码，由 IG 中的 StructureDefinition + SearchParameter 动态生成，
通过 `SchemaDiff` + `MigrationGenerator` + `MigrationRunnerV2` 实现幂等迁移。
**理由：** 支持自定义 IG、US Core 以及未来 FHIR R5，无需修改源代码。

### ADR-004 — fhir-engine 插件系统

**决策：** `fhir-engine` 暴露 `init → start → ready → stop` 4 阶段生命周期钩子。
**理由：** 允许 `fhir-server` 注册 HTTP 监听器，`fhir-cli` 注册命令处理器，无需修改引擎核心。

### ADR-005 — PostgreSQL 在 fhir-engine v0.0.1 中阻断

**决策：** v0.0.1 中 PostgreSQL 配置抛运行时错误，明确标记为未完成。
**理由：** 避免发布未经测试的代码路径。PostgreSQL 解除阻断显式追踪。

### ADR-006 — fhir-cli 配置加载模式是 fhir-server 的标准

**决策：** `fhir-cli` 定义的 `fhir.config.json` 格式和加载代码（`config-loader.ts`）
是 `fhir-engine` 初始化的**规范模式**，`fhir-server` 将直接复用此模式。
**理由：** 统一配置格式，确保 CLI 和 Server 的 engine 初始化行为一致。

---

## 14. fhir-studio Monorepo 结构（预览）

```
fhir-studio/                     ← monorepo 根
├── packages/
│   ├── fhir-server/             ← FHIR REST API 服务器（独立 npm 包）
│   ├── fhir-client/             ← HTTP SDK（独立 npm 包）
│   ├── fhir-react/              ← React 组件库（独立 npm 包）
│   └── studio/                  ← IDE 应用（Electron / Web）
├── package.json                 ← monorepo 根（pnpm workspaces）
└── turbo.json                   ← 构建流水线（Turborepo）
```

---

## 15. 推进 fhir-cli 前置条件分析

### 当前可用状态

| 模块               | CLI 所需功能                              | 状态        |
| ------------------ | ----------------------------------------- | ----------- |
| fhir-definition    | 包加载、注册表查询                        | ✅ 完整     |
| fhir-runtime       | validate()、evalFhirPath()                | ✅ 完整     |
| fhir-persistence   | CRUD、search（SQLite）                    | ✅ 基本完整 |
| fhir-engine v0.0.1 | createFhirEngine()、engine.persistence    | ✅ 基本可用 |
| fhir-engine v0.0.1 | engine.status()                           | ❌ 缺失     |

### 必须完成（阻断 fhir-cli 开发）

| 编号 | 任务                                          | 所属模块     | 工作量 | 优先级   |
| ---- | --------------------------------------------- | ------------ | ------ | -------- |
| M-1  | 添加 `engine.status()` 方法                   | fhir-engine  | 小     | **P0**   |
| M-2  | 完善 fhir-engine 测试套件（5+/关键路径）      | fhir-engine  | 中     | **P0**   |
| M-3  | 设计 `fhir.config.json` 格式（规范化）        | fhir-cli     | 小     | **P0**   |
| M-4  | 实现 `config-loader.ts`（engine 初始化入口）  | fhir-cli     | 小     | **P0**   |

### 不阻断 fhir-cli（无需等待）

| 项目                     | 理由                                                |
| ------------------------ | --------------------------------------------------- |
| PostgreSQL 支持          | fhir-cli MVP 使用 SQLite 即可                       |
| fhir-engine 服务层封装   | fhir-cli 直接调用 `engine.persistence`，无需中间层  |
| fhir-server              | 完全独立项目，不影响 fhir-cli                       |
| 浏览器 SQLite WASM       | 与 CLI 无关                                         |
| FTS5 / GIN 全文搜索优化  | 属于 fhir-persistence 后续优化，不阻断              |

### 推荐执行顺序

```
Week 1:  fhir-engine v0.1.0
         ├── 添加 engine.status()（约 50 行）
         └── 补充测试套件（bootstrap + plugin lifecycle + E2E）

Week 2+: fhir-cli v0.1.0 开发
         ├── fhir.config.json 格式定义（本文件将被 fhir-server 复用）
         ├── config-loader.ts（核心初始化逻辑）
         ├── fhir new（脚手架生成）
         ├── fhir resource create/get/update/delete
         ├── fhir query
         ├── fhir validate
         ├── fhir path
         ├── fhir ig list/load/install
         └── fhir doctor
```

---

*FHIR 基础设施总体架构 v1.1.0*
