# fhir-engine — AI Context Document

**版本：** 0.5.0
**日期：** 2026-03-15
**适用对象：** AI 编码助手（Copilot、Cascade、Claude 等）
**用途：** 快速理解 fhir-engine 模块以执行代码任务

---

## 快速定位

| 需要做什么           | 查看哪里                                      |
| -------------------- | --------------------------------------------- |
| 了解项目架构         | 本文件 §1-§3                                  |
| 调用 fhir-engine API | 本文件 §4 + `docs/API.md`                     |
| 使用包解析 API       | 本文件 §4 + `docs/API.md` §11                 |
| 使用搜索 API         | 本文件 §4 + `docs/API.md` §12                 |
| 使用 FHIRPath        | 本文件 §4 + `docs/API.md` §13                 |
| 写插件               | 本文件 §5                                     |
| 添加测试             | 本文件 §7 + `src/__tests__/*.test.ts`         |
| 修改引擎启动逻辑     | `src/engine.ts`                               |
| 修改类型定义         | `src/types.ts`                                |
| 修改配置加载         | `src/config.ts`                               |
| 修改数据库适配器工厂 | `src/adapter-factory.ts`                      |
| 了解全局架构约束     | `devdocs/all/FHIR_INFRASTRUCTURE_OVERVIEW.md` |

---

## 1. 模块身份

```
名称:     fhir-engine
版本:     0.5.0
层次:     Layer 2 (引擎层)
职责:     将 Layer 1 的 3 个包组装为可运行的 FHIR 系统
文件数:   7 个源文件
测试数:   97 个
构建输出: ESM (.mjs) + CJS (.cjs) + bundled .d.ts
```

---

## 2. 依赖规则（硬约束，不可违反）

```
允许依赖:
  ← fhir-definition (Layer 1)
  ← fhir-runtime (Layer 1)
  ← fhir-persistence (Layer 1)

禁止依赖:
  ✗ fhir-server, fhir-client, fhir-studio (Layer 3)
  ✗ 任何 HTTP 库
  ✗ 任何 UI 库
  ✗ 任何 React/Vue/Angular
```

---

## 3. 文件映射

```
src/
├── engine.ts           → createFhirEngine() 主函数，~260 行
│                         启动序列: config → definitions → runtime → await adapter
│                         → plugin init → persistence → igResult.error 检查
│                         → plugin start → plugin ready → return FhirEngine
│
├── adapter-factory.ts  → async createAdapter(DatabaseConfig, Logger): Promise<StorageAdapter>
│                         sqlite → BetterSqlite3Adapter
│                         postgres → PostgresAdapter (await import('pg'), ESM 动态导入)
│                         sqlite-wasm → throw (已移除)
│
├── config.ts           → defineConfig(): identity helper
│                         loadFhirConfig(): 自动发现 + 环境变量覆盖
│                         applyEnvOverrides(): FHIR_DATABASE_TYPE/URL, FHIR_PACKAGES_PATH
│
├── package-resolver.ts → resolvePackages() 包解析（本地 → 缓存 → 下载）
│                         使用 PackageCache + PackageRegistryClient from fhir-definition
│                         Windows: junction, Unix: symlink
│
├── types.ts            → 所有类型定义:
│                         FhirEngineConfig, DatabaseConfig, PackagesConfig
│                         FhirEngine, FhirEngineStatus, FhirEnginePlugin
│                         EngineContext, Logger
│                         ResolvePackagesOptions, ResolvedPackage, ResolvePackagesResult
│
├── logger.ts           → createConsoleLogger(): Logger
│
├── index.ts            → 公开 API barrel (所有 exports 在这里)
│
└── __tests__/
    ├── engine.test.ts          → 47 tests: config, bootstrap, CRUD, stop, status, search, re-exports, pg
    ├── plugin.test.ts          → 28 tests: lifecycle, context, init/start/stop failures
    ├── config.test.ts          → 11 tests: defineConfig, loadFhirConfig, env overrides
    └── package-resolver.test.ts → 12 tests: local, cache, offline, idempotent, overrides, Firely cache fix
```

---

## 4. 公开 API（完整列表）

### 函数导出

```typescript
// 主入口 — 创建完全初始化的引擎
createFhirEngine(config?: FhirEngineConfig): Promise<FhirEngine>

// 配置辅助
defineConfig(config: FhirEngineConfig): FhirEngineConfig
loadFhirConfig(configPath?: string): Promise<FhirEngineConfig>

// 包解析 (v0.4.0)
resolvePackages(config: FhirEngineConfig, options?: ResolvePackagesOptions): Promise<ResolvePackagesResult>

// 搜索工具 (v0.3.0)
parseSearchRequest(resourceType: string, queryParams: Record<string, string | string[] | undefined>, registry?: SearchParameterRegistry): SearchRequest
executeSearch(adapter: StorageAdapter, request: SearchRequest, registry: SearchParameterRegistry, options?: SearchOptions): Promise<SearchResult>

// FHIRPath 求值 (v0.3.0)
evalFhirPath(expression: string, input: unknown): unknown[]
evalFhirPathBoolean(expression: string, input: unknown): boolean
evalFhirPathString(expression: string, input: unknown): string | undefined
evalFhirPathTyped(expression: string, input: TypedValue[], variables?: Record<string, TypedValue>): TypedValue[]

// 工具
createConsoleLogger(): Logger
createAdapter(config: DatabaseConfig, logger: Logger): StorageAdapter
```

### 类型导出

```typescript
// 引擎
FhirEngine; // 引擎句柄 (readonly 属性 + status() + stop())
FhirEngineConfig; // 配置对象
FhirEngineStatus; // status() 返回值
FhirEnginePlugin; // 插件接口 (name + init/start/ready/stop)
EngineContext; // 插件上下文

// 数据库
DatabaseConfig; // union: Sqlite | SqliteWasm | Postgres
SqliteDatabaseConfig;
SqliteWasmDatabaseConfig;
PostgresDatabaseConfig;
PackagesConfig;

// 日志
Logger; // { debug, info, warn, error }

// 包解析类型 (v0.4.0)
ResolvePackagesOptions; // resolvePackages() 参数
ResolvedPackage; // 单个包解析结果
ResolvePackagesResult; // resolvePackages() 返回值

// 搜索类型 (v0.3.0)
SearchRequest; // from fhir-persistence
SearchResult; // from fhir-persistence
SearchOptions; // from fhir-persistence

// Re-exported upstream
DefinitionRegistry; // from fhir-definition
DefinitionProvider; // from fhir-definition
FhirRuntimeInstance; // from fhir-runtime
FhirPersistence; // from fhir-persistence
StorageAdapter; // from fhir-persistence
```

---

## 5. 插件系统速查

```typescript
interface FhirEnginePlugin {
  name: string; // 必填，用于日志和错误消息
  init?(ctx: EngineContext): Promise<void>; // 持久化之前
  start?(ctx: EngineContext): Promise<void>; // 持久化之后
  ready?(ctx: EngineContext): Promise<void>; // 全部 start 完成
  stop?(ctx: EngineContext): Promise<void>; // 关闭时（逆序）
}

// EngineContext 在各阶段的可用性:
// init:  ctx.persistence = undefined, 其他均可用
// start: ctx.persistence = FhirPersistence (可用)
// ready: 同 start
// stop:  同 start

// 错误行为:
// init/start/ready 抛异常 → 中止启动，错误消息含插件名和阶段名
// stop 抛异常 → 记录错误日志，继续关闭其他插件
```

---

## 6. 错误消息前缀规范

所有引擎抛出的错误以 `fhir-engine: ` 开头：

```
fhir-engine: config.database is required
fhir-engine: config.database.type is required (sqlite | sqlite-wasm | postgres)
fhir-engine: config.packages is required
fhir-engine: config.packages.path is required
fhir-engine: PostgreSQL adapter is not yet available. ...
fhir-engine: plugin "{name}" failed during {hook}: {message}
fhir-engine: config file not found: {path}
fhir-engine: no config file found in {cwd}. Expected one of: ...
fhir-engine: failed to parse config file {path}: ...
fhir-engine: FHIR_DATABASE_TYPE must be one of: ...
```

---

## 7. 测试规范

### 运行测试

```bash
npm test              # vitest run
npx vitest run --reporter=verbose  # 详细输出
```

### 测试结构

```
engine.test.ts:
  - Config validation (6)    — 每个错误字段 + postgres + 无效路径
  - Bootstrap (7)            — 成功启动 + 各属性检查
  - CRUD E2E (7)             — create/read/update/delete + 多记录 + 错误
  - Stop (5)                 — 幂等 + 日志 + promise + adapter 关闭
  - Status (8)               — 每个字段正确性 + 插件名 + 时间戳
  - Logger (2)               — 自定义 + 默认

plugin.test.ts:
  - Lifecycle order (2)      — init→start→ready 顺序, stop 逆序
  - Context availability (5) — persistence 在各阶段的可用性
  - Init failure (5)         — 错误消息、cause、阻断后续插件、非 Error 值
  - Start failure (5)        — 同 init 模式
  - Stop error isolation (5) — 不阻断其他插件、多错误独立记录
  - Partial hooks (1)        — 仅实现部分钩子
  - Backward compat (2)      — 无插件 / 空插件数组
  - Persistence in plugin (1)— 插件中使用 persistence 种子数据

config.test.ts:
  - defineConfig (1)         — identity 函数
  - loadFhirConfig (5)       — 显式路径、缺失文件、无效 JSON、cwd 发现、无文件
  - applyEnvOverrides (9)    — 每个环境变量 + 组合 + 无效值
```

### 测试辅助

```typescript
// 标准 fixtures 目录
const FIXTURES_PATH = resolve(__dirname, "fixtures");
// 包含: hl7.fhir.r4.core (最小子集，含 Patient SD + SP)

// 静默日志器（避免测试噪音）
const silent = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

// 基础配置工厂
function baseConfig(overrides?: Partial<FhirEngineConfig>): FhirEngineConfig {
  return {
    database: { type: "sqlite", path: ":memory:" },
    packages: { path: FIXTURES_PATH },
    logger: silent,
    ...overrides,
  };
}
```

### 每关键路径最低 5 个测试（质量门控规则）

添加新功能时必须为每条关键路径编写至少 5 个测试。关键路径包括：

- 公开 API 方法
- 错误条件
- 边界条件
- 集成点

---

## 8. 已知限制（AI 编码时注意）

1. **PostgreSQL 不可用** — `createAdapter()` 对 `postgres` 类型抛异常，不要尝试连接 PostgreSQL
2. **`ctx.persistence` 在 `init()` 中为 `undefined`** — 不要在 init 钩子中使用持久化
3. **插件 `stop()` 错误不会传播** — 只记录日志，不会中止其他插件的 stop
4. **`fhir-runtime` 需要 `preloadCore: false`** — 引擎已自动设置，不要覆盖
5. **`LoadedPackage` 没有 `fhirVersion` 属性** — FHIR 版本从包名推导（`.r4.` → `'4.0'`）

---

## 9. 常见任务代码片段

### 使用 engine.search() 搜索资源

```typescript
const engine = await createFhirEngine({
  database: { type: "sqlite", path: ":memory:" },
  packages: { path: "./fhir-packages" },
});

// 创建测试数据
await engine.persistence.createResource("Patient", {
  resourceType: "Patient",
  name: [{ family: "Smith", given: ["John"] }],
});

// 高层搜索
const result = await engine.search("Patient", { name: "Smith", _count: "10" });
console.log(result.resources); // PersistedResource[]

await engine.stop();
```

### 使用 FHIRPath 求值

```typescript
import {
  evalFhirPath,
  evalFhirPathBoolean,
  evalFhirPathString,
} from "fhir-engine";

const patient = {
  resourceType: "Patient",
  name: [{ family: "Smith", given: ["John"] }],
  active: true,
};

const families = evalFhirPath("Patient.name.family", patient); // ['Smith']
const isActive = evalFhirPathBoolean("Patient.active", patient); // true
const family = evalFhirPathString("Patient.name.family", patient); // 'Smith'
```

### 创建引擎并执行 CRUD

```typescript
const engine = await createFhirEngine({
  database: { type: "sqlite", path: ":memory:" },
  packages: { path: "./fhir-packages" },
});

const patient = await engine.persistence.createResource("Patient", {
  resourceType: "Patient",
  name: [{ family: "Smith", given: ["John"] }],
});

const read = await engine.persistence.readResource("Patient", patient.id!);

const updated = await engine.persistence.updateResource("Patient", {
  ...read,
  gender: "male",
});

await engine.persistence.deleteResource("Patient", patient.id!);

await engine.stop();
```

### 编写插件

```typescript
const myPlugin: FhirEnginePlugin = {
  name: "my-plugin",
  async init(ctx) {
    ctx.logger.info("Plugin initializing...");
    // ctx.persistence 不可用
  },
  async start(ctx) {
    // ctx.persistence 可用
    await ctx.persistence!.createResource("Patient", {
      resourceType: "Patient",
      name: [{ family: "SeedData" }],
    });
  },
  async stop(ctx) {
    ctx.logger.info("Plugin stopping...");
  },
};
```

### 配置文件

```typescript
// fhir.config.ts
import { defineConfig } from "fhir-engine";

export default defineConfig({
  database: { type: "sqlite", path: "./data/fhir.db" },
  packages: { path: "./fhir-packages" },
  plugins: [],
});
```

---

_fhir-engine v0.5.0 — AI Context Document_
