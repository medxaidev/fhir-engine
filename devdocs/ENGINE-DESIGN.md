我帮你把 `fhir-engine` 的架构和路线图整理成 **最终可执行的参考蓝图**，整合了 lifecycle、plugin、config、bootstrap 流程，并明确了对 `fhir-definition` / `fhir-runtime` / `fhir-persistence` 的依赖关系和接口暴露。核心总结如下：

---

# 1️⃣ 定位

`fhir-engine` 是 **系统的启动器 + 生命周期管理 + 插件管理器**，不做底层逻辑，只负责：

1. 加载配置（database / IG / runtime / plugins）
2. 初始化核心模块（definition / runtime / persistence）
3. 挂载插件（auth / search / terminology / subscription 等）
4. 暴露统一 API 给 CLI / Server / Studio
5. 管理 engine 生命周期（init → start → ready → stop）

---

# 2️⃣ 依赖关系

```text
fhir-definition  → FHIR packages / definitions (SD / SP / VS / CS)
fhir-runtime     → FHIRPath / validator / extractor
fhir-persistence → Storage / Search / Migration / CRUD
fhir-engine      → Bootstrap + lifecycle + plugin system
```

- **Engine 不依赖上层应用**
- **Engine 依赖 persistence, runtime, definition**
- **Persistence / Runtime / Definition 不导入 Engine**

---

# 3️⃣ 架构设计

```text
                +--------------------+
                |     fhir-engine    |
                |--------------------|
                | lifecycle manager  |
                | plugin manager     |
                | config loader      |
                +---------+----------+
                          |
          +---------------+---------------+
          |                               |
   +------+-------+                +------+-------+
   | fhir-runtime |                | fhir-persistence |
   +--------------+                +------------------+
          |
   +------v------+
   | fhir-definition |
   +-------------+
```

**插件挂载示意：**

```text
Plugins
  ├─ auth-plugin
  ├─ search-plugin
  ├─ terminology-plugin
  ├─ subscription-plugin
  └─ api-plugin
```

---

# 4️⃣ Lifecycle

```text
init  →  start  →  ready  →  stop
```

- **init**：加载配置、初始化模块、注册插件
- **start**：启动 DB / schema migration / persistence / runtime
- **ready**：所有插件 start 完成，系统可使用
- **stop**：关闭 DB / plugins / 释放资源

---

# 5️⃣ Engine Context

提供给插件共享上下文：

```ts
export interface EngineContext {
  config: FhirEngineConfig;
  definitions: DefinitionRegistry;
  runtime: FhirRuntimeInstance;
  adapter: StorageAdapter;
  persistence?: FhirPersistence; // start 后可用
  logger: Logger;
}
```

---

# 6️⃣ Plugin 系统

```ts
export interface FhirEnginePlugin {
  name: string;
  init?(ctx: EngineContext): Promise<void>;
  start?(ctx: EngineContext): Promise<void>;
  ready?(ctx: EngineContext): Promise<void>;
  stop?(ctx: EngineContext): Promise<void>;
}
```

- 生命周期与 Engine 同步
- `init` 可注册 SD/SP
- `start` 可访问 persistence / runtime

---

# 7️⃣ Bootstrap 流程

```text
createFhirEngine(config) →
  1. validate config
  2. load packages → InMemoryDefinitionRegistry
  3. DefinitionBridge → FhirDefinitionBridge
  4. Runtime → FhirRuntimeProvider
  5. StorageAdapter → SQLite / Postgres
  6. plugin init
  7. FhirSystem.initialize() → persistence + sdRegistry + spRegistry + migrations
  8. plugin start
  9. 返回 FhirEngine 实例
```

```ts
// Step 1: Validate config
if (!config.packages) {
  throw new Error("packages config is required");
}

// Step 2: Load packages from local directory
// fhir-definition: loadDefinitionPackages(rootPath) → DefinitionRegistry
let registry: DefinitionRegistry;
if (config.packages?.path) {
  const output = loadDefinitionPackages(config.packages.path);
  registry = output.registry;
  output.result.packages.forEach((p) =>
    logger.info(`[fhir-engine] loaded: ${p.name}@${p.version}`),
  );
} else {
  registry = new InMemoryDefinitionRegistry();
}

// Step 3: Create FhirRuntime with definitions injected
// RuntimeOptions.definitions accepts DefinitionProvider
// DefinitionRegistry satisfies DefinitionProvider structurally — no cast needed
const runtime = await createRuntime({ definitions: registry });

// Step 4: Create provider bridges
const definitionBridge = new FhirDefinitionBridge(registry);
const runtimeProvider =
  config.runtime?.enabled !== false
    ? new FhirRuntimeProvider({ runtime })
    : undefined;

// ... (rest of the bootstrap code)
```

---

# 8️⃣ Adapter Factory

| database.type | adapter              | 场景                           |
| ------------- | -------------------- | ------------------------------ |
| sqlite        | BetterSqlite3Adapter | 本地 / embedded / studio / cli |
| sqlite-wasm   | SQLiteAdapter        | 浏览器 / WASM                  |
| postgres      | PostgresAdapter      | 生产服务器                     |

---

# 9️⃣ 使用示例

**FHIR Server：**

```ts
const engine = await createFhirEngine({
  database: { type: "postgres", url: process.env.DATABASE_URL },
  packages: { path: "./fhir-packages" },
  plugins: [authPlugin(), subscriptionPlugin()],
});
const server = new FhirServer({ persistence: engine.persistence });
await server.listen(8080);
```

**FHIR Studio / CLI：**

```ts
const engine = await createFhirEngine({
  database: { type: "sqlite", url: "./studio.db" },
  packages: { path: "./fhir-packages" },
});
await engine.persistence.searchResources({
  resourceType: "Patient",
  count: 20,
});
```

---

# 🔟 Roadmap

| Phase | 目标                                                           |
| ----- | -------------------------------------------------------------- |
| 1     | Core bootstrap: `createFhirEngine(config)` 可运行              |
| 2     | Lifecycle + Plugin: 支持插件 init/start/ready/stop             |
| 3     | Config 文件支持: fhir.config.ts / .json / env overrides        |
| 4     | Production plugins: auth / terminology / search / subscription |
| 5     | CLI / Server / Studio 集成: 全部统一 engine                    |

---

# 11️⃣ 改动 fhir-persistence

只需在 `src/index.ts` 增加导出：

```ts
export { FhirSystem } from "./startup/fhir-system.js";
export { BetterSqlite3Adapter } from "./db/better-sqlite3-adapter.js";
export { FhirDefinitionBridge } from "./providers/fhir-definition-provider.js";
export {
  FhirRuntimeProvider,
  createFhirRuntimeProvider,
} from "./providers/fhir-runtime-provider.js";
```

---

总结：

- **Engine 是核心 bootstrap & lifecycle manager**
- **Persistence / Runtime / Definition 不直接处理启动**
- **所有上层应用（CLI / Server / Studio）统一通过 engine**
- **插件系统保证扩展性，生命周期可控**

---

## 12. 实际 API（已确认）

### Q1: fhir-definition — 已确认

**Phase 1** 使用 `loadDefinitionPackages(rootPath)` — 已存在，同步：

```ts
import {
  loadDefinitionPackages,
  InMemoryDefinitionRegistry,
} from "fhir-definition";

// 函数形式（推荐）
const { registry, result } = loadDefinitionPackages("./fhir-packages");
// registry: DefinitionRegistry — populated with all SD/SP/VS/CS
// result.packages: LoadedPackage[]

// 类形式（等价）
import { PackageManager } from "fhir-definition";
const manager = new PackageManager();
manager.loadPackages("./fhir-packages");
const registry = manager.getRegistry();
```

**Phase 2**（需升级 fhir-definition，见 FHIR-DEFINITION-UPGRADE.md）：

```ts
// 按名称从 packages.fhir.org 下载（尚未实现）
const loader = new PackageLoader({ cacheDir: "~/.fhir/packages" });
await loader.loadMany([{ name: "hl7.fhir.r4.core", version: "4.0.1" }], {
  into: registry,
});
```

---

### Q2: fhir-runtime — 已确认

`createRuntime({ definitions })` 直接支持 `DefinitionProvider` 注入：

```ts
// RuntimeOptions（来自 fhir-runtime .d.ts）：
interface RuntimeOptions {
  readonly definitions?: DefinitionProvider; // ← inject here
  readonly context?: FhirContext;
  readonly terminology?: TerminologyProvider;
  readonly referenceResolver?: ReferenceResolver;
}

// DefinitionRegistry 通过结构类型自动满足 DefinitionProvider — 无需显式转换
const runtime = await createRuntime({ definitions: registry });
```

**fhir-runtime 无需修改。**

---

### Q3: 命名 — persistence ✅

`engine.persistence: FhirPersistence`（不用 `repository`），与类名一致，避免与 v1 deprecated `FhirRepository` 混淆。

---

## 13. FhirEngineConfig — 完整接口

```ts
export interface FhirEngineConfig {
  database: DatabaseEngineConfig;
  packages?: PackageSourceConfig;
  migrations?: boolean; // default: true
  plugins?: FhirEnginePlugin[];
  runtime?: { enabled?: boolean }; // default: enabled
  logger?: Logger;
}

export interface DatabaseEngineConfig {
  type: "sqlite" | "sqlite-wasm" | "postgres";
  url: string; // file path or connection string
  sqlite?: BetterSqlite3Options;
}

export interface PackageSourceConfig {
  path: string; // Phase 1: local directory
  // Phase 2 (see FHIR-DEFINITION-UPGRADE.md):
  // packages?: Array<{ name: string; version?: string }>;
}

export interface FhirEngine {
  definitions: DefinitionRegistry; // from fhir-definition
  runtime: FhirRuntimeInstance; // from fhir-runtime
  persistence: FhirPersistence; // CRUD + Search + Indexing
  sdRegistry: StructureDefinitionRegistry;
  spRegistry: SearchParameterRegistry;
  migrations: IGPersistenceManager;
  stop(): Promise<void>;
}
```
