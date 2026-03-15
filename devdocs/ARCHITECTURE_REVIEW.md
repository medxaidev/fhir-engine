# fhir-engine — 架构评审

**文档类型：** 架构评审
**评审日期：** 2026-03-15
**模块版本：** 0.0.1
**评审基准：** FHIR_INFRASTRUCTURE_OVERVIEW v1.1.0
**状态：** ⚠️ 条件通过 — PostgreSQL 阻断，测试覆盖不足

---

## 1. 评审摘要

`fhir-engine` 是 **FHIR 运行时内核（Layer 2）** — 将 `fhir-definition`、`fhir-runtime`、
`fhir-persistence` 组装为一个运行中的 FHIR 系统的单一启动入口。

**架构位置：**
- Layer 2：fhir-engine（引擎层）
- 上游消费方：`fhir-cli`（Layer 3，直接嵌入）、`fhir-server`（Layer 3，HTTP 包装）

**结论：** Bootstrap 架构正确，插件系统可用，SQLite 路径功能完整。
两个阻断问题需解决：
1. PostgreSQL 支持显式抛异常（来自 fhir-persistence 的上游阻断）
2. 测试套件严重不足，关键路径未达到 5+ 测试要求

> **已修正认知：** 之前版本将"服务层缺失"（ResourceService、SearchService 等）列为
> Critical Gap 是错误判断。fhir-engine 不需要服务层封装。
> `fhir-cli` 和 `fhir-server` 分别作为 Layer 3 应用，直接调用 `engine.persistence`
> 和 `engine.runtime`。HTTP 控制器逻辑属于 `fhir-server` 内部，不属于引擎层。

---

## 2. 当前架构概览

### 2.1 模块结构

```
fhir-engine/src
├── engine.ts          # createFhirEngine() — 启动编排（204 行）
├── adapter-factory.ts # createAdapter() — DatabaseConfig → StorageAdapter
├── types.ts           # FhirEngineConfig, FhirEngine, EngineContext, FhirEnginePlugin, Logger
├── logger.ts          # createConsoleLogger() — 默认控制台日志
└── index.ts           # 公开 API barrel
```

**5 个文件，有意保持最小化 — 组合而非实现。**

### 2.2 启动序列

```
createFhirEngine(config)
      │
      ├─► 0. validateConfig()               — 验证必填字段，缺失则抛异常
      ├─► 1. loadDefinitionPackages()       — fhir-definition：扫描并加载包
      ├─► 2. createRuntime({ definitions }) — fhir-runtime：接入 DefinitionBridge
      ├─► 3. new FhirDefinitionBridge()     — fhir-persistence：桥接 Schema 生成
      ├─► 4. new FhirRuntimeProvider()      — fhir-persistence：桥接 FHIRPath 索引
      ├─► 5. createAdapter(config.database) — fhir-persistence：创建存储适配器
      ├─► 6. Plugin init() 钩子             — 持久化就绪之前执行
      ├─► 7. FhirSystem.initialize()        — fhir-persistence：Schema + 迁移 + 持久化初始化
      ├─► 8. Plugin start() 钩子            — 持久化已就绪
      ├─► 9. Plugin ready() 钩子            — 系统完全运行
      └─► 10. 返回 FhirEngine               — 应用持有的稳定句柄
```

### 2.3 FhirEngine 返回结构

```typescript
interface FhirEngine {
  definitions: DefinitionRegistry         // fhir-definition
  runtime: FhirRuntimeInstance            // fhir-runtime
  persistence: FhirPersistence            // fhir-persistence（CRUD 门面）
  adapter: StorageAdapter                 // 原始 DB 适配器
  sdRegistry: StructureDefinitionRegistry
  spRegistry: SearchParameterRegistry
  igResult: { action: 'new' | 'upgrade' | 'consistent' }
  resourceTypes: string[]
  logger: Logger
  context: EngineContext
  // ⚠️ 缺失 status() — 需在 v0.1.0 添加
  stop(): Promise<void>
}
```

### 2.4 Layer 3 使用方式对比

| 使用方   | 调用方式                        | HTTP 层 |
| -------- | ------------------------------- | ------- |
| fhir-cli | `createFhirEngine()` 直接嵌入  | 无      |
| fhir-server | `createFhirEngine()` + HTTP Router | 有（内部自建） |

两者都通过 `engine.persistence` 执行 CRUD，通过 `engine.runtime` 执行验证和 FHIRPath。
**fhir-server 的 HTTP 控制器、Bundle 路由等完全属于 fhir-server 内部实现，与 fhir-engine 无关。**

### 2.5 数据库支持矩阵

| 类型          | 适配器                    | v0.0.1 状态             |
| ------------- | ------------------------- | ----------------------- |
| `sqlite`      | `BetterSqlite3Adapter`    | ✅ 可用                 |
| `sqlite-wasm` | `SQLiteAdapter`           | ✅ 存在（低优先级）      |
| `postgres`    | `PostgresAdapter`         | ❌ 显式抛运行时异常      |

**来自 adapter-factory.ts 的实际错误信息：**
```
"fhir-engine: PostgreSQL adapter is not yet available.
PostgresAdapter is not exported from fhir-persistence v0.1.0."
```

---

## 3. 合规性评估

### 3.1 对照架构原则

| 原则                        | 状态 | 证据                                                       |
| --------------------------- | ---- | ---------------------------------------------------------- |
| P1 — 单向依赖               | ✅   | 仅依赖三个 Layer 1 包，无反向引用                          |
| P2 — 接口驱动集成           | ✅   | FhirEnginePlugin、FhirEngine、EngineContext 均为接口       |
| P3 — 核心层无 HTTP          | ✅   | 无任何 HTTP 代码，HTTP 属于 fhir-server                    |
| P4 — 核心层无 UI            | ✅   | 纯 Node.js                                                 |
| P6 — 快速失败 & 明确错误    | ✅   | 所有错误均带 `fhir-engine: ` 前缀，配置验证显式报错        |

### 3.2 对照数据库支持要求

| 要求                    | 状态    | 说明                                         |
| ----------------------- | ------- | -------------------------------------------- |
| SQLite (BetterSqlite3)  | ✅      | 完全可用                                     |
| PostgreSQL              | ❌      | 显式阻断，需先修复 fhir-persistence          |
| 浏览器 SQLite WASM      | ⚠️      | 存在但低优先级，不投入主要资源               |

### 3.3 对照测试要求

| 要求                           | 状态 | 说明                                          |
| ------------------------------ | ---- | --------------------------------------------- |
| 每关键路径 5+ 测试             | ❌   | 当前测试严重不足                              |
| Bootstrap 序列测试             | ⚠️   | 仅存在基础冒烟测试                            |
| 插件生命周期测试（每阶段 5+）  | ❌   | 不足                                          |
| E2E 测试（create + search）    | ❌   | 缺失                                          |
| PostgreSQL 集成测试            | ❌   | 缺失                                          |

---

## 4. 优势分析

### S1 — 最小化组装模式
`createFhirEngine()` 仅 204 行，单一职责：将三个基础设施包组装为运行系统。
零 FHIR 业务逻辑在引擎层重复。

### S2 — 确定性的启动顺序
10 步启动序列显式、有文档记录，严格按依赖顺序执行。
Step 6（plugin init）在持久化就绪前运行，Step 8（plugin start）在持久化就绪后运行，
给插件提供了受控的资源访问时机。

### S3 — 插件系统设计
`init → start → ready → stop` 四阶段生命周期，stop 按逆序执行。
`fhir-server` 可注册 HTTP 监听器插件，`fhir-cli` 可注册命令处理器插件。

### S4 — 共享 EngineContext
所有插件共享同一个只读的 `EngineContext` 对象，允许插件间状态通信而不产生耦合。

### S5 — Logger 注入
通过 `config.logger` 注入自定义日志器，默认使用控制台日志回退。
支持结构化日志（pino、winston 等）。

---

## 5. 问题与差距

### GAP-01 — `engine.status()` 方法缺失 [HIGH — 阻断 fhir-cli doctor 命令]

**描述：** `FhirEngine` 接口不暴露引擎健康状态查询方法。

**影响：**
- `fhir doctor` 命令无法获取引擎状态信息
- `fhir engine status` 命令无法实现
- `fhir-server /metadata` 端点缺乏引擎级状态 API

**建议方案：** 在 `FhirEngine` 接口添加：

```typescript
interface FhirEngineStatus {
  fhirVersions: string[]           // 已加载的 FHIR 版本
  loadedPackages: string[]         // 已加载的包名列表
  resourceTypes: string[]          // 支持的资源类型列表
  databaseType: 'sqlite' | 'sqlite-wasm' | 'postgres'
  igAction: 'new' | 'upgrade' | 'consistent'
  startedAt: Date
}

FhirEngine.status(): FhirEngineStatus
```

**工作量：** 小（约 50 行，从现有 `igResult`、`resourceTypes`、`definitions` 提取信息）
**目标版本：** v0.1.0

---

### GAP-02 — PostgreSQL 阻断 [CRITICAL — 阻断 fhir-server 生产部署]

**描述：** `adapter-factory.ts` 对 `postgres` 类型显式抛运行时异常。

**根本原因：** 上游 `fhir-persistence` 的 `PostgresAdapter` 未导出，且 SQL 参数化
存在方言不兼容问题（SQLite 的 `?` vs PostgreSQL 的 `$N`）。

**此 gap 不阻断 fhir-cli**（fhir-cli MVP 使用 SQLite）。

**解除阻断路径（依赖 fhir-persistence 修复在先）：**
1. fhir-persistence 完成 PostgreSQL adapter 导出与测试
2. fhir-engine `adapter-factory.ts` 移除 throw，连接 `PostgresAdapter`
3. fhir-engine 添加 PostgreSQL 集成测试

**目标版本：** v0.2.0（fhir-server 之前）

---

### GAP-03 — 测试套件严重不足 [HIGH — 影响所有消费方]

**描述：** v0.0.1 的测试套件处于 Alpha 状态，关键路径覆盖不足。

**必须补充的测试（每项最少 5 个）：**

| 关键路径                                    | 最低要求 | 当前状态     |
| ------------------------------------------- | -------- | ------------ |
| `createFhirEngine()` — 成功启动             | 5        | ⚠️ 1-2 个    |
| 配置验证错误（每个错误字段）               | 5        | ❌ 不足      |
| Plugin `init()` 失败处理                    | 5        | ❌ 缺失      |
| Plugin `start()` 失败处理                   | 5        | ❌ 缺失      |
| Plugin `stop()` 逆序执行                    | 5        | ❌ 缺失      |
| `engine.stop()` 幂等性                      | 5        | ❌ 缺失      |
| E2E：createResource + readResource + search | 5        | ❌ 缺失      |
| E2E：IG 迁移（new → upgrade）              | 5        | ❌ 缺失      |

**目标版本：** v0.1.0（fhir-cli 前必须完成）

---

## 6. 升级建议

### v0.1.0（fhir-cli 前必须完成）

| 任务                                    | 优先级    | 工作量 |
| --------------------------------------- | --------- | ------ |
| 添加 `engine.status()` 方法             | **P0**    | 小     |
| 编写完整 Bootstrap 测试套件             | **P0**    | 中     |
| 编写插件生命周期测试                    | **P0**    | 中     |
| 编写 E2E 测试（create + search + stop） | **P0**    | 中     |

### v0.2.0（fhir-server 前必须完成）

| 任务                                           | 优先级    | 工作量 |
| ---------------------------------------------- | --------- | ------ |
| 解除 PostgreSQL 阻断（待 fhir-persistence 先） | **P0**    | 小     |
| 添加 PostgreSQL 集成测试                       | **P0**    | 高     |

### 不需要做的（之前错误识别为 gap）

| 项目                          | 说明                                                      |
| ----------------------------- | --------------------------------------------------------- |
| ResourceService / SearchService 等服务层封装 | **不需要。** fhir-cli 和 fhir-server 直接调用 `engine.persistence`，无需中间服务层。HTTP 控制器逻辑属于 fhir-server 内部。 |
| fhir-engine 级别的 Bundle Processor | **不需要。** Bundle 处理已在 `fhir-persistence.processBundle()` 实现，fhir-server 直接调用即可。 |

---

## 7. 评审结论

| 维度                 | 评级       | 说明                                                         |
| -------------------- | ---------- | ------------------------------------------------------------ |
| 架构设计合理性       | ✅ 通过    | Bootstrap 序列、插件系统、组合模式设计正确                   |
| 依赖合规性           | ✅ 通过    | 仅依赖 3 个 Layer 1 包，无禁止引用                           |
| SQLite 可用性        | ✅ 通过    | 完整可用，engine.persistence 暴露完整 CRUD                   |
| PostgreSQL           | ❌ 阻断    | 显式抛异常，上游 fhir-persistence 修复在先                   |
| 测试覆盖             | ❌ 不足    | 关键路径未达 5+ 测试要求                                     |
| status() API         | ❌ 缺失    | fhir-cli doctor 命令需要此方法                               |

**总体评级：⚠️ 架构正确，实现未完整。**

**fhir-cli v0.1.0 前必须完成：**
- GAP-01：添加 `engine.status()`
- GAP-03：补充测试套件

**fhir-server v0.1.0 前必须完成：**
- GAP-02：解除 PostgreSQL 阻断（在 fhir-persistence 修复后）
