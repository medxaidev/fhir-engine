# fhir-engine — 项目概览

**版本：** 0.5.0
**日期：** 2026-03-15
**层次：** Layer 2 — FHIR 引擎层

---

## 1. 项目定位

`fhir-engine` 是 FHIR 生态系统中的 **运行时内核（Layer 2）**，将三个 Layer 1 基础设施包
组装为一个可运行的 FHIR 系统：

```
┌─────────────────────────────────────────────────────┐
│  Layer 3 — 应用层                                    │
│  fhir-cli（命令行）  fhir-server（HTTP 服务器）     │
├─────────────────────────────────────────────────────┤
│  Layer 2 — 引擎层                                    │
│  fhir-engine  ← 本项目                              │
├─────────────────────────────────────────────────────┤
│  Layer 1 — 核心基础设施                              │
│  fhir-definition   fhir-runtime   fhir-persistence  │
└─────────────────────────────────────────────────────┘
```

**核心职责：** 组合，不重复实现。`fhir-engine` 不包含 FHIR 业务逻辑，所有 FHIR 操作
委托给 Layer 1 包。

---

## 2. 核心功能

### 2.1 包解析

```typescript
import { resolvePackages } from "fhir-engine";

// 自动解析 config.igs 中的所有包（本地 → 缓存 → 下载）
const result = await resolvePackages(config);

// 或通过 config.igs 自动解析
const engine = await createFhirEngine({
  database: { type: "sqlite", path: ":memory:" },
  packages: { path: "./fhir-packages" },
  igs: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
});
```

### 2.2 高层搜索 API

```typescript
// 方式 1：使用 engine.search() 高层方法
const result = await engine.search("Patient", { name: "Smith", _count: "10" });

// 方式 2：使用重新导出的工具函数
import { parseSearchRequest, executeSearch } from "fhir-engine";
const request = parseSearchRequest(
  "Patient",
  { name: "Smith" },
  engine.spRegistry,
);
const result = await executeSearch(engine.adapter, request, engine.spRegistry);
```

### 2.3 FHIRPath 求值

```typescript
import {
  evalFhirPath,
  evalFhirPathBoolean,
  evalFhirPathString,
} from "fhir-engine";

const values = evalFhirPath("Patient.name.family", patient); // ['Smith']
const active = evalFhirPathBoolean("Patient.active", patient); // boolean
const family = evalFhirPathString("Patient.name.family", patient); // 'Smith'
```

### 2.4 单入口启动

```typescript
import { createFhirEngine } from "fhir-engine";

const engine = await createFhirEngine({
  database: { type: "sqlite", path: "./fhir.db" },
  packages: { path: "./fhir-packages" },
});
```

一次调用完成：

- 加载 FHIR 定义包（StructureDefinition、SearchParameter 等）
- 创建运行时（FHIRPath、验证）
- 创建存储适配器（SQLite）
- 执行 Schema 迁移
- 初始化持久化层（CRUD + 搜索 + 索引）

### 2.5 插件系统

```typescript
const engine = await createFhirEngine({
  database: { type: "sqlite", path: ":memory:" },
  packages: { path: "./fhir-packages" },
  plugins: [myPlugin],
});
```

四阶段生命周期：`init` → `start` → `ready` → `stop`

| 阶段    | 时机                | `ctx.persistence` |
| ------- | ------------------- | ----------------- |
| `init`  | 持久化初始化之前    | `undefined`       |
| `start` | 持久化初始化之后    | ✅ 可用           |
| `ready` | 所有插件 start 完成 | ✅ 可用           |
| `stop`  | 关闭时（逆序执行）  | ✅ 可用           |

### 2.6 配置文件支持

```typescript
// 零参数启动 — 自动发现 fhir.config.{ts,js,mjs,json}
const engine = await createFhirEngine();
```

支持环境变量覆盖：

- `FHIR_DATABASE_TYPE` → `config.database.type`
- `FHIR_DATABASE_URL` → `config.database.path` / `.url`
- `FHIR_PACKAGES_PATH` → `config.packages.path`

### 2.7 引擎状态查询

```typescript
const status = engine.status();
// {
//   fhirVersions: ['4.0'],
//   loadedPackages: ['hl7.fhir.r4.core@4.0.1'],
//   resourceTypes: ['Patient', 'Observation', ...],
//   databaseType: 'sqlite',
//   igAction: 'new',
//   startedAt: Date,
//   plugins: ['my-plugin'],
// }
```

---

## 3. 依赖关系

### 3.1 上游依赖（Layer 1）

| 包                 | 版本  | 提供的功能                    |
| ------------------ | ----- | ----------------------------- |
| `fhir-definition`  | 0.5.0 | FHIR 定义加载、注册表查询     |
| `fhir-runtime`     | 0.8.1 | FHIRPath、验证、搜索值提取    |
| `fhir-persistence` | 0.1.0 | CRUD、搜索、Schema 迁移、索引 |

### 3.2 下游消费方（Layer 3）

| 包            | 使用方式                           | HTTP |
| ------------- | ---------------------------------- | ---- |
| `fhir-cli`    | 直接嵌入 `createFhirEngine()`      | 无   |
| `fhir-server` | `createFhirEngine()` + HTTP Router | 有   |

### 3.3 禁止的依赖

`fhir-engine` **不可以**依赖：`fhir-server`、`fhir-client`、`fhir-studio`、任何 HTTP 库、任何 UI 库。

---

## 4. 数据库支持

| 类型          | 适配器                 | 状态                  |
| ------------- | ---------------------- | --------------------- |
| `sqlite`      | `BetterSqlite3Adapter` | ✅ 完全可用           |
| `sqlite-wasm` | `SQLiteAdapter`        | ✅ 存在（低优先级）   |
| `postgres`    | `PostgresAdapter`      | ❌ 上游阻断（待修复） |

---

## 5. 源代码结构

```
fhir-engine/
├── src/
│   ├── engine.ts          # createFhirEngine() — 启动编排
│   ├── adapter-factory.ts # createAdapter() — 数据库适配器工厂
│   ├── config.ts          # defineConfig() + loadFhirConfig() + 环境变量覆盖
│   ├── types.ts           # 所有 TypeScript 类型定义
│   ├── logger.ts          # createConsoleLogger() — 默认日志器
│   ├── index.ts           # 公开 API barrel
│   └── __tests__/
│       ├── engine.test.ts # 引擎测试（36 个）
│       ├── plugin.test.ts # 插件测试（21 个）
│       └── config.test.ts # 配置测试（16 个）
├── dist/                  # 构建输出（ESM + CJS + .d.ts）
├── devdocs/               # 内部开发文档
├── docs/                  # 公开文档（本目录）
├── package.json
├── CHANGELOG.md
├── README.md
└── LICENSE
```

---

## 6. 构建与发布

```bash
# 安装依赖
npm install

# 构建（tsc + api-extractor + esbuild）
npm run build

# 运行测试（97 个测试）
npm test

# 发布前检查
npm pack --dry-run
# → 13 files, ~17.7 kB
```

**输出格式：** ESM (`.mjs`) + CJS (`.cjs`) + bundled `.d.ts`

---

## 7. 版本历史

| 版本  | 日期       | 关键变更                                                                               |
| ----- | ---------- | -------------------------------------------------------------------------------------- |
| 0.5.0 | 2026-03-15 | PG import 修复 (`await import`), igResult.error 检查, fhir-persistence ^0.4.0, 97 测试 |
| 0.4.2 | 2026-03-15 | PostgreSQL 支持, fhir-persistence ^0.3.0, sqlite-wasm 移除, 97 测试                    |
| 0.4.1 | 2026-03-15 | 修复缓存包无 root `package.json` 导致 0 资源类型, 96 个测试                            |
| 0.4.0 | 2026-03-15 | `resolvePackages()`, `config.igs` 自动解析, 95 个测试                                  |
| 0.3.0 | 2026-03-15 | `engine.search()`, 重新导出搜索/FHIRPath API, 84 个测试                                |
| 0.2.0 | 2026-03-15 | `engine.status()`, 测试套件 73 个, 配置文件系统                                        |
| 0.1.0 | 2026-03-15 | 核心启动, 插件系统, defineConfig, 零参数启动                                           |

---

## 8. 已知限制

1. ~~**PostgreSQL 不可用**~~ → ✅ 已在 v0.4.2 解决，v0.5.0 修复了 `require('pg')` 问题
2. **sqlite-wasm 已移除** — fhir-persistence v0.3.0 不再导出 `SQLiteAdapter`，`database.type = 'sqlite-wasm'` 将抛出错误，请使用 `'sqlite'`
3. **fhir-runtime 核心 JSON** — `fhir-runtime@0.8.x` 的 npm 包缺少 bundled core definition JSON，引擎自动使用 `preloadCore: false` 绕过

---

_fhir-engine v0.5.0 — 项目概览_
