# fhir-engine — API Reference

**版本：** 0.5.1
**日期：** 2026-03-15
**适用对象：** 开发者

---

## 目录

1. [createFhirEngine()](#1-createfhirengine)
2. [FhirEngine](#2-fhirengine)
3. [FhirEngineStatus](#3-fhirenginestatus)
4. [FhirEngineConfig](#4-fhirengineconfig)
5. [DatabaseConfig](#5-databaseconfig)
6. [FhirEnginePlugin](#6-fhirengineplugin)
7. [EngineContext](#7-enginecontext)
8. [Logger](#8-logger)
9. [配置系统](#9-配置系统)
10. [适配器工厂](#10-适配器工厂)
11. [包解析 API](#11-包解析-api)
12. [搜索 API](#12-搜索-api)
13. [FHIRPath API](#13-fhirpath-api)
14. [Re-exported 上游类型](#14-re-exported-上游类型)

---

## 1. createFhirEngine()

主入口函数。组装 fhir-definition、fhir-runtime、fhir-persistence 为运行系统。

```typescript
function createFhirEngine(config?: FhirEngineConfig): Promise<FhirEngine>;
```

### 参数

| 参数     | 类型               | 必填 | 说明                                                   |
| -------- | ------------------ | ---- | ------------------------------------------------------ |
| `config` | `FhirEngineConfig` | 否   | 未提供时自动从 cwd 加载 `fhir.config.{ts,js,mjs,json}` |

### 返回值

`Promise<FhirEngine>` — 完全初始化的引擎实例。

### 异常

| 异常消息                                                  | 触发条件                      |
| --------------------------------------------------------- | ----------------------------- |
| `fhir-engine: config.database is required`                | `config.database` 未提供      |
| `fhir-engine: config.database.type is required`           | `config.database.type` 未提供 |
| `fhir-engine: config.packages is required`                | `config.packages` 未提供      |
| `fhir-engine: config.packages.path is required`           | `config.packages.path` 未提供 |
| `fhir-engine: PostgreSQL adapter is not yet available...` | `database.type = 'postgres'`  |
| `fhir-engine: plugin "X" failed during Y: ...`            | 插件钩子抛出异常              |

### 示例

```typescript
import { createFhirEngine } from "fhir-engine";

// 显式配置
const engine = await createFhirEngine({
  database: { type: "sqlite", path: ":memory:" },
  packages: { path: "./fhir-packages" },
});

// 零参数 — 自动加载配置文件
const engine = await createFhirEngine();
```

---

## 2. FhirEngine

引擎返回的稳定句柄，包含所有子系统引用。

```typescript
interface FhirEngine {
  readonly definitions: DefinitionRegistry;
  readonly runtime: FhirRuntimeInstance;
  readonly persistence: FhirPersistence;
  readonly adapter: StorageAdapter;
  readonly sdRegistry: StructureDefinitionRegistry;
  readonly spRegistry: SearchParameterRegistry;
  readonly igResult: { action: "new" | "upgrade" | "consistent" };
  readonly resourceTypes: string[];
  readonly logger: Logger;
  readonly context: EngineContext;
  search(
    resourceType: string,
    queryParams: Record<string, string | string[] | undefined>,
    options?: SearchOptions,
  ): Promise<SearchResult>;
  status(): FhirEngineStatus;
  stop(): Promise<void>;
}
```

### 属性

| 属性            | 类型                          | 说明                                              |
| --------------- | ----------------------------- | ------------------------------------------------- |
| `definitions`   | `DefinitionRegistry`          | FHIR 定义注册表（SD、SP、VS、CS）                 |
| `runtime`       | `FhirRuntimeInstance`         | FHIRPath 求值、验证、搜索值提取                   |
| `persistence`   | `FhirPersistence`             | CRUD + 搜索 + 索引 + Bundle 处理                  |
| `adapter`       | `StorageAdapter`              | 底层数据库适配器                                  |
| `sdRegistry`    | `StructureDefinitionRegistry` | 已加载的 StructureDefinition 注册表               |
| `spRegistry`    | `SearchParameterRegistry`     | 已加载的 SearchParameter 注册表                   |
| `igResult`      | `{ action: ... }`             | IG 初始化结果（`new` / `upgrade` / `consistent`） |
| `resourceTypes` | `string[]`                    | 有数据库表的资源类型列表                          |
| `logger`        | `Logger`                      | 当前使用的日志器                                  |
| `context`       | `EngineContext`               | 共享上下文（与插件相同的对象）                    |

### 方法

#### `search(resourceType, queryParams, options?): Promise<SearchResult>`

高层 FHIR 搜索方法 — 解析查询参数并执行搜索。

**参数：**

| 参数           | 类型                                              | 必填 | 说明                                   |
| -------------- | ------------------------------------------------- | ---- | -------------------------------------- |
| `resourceType` | `string`                                          | ✅   | FHIR 资源类型（如 `'Patient'`）        |
| `queryParams`  | `Record<string, string \| string[] \| undefined>` | ✅   | URL 查询参数对象                       |
| `options`      | `SearchOptions`                                   | 否   | 搜索选项（如 `{ total: 'accurate' }`） |

**返回值：** `Promise<SearchResult>` — 包含匹配资源、included 资源和可选的 total 计数。

**示例：**

```typescript
const result = await engine.search("Patient", { name: "Smith", _count: "10" });
console.log(result.resources); // PersistedResource[]
console.log(result.total); // number (if options.total = 'accurate')
```

详见 [§11 搜索 API](#11-搜索-api)。

#### `status(): FhirEngineStatus`

返回引擎健康/状态信息快照。详见 [FhirEngineStatus](#3-fhirenginestatus)。

```typescript
const s = engine.status();
console.log(s.fhirVersions); // ['4.0']
console.log(s.loadedPackages); // ['hl7.fhir.r4.core@4.0.1']
console.log(s.databaseType); // 'sqlite'
```

#### `stop(): Promise<void>`

优雅关闭引擎：

1. 按逆序调用所有插件的 `stop()` 钩子
2. 关闭数据库适配器

**幂等** — 多次调用不抛异常。

```typescript
await engine.stop();
await engine.stop(); // 安全，不会重复关闭
```

---

## 3. FhirEngineStatus

`engine.status()` 的返回类型。

```typescript
interface FhirEngineStatus {
  fhirVersions: string[];
  loadedPackages: string[];
  resourceTypes: string[];
  databaseType: "sqlite" | "sqlite-wasm" | "postgres";
  igAction: "new" | "upgrade" | "consistent";
  startedAt: Date;
  plugins: string[];
}
```

| 字段             | 类型       | 示例                         | 说明                   |
| ---------------- | ---------- | ---------------------------- | ---------------------- |
| `fhirVersions`   | `string[]` | `['4.0']`                    | 从包名推导的 FHIR 版本 |
| `loadedPackages` | `string[]` | `['hl7.fhir.r4.core@4.0.1']` | 已加载的包标识符       |
| `resourceTypes`  | `string[]` | `['Patient', 'Observation']` | 有数据库表的资源类型   |
| `databaseType`   | `string`   | `'sqlite'`                   | 使用的数据库适配器类型 |
| `igAction`       | `string`   | `'new'`                      | 启动时的 IG 迁移动作   |
| `startedAt`      | `Date`     | `2026-03-15T10:00:00Z`       | 引擎完成启动的时间戳   |
| `plugins`        | `string[]` | `['my-plugin']`              | 已注册的插件名称       |

---

## 4. FhirEngineConfig

引擎配置对象。

```typescript
interface FhirEngineConfig {
  database: DatabaseConfig;
  packages: PackagesConfig;
  igs?: Array<{ name: string; version?: string }>;
  packageResolve?: { allowDownload?: boolean };
  packageName?: string;
  packageVersion?: string;
  logger?: Logger;
  plugins?: FhirEnginePlugin[];
}
```

| 字段             | 类型                                        | 必填 | 默认值                    | 说明                             |
| ---------------- | ------------------------------------------- | ---- | ------------------------- | -------------------------------- |
| `database`       | `DatabaseConfig`                            | ✅   | —                         | 数据库连接配置                   |
| `packages`       | `PackagesConfig`                            | ✅   | —                         | FHIR 包目录配置                  |
| `igs`            | `Array<{ name: string; version?: string }>` | 否   | —                         | IG 包列表，启动前自动解析        |
| `packageResolve` | `{ allowDownload?: boolean }`               | 否   | `{ allowDownload: true }` | 包解析选项（`false` = 离线模式） |
| `packageName`    | `string`                                    | 否   | `'fhir-engine.default'`   | IG 迁移标签                      |
| `packageVersion` | `string`                                    | 否   | `'1.0.0'`                 | IG 迁移版本                      |
| `logger`         | `Logger`                                    | 否   | `createConsoleLogger()`   | 自定义日志器                     |
| `plugins`        | `FhirEnginePlugin[]`                        | 否   | `[]`                      | 插件列表                         |

### PackagesConfig

```typescript
interface PackagesConfig {
  path: string; // FHIR 包所在目录
}
```

---

## 5. DatabaseConfig

联合类型，支持三种数据库后端。

```typescript
type DatabaseConfig =
  | SqliteDatabaseConfig
  | SqliteWasmDatabaseConfig
  | PostgresDatabaseConfig;
```

### SqliteDatabaseConfig

```typescript
interface SqliteDatabaseConfig {
  type: "sqlite";
  path: string; // 文件路径或 ':memory:'
  wal?: boolean; // WAL 模式（默认 true）
  busyTimeout?: number; // 忙超时毫秒数（默认 5000）
}
```

### SqliteWasmDatabaseConfig

> ⚠️ `sqlite-wasm` 已在 v0.4.2 移除（fhir-persistence v0.3.0 不再导出 `SQLiteAdapter`）。请使用 `type: 'sqlite'` 代替。

```typescript
interface SqliteWasmDatabaseConfig {
  type: "sqlite-wasm";
  path: string;
}
```

### PostgresDatabaseConfig

```typescript
interface PostgresDatabaseConfig {
  type: "postgres";
  url: string; // PostgreSQL 连接字符串
  max?: number; // 连接池大小（默认 10）
  idleTimeoutMillis?: number; // 空闲超时（默认 30000ms）
  connectionTimeoutMillis?: number; // 连接超时（默认 0 = 无限）
}
```

**示例：**

```typescript
const engine = await createFhirEngine({
  database: {
    type: "postgres",
    url: "postgresql://user:pass@localhost:5432/fhir_db",
    max: 20,
  },
  packages: { path: "./fhir-packages" },
});
```

> ℹ️ PostgreSQL 需要安装 `pg` 包：`npm install pg`

---

## 6. FhirEnginePlugin

插件接口。所有钩子均为可选。

```typescript
interface FhirEnginePlugin {
  name: string;
  init?(ctx: EngineContext): Promise<void>;
  start?(ctx: EngineContext): Promise<void>;
  ready?(ctx: EngineContext): Promise<void>;
  stop?(ctx: EngineContext): Promise<void>;
}
```

### 钩子执行规则

| 钩子    | 执行时机              | 执行顺序       | 失败行为                    |
| ------- | --------------------- | -------------- | --------------------------- |
| `init`  | 持久化初始化之前      | 注册顺序       | 抛异常 → 中止启动           |
| `start` | 持久化初始化之后      | 注册顺序       | 抛异常 → 中止启动           |
| `ready` | 所有插件 start 完成后 | 注册顺序       | 抛异常 → 中止启动           |
| `stop`  | 引擎关闭时            | **逆注册顺序** | 记录错误日志 → 继续关闭其他 |

### 示例

```typescript
const metricsPlugin: FhirEnginePlugin = {
  name: "metrics",
  async start(ctx) {
    // 持久化已就绪，可以查询数据库
    const count = await ctx.persistence!.readResource("Patient", "count");
  },
  async stop(ctx) {
    // 清理资源
  },
};
```

---

## 7. EngineContext

共享上下文对象，在所有插件钩子中传递。

```typescript
interface EngineContext {
  readonly config: FhirEngineConfig;
  readonly definitions: DefinitionRegistry;
  readonly runtime: FhirRuntimeInstance;
  readonly adapter: StorageAdapter;
  readonly persistence: FhirPersistence | undefined;
  readonly logger: Logger;
}
```

| 字段          | `init` 阶段 | `start` / `ready` / `stop` 阶段 |
| ------------- | ----------- | ------------------------------- |
| `config`      | ✅ 可用     | ✅ 可用                         |
| `definitions` | ✅ 可用     | ✅ 可用                         |
| `runtime`     | ✅ 可用     | ✅ 可用                         |
| `adapter`     | ✅ 可用     | ✅ 可用                         |
| `persistence` | `undefined` | ✅ 可用                         |
| `logger`      | ✅ 可用     | ✅ 可用                         |

---

## 8. Logger

可插拔日志接口。

```typescript
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

### createConsoleLogger()

```typescript
function createConsoleLogger(): Logger;
```

返回默认的控制台日志器，输出格式为 `[fhir-engine] message`。

未指定 `config.logger` 时自动使用。

---

## 9. 配置系统

### defineConfig()

```typescript
function defineConfig(config: FhirEngineConfig): FhirEngineConfig;
```

类型安全的 identity 辅助函数，用于 `fhir.config.ts`：

```typescript
// fhir.config.ts
import { defineConfig } from "fhir-engine";

export default defineConfig({
  database: { type: "sqlite", path: "./fhir.db" },
  packages: { path: "./fhir-packages" },
});
```

### loadFhirConfig()

```typescript
function loadFhirConfig(configPath?: string): Promise<FhirEngineConfig>;
```

| 参数         | 类型     | 说明                                  |
| ------------ | -------- | ------------------------------------- |
| `configPath` | `string` | 可选。未提供时从 cwd 自动发现配置文件 |

**自动发现顺序：** `fhir.config.ts` → `fhir.config.js` → `fhir.config.mjs` → `fhir.config.json`

**环境变量覆盖：** 加载后自动应用。

| 环境变量             | 覆盖目标                      | 合法值                              |
| -------------------- | ----------------------------- | ----------------------------------- |
| `FHIR_DATABASE_TYPE` | `config.database.type`        | `sqlite`, `sqlite-wasm`, `postgres` |
| `FHIR_DATABASE_URL`  | `config.database.path`/`.url` | 任意字符串                          |
| `FHIR_PACKAGES_PATH` | `config.packages.path`        | 任意路径                            |

---

## 10. 适配器工厂

### createAdapter()

```typescript
async function createAdapter(
  config: DatabaseConfig,
  logger: Logger,
): Promise<StorageAdapter>;
```

> ⚠️ v0.5.0 起 `createAdapter` 为 **async** 函数，调用时需要 `await`。

根据 `config.type` 创建对应的 `StorageAdapter`：

| `config.type`   | 创建的适配器           | 状态                                  |
| --------------- | ---------------------- | ------------------------------------- |
| `'sqlite'`      | `BetterSqlite3Adapter` | ✅                                    |
| `'postgres'`    | `PostgresAdapter`      | ✅ (`await import('pg')`, 需 `pg` 包) |
| `'sqlite-wasm'` | —                      | ❌ 已移除，抛异常                     |

---

## 11. 包解析 API

### resolvePackages()

```typescript
async function resolvePackages(
  config: FhirEngineConfig,
  options?: ResolvePackagesOptions,
): Promise<ResolvePackagesResult>;
```

确保 config 中列出的所有 FHIR 包在项目的 `packages.path` 目录中可用。

**解析顺序：**

1. 本地已存在 → `source: 'local'`
2. 系统缓存命中 (`~/.fhir/packages`) → 创建链接，`source: 'cache'`
3. 从 FHIR Package Registry 下载 → 缓存 → 创建链接，`source: 'download'`

**参数：**

| 参数      | 类型                     | 必填 | 说明                                      |
| --------- | ------------------------ | ---- | ----------------------------------------- |
| `config`  | `FhirEngineConfig`       | ✅   | 引擎配置（读取 `igs` 和 `packages.path`） |
| `options` | `ResolvePackagesOptions` | 否   | 覆盖包列表、目标路径、下载策略            |

**示例：**

```typescript
import { resolvePackages } from "fhir-engine";

// 自动解析 config.igs 中的所有包
const result = await resolvePackages(config);

// 手动指定要解析的包
const result = await resolvePackages(config, {
  packages: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
});

// 离线模式 — 仅使用本地和缓存
const result = await resolvePackages(config, { allowDownload: false });
```

### ResolvePackagesOptions

```typescript
interface ResolvePackagesOptions {
  packages?: Array<{ name: string; version?: string }>; // 覆盖 config.igs
  packagesPath?: string; // 覆盖 config.packages.path
  allowDownload?: boolean; // 默认 true
  logger?: Logger;
}
```

### ResolvedPackage

```typescript
interface ResolvedPackage {
  name: string;
  version: string;
  path: string;
  source: "cache" | "download" | "local";
}
```

### ResolvePackagesResult

```typescript
interface ResolvePackagesResult {
  success: boolean;
  packages: ResolvedPackage[];
  errors: Array<{ name: string; error: string }>;
}
```

---

## 12. 搜索 API

### engine.search()

高层搜索方法，已在 [§2 FhirEngine](#2-fhirengine) 中说明。

### parseSearchRequest()

```typescript
function parseSearchRequest(
  resourceType: string,
  queryParams: Record<string, string | string[] | undefined>,
  registry?: SearchParameterRegistry,
): SearchRequest;
```

将 URL 查询参数解析为结构化的 `SearchRequest` 对象。

**示例：**

```typescript
import { parseSearchRequest } from "fhir-engine";

const request = parseSearchRequest(
  "Patient",
  { name: "Smith", _count: "10" },
  engine.spRegistry,
);
// SearchRequest { resourceType: 'Patient', params: [...], count: 10, ... }
```

### executeSearch()

```typescript
function executeSearch(
  adapter: StorageAdapter,
  request: SearchRequest,
  registry: SearchParameterRegistry,
  options?: SearchOptions,
): Promise<SearchResult>;
```

执行搜索请求并返回结果。

**示例：**

```typescript
import { parseSearchRequest, executeSearch } from "fhir-engine";

const request = parseSearchRequest(
  "Patient",
  { name: "Smith" },
  engine.spRegistry,
);
const result = await executeSearch(engine.adapter, request, engine.spRegistry);
console.log(result.resources); // PersistedResource[]
```

### 类型

```typescript
export type { SearchRequest, SearchResult, SearchOptions } from "fhir-engine";

interface SearchResult {
  resources: PersistedResource[];
  included?: PersistedResource[];
  total?: number;
}

interface SearchOptions {
  total?: "none" | "estimate" | "accurate";
}
```

---

## 13. FHIRPath API

所有 FHIRPath 求值函数从 `fhir-runtime` 重新导出：

### evalFhirPath()

```typescript
function evalFhirPath(expression: string, input: unknown): unknown[];
```

求值 FHIRPath 表达式，返回结果数组。

**示例：**

```typescript
import { evalFhirPath } from "fhir-engine";

const patient = {
  resourceType: "Patient",
  name: [{ family: "Smith", given: ["John"] }],
};
const families = evalFhirPath("Patient.name.family", patient);
console.log(families); // ['Smith']
```

### evalFhirPathBoolean()

```typescript
function evalFhirPathBoolean(expression: string, input: unknown): boolean;
```

求值 FHIRPath 表达式并返回布尔值。

**示例：**

```typescript
import { evalFhirPathBoolean } from "fhir-engine";

const patient = { resourceType: "Patient", active: true };
const isActive = evalFhirPathBoolean("Patient.active", patient);
console.log(isActive); // true
```

### evalFhirPathString()

```typescript
function evalFhirPathString(
  expression: string,
  input: unknown,
): string | undefined;
```

求值 FHIRPath 表达式并返回第一个结果的字符串值。

**示例：**

```typescript
import { evalFhirPathString } from "fhir-engine";

const patient = { resourceType: "Patient", name: [{ family: "Smith" }] };
const family = evalFhirPathString("Patient.name.family", patient);
console.log(family); // 'Smith'
```

### evalFhirPathTyped()

```typescript
function evalFhirPathTyped(
  expression: string,
  input: TypedValue[],
  variables?: Record<string, TypedValue>,
): TypedValue[];
```

带类型信息的 FHIRPath 求值（高级用法）。

---

## 14. Re-exported 上游类型

以下类型从上游包 re-export，方便消费方直接从 `fhir-engine` 导入：

```typescript
// from fhir-definition
export type { DefinitionRegistry, DefinitionProvider } from "fhir-definition";

// from fhir-runtime
export type { FhirRuntimeInstance } from "fhir-runtime";

// from fhir-persistence
export type { FhirPersistence, StorageAdapter } from "fhir-persistence";
```

---

_fhir-engine v0.5.1 — API Reference_
