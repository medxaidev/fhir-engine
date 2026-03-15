# fhir-engine — Upstream Requirements

Version: v1.0
Date: 2026-03-14
Status: Active

本文档整理 fhir-engine 对三个上游项目的修改需求。按优先级和阶段分组。

---

## 总览

| ID | Package | Priority | Summary | Triggered By | Status |
|---|---|---|---|---|---|
| R1 | fhir-runtime | P0 | 升级 fhir-definition peer dep 到 ^0.5.0 | Phase 1 | ✅ 已完成 |
| R4 | fhir-runtime | P1 | 修复 dist/ 中缺失的 core JSON 定义文件 | Phase 1 | ⚠️ 已绕过 (preloadCore: false) |
| P1 | fhir-persistence | P0 | 导出 PostgresAdapter | Phase 4 | ❌ 待修复 |
| P2 | fhir-persistence | P2 | FhirPersistence 暴露 vread/history | Phase 2 | ✅ 已存在 (readVersion/readHistory) |
| R2 | fhir-runtime | P1 | FhirRuntimeInstance 接口冻结 | Phase 1 | ⏳ 待确认 |
| P3 | fhir-persistence | P4 | PostgreSQL 连接池配置 | Phase 4 | ⏳ 待实现 |
| R3 | fhir-runtime | P4 | getCapabilityStatement() | Phase 5 | ⏳ 待实现 |
| D1 | fhir-definition | P0 | 确认 v0.5.x 向后兼容 | Phase 1 | ✅ 已确认 |
| D2 | fhir-definition | P5 | 网络 IG 下载 | Phase 6 | ⏳ 待实现 |
| D3 | fhir-definition | P5 | DefinitionProvider 接口冻结 v1.0 | v1.0 | ⏳ 待实现 |

---

## fhir-persistence

### P1: 导出 PostgresAdapter [Phase 4] ❌

**问题：** `fhir-persistence@0.1.0` 的 `src/index.ts` 未导出 `PostgresAdapter`。当前已导出的 6 个符号：

- ✅ `FhirSystem`
- ✅ `BetterSqlite3Adapter`
- ✅ `SQLiteAdapter`
- ✅ `FhirDefinitionBridge`
- ✅ `FhirRuntimeProvider`
- ✅ `IGPersistenceManager`
- ❌ `PostgresAdapter` — **缺失**

**影响：** fhir-engine 的 `createAdapter({ type: 'postgres' })` 无法工作。Phase 1 使用 SQLite 绕过，但 Phase 4 生产部署需要 PostgreSQL。

**修复方法：** 在 `fhir-persistence/src/index.ts` 中添加：

```ts
export { PostgresAdapter } from './db/postgres-adapter.js';
```

如果 `PostgresAdapter` 类尚未实现，需先实现 `StorageAdapter` 接口的 PostgreSQL 版本。

**验证：**

```ts
import { PostgresAdapter } from 'fhir-persistence';
const adapter = new PostgresAdapter({ connectionString: 'postgresql://...' });
```

---

### P2: FhirPersistence vread / history [Phase 2] ✅ 已解决

**原始需求：** `FhirPersistence` facade 需暴露 `vread(type, id, versionId)` 和 `history(type, id, options?)`。

**验证结果：** `fhir-persistence@0.1.0` 的 `FhirPersistence` 已包含：

```ts
readVersion(resourceType: string, id: string, versionId: string): Promise<PersistedResource>;
readHistory(resourceType: string, id: string, options?: HistoryOptions): Promise<HistoryEntry[]>;
```

**无需修改。**

---

### P3: PostgreSQL 连接池配置 [Phase 4] ⏳

**需求：** 生产环境 PostgreSQL 需要连接池和 SSL 配置。

**期望接口：**

```ts
interface PostgresAdapterOptions {
  connectionString: string;
  poolSize?: number;            // default: 10
  ssl?: boolean | TlsOptions;   // default: false
  connectionTimeout?: number;    // default: 30000ms
  idleTimeout?: number;         // default: 10000ms
}
```

**触发时间：** Phase 4 (Production Plugins)。

---

## fhir-runtime

### R1: 升级 fhir-definition peer dep [Phase 1] ✅ 已完成

**问题：** `fhir-runtime@0.8.0` 声明 `fhir-definition@0.4.0` 为 peer dependency，导致与 `fhir-engine` 使用的 `fhir-definition@0.5.0` 产生版本冲突。

**修复：** 已在 `fhir-runtime@0.8.1` 中完成，peer dependency 升级为 `fhir-definition@^0.5.0`。

---

### R4: 修复 dist/ 缺失的 core JSON 定义文件 [Phase 1] ⚠️ 已绕过

**问题：** `fhir-runtime@0.8.1` 的 `createRuntime()` 默认执行 `preloadCoreDefinitions()`，该方法从 `dirname(import.meta.url)` 加载约 70 个 JSON 文件（Resource.json, DomainResource.json, Element.json, BackboneElement.json, Extension.json, 20 个 primitive types, 25 个 complex types, 23 个 core resources）。但这些 JSON 文件未包含在 npm 包的 `dist/esm/` 和 `dist/cjs/` 中。

**错误信息：**

```
LoaderError: Loader 'core-definitions' failed to load
  http://hl7.org/fhir/StructureDefinition/Resource:
  ENOENT: no such file or directory, open '.../dist/esm/Resource.json'
```

**根因：** esbuild 构建脚本未将 `src/definitions/*.json` 复制到 `dist/` 输出目录。

**当前绕过方式：** fhir-engine 使用 `createRuntime({ definitions: registry, preloadCore: false })`。这在语义上是正确的 — fhir-definition 的 `DefinitionRegistry` 是定义的唯一数据源。

**推荐修复（二选一）：**

1. **方案 A（推荐）：** 当 `definitions` (DefinitionProvider) 已提供时，`preloadCore` 默认为 `false`：

```ts
// create-runtime.ts
const preloadCore = opts.preloadCore ?? (opts.definitions ? false : true);
```

2. **方案 B：** 在 esbuild 构建脚本中添加 JSON 文件复制：

```js
// scripts/esbuild.mjs — 增加 copy plugin
import { cpSync } from 'fs';
cpSync('src/definitions', 'dist/esm', { recursive: true });
cpSync('src/definitions', 'dist/cjs', { recursive: true });
```

**验证：**

```ts
// 方案 A 验证：不传 preloadCore 也不报错
const runtime = await createRuntime({ definitions: registry });

// 方案 B 验证：dist/esm/Resource.json 文件存在
import { existsSync } from 'fs';
assert(existsSync('node_modules/fhir-runtime/dist/esm/Resource.json'));
```

---

### R2: FhirRuntimeInstance 接口冻结 [Phase 1] ⏳

**需求：** `FhirRuntimeInstance` 接口从 v0.8 到 v1.0 不应有破坏性变更。fhir-engine 依赖的方法：

```ts
interface FhirRuntimeInstance {
  readonly definitions: DefinitionProvider;
  readonly context: FhirContext;
  validate(resource: Resource, profileUrl: string): Promise<ValidationResult>;
  getSearchParameters(resourceType: string): FhirDefSearchParameter[];
  extractSearchValues(resource: Resource, searchParam: SearchParameter): SearchIndexEntry;
}
```

**行动项：** fhir-runtime maintainer 确认以上 API 在 v1.0 之前不会发生破坏性变更。

---

### R3: getCapabilityStatement() [Phase 5] ⏳

**需求：** 生成 FHIR CapabilityStatement 资源，用于 fhir-server REST API 的 `/metadata` 端点和 SMART-on-FHIR auth plugin。

**期望接口：**

```ts
interface FhirRuntimeInstance {
  // ... existing methods ...
  getCapabilityStatement(resourceTypes: string[]): CapabilityStatement;
}
```

**触发时间：** Phase 5 (Application Integration)。

---

## fhir-definition

### D1: v0.5.x 向后兼容 [Phase 1] ✅ 已确认

`fhir-definition@0.5.0` 是 `@0.4.x` 的非破坏性升级。`loadDefinitionPackages()` 和 `DefinitionRegistry` 接口未发生变化。

---

### D2: 网络 IG 下载 [Phase 6] ⏳

**需求：** 从 `packages.fhir.org` 下载 FHIR 包并缓存到本地。

**期望接口：**

```ts
import { loadPackagesByName } from 'fhir-definition';

const { registry, packages } = await loadPackagesByName([
  { name: 'hl7.fhir.r4.core', version: '4.0.1' },
  { name: 'hl7.fhir.us.core', version: '6.1.0' },
], {
  cacheDir: '~/.fhir/packages',
});
```

**注：** README 中已有 `loadPackagesByName` 示例，可能已在 v0.5.0 中实现。需验证。

**触发时间：** Phase 6 (Ecosystem Expansion)。

---

### D3: DefinitionProvider 接口冻结 [v1.0] ⏳

**需求：** `DefinitionProvider` 接口在 v1.0 时 freeze，后续扩展使用 `DefinitionProviderV2`。

当前接口：

```ts
interface DefinitionProvider {
  getStructureDefinition(url: string): StructureDefinition | undefined;
  getValueSet(url: string): ValueSet | undefined;
  getCodeSystem(url: string): CodeSystem | undefined;
  getSearchParameters(resourceType: string): SearchParameter[];
}
```

**触发时间：** fhir-definition v1.0。

---

## 优先级路线图

```
Phase 1 (v0.1.0) — ✅ 已完成
  R1 ✅  fhir-runtime peer dep 升级
  D1 ✅  fhir-definition v0.5.x 兼容性确认
  R4 ⚠️  fhir-runtime core JSON 缺失（已绕过）

Phase 2 (v0.2.0) — 即将开始
  P2 ✅  vread/history 已存在，无需修改

Phase 4 (v0.4.0)
  P1 ❌  PostgresAdapter 导出
  P3 ⏳  PostgreSQL 连接池配置

Phase 5 (v0.5.0)
  R3 ⏳  getCapabilityStatement()

Phase 6 (v0.6.0+)
  D2 ⏳  网络 IG 下载

v1.0
  R2 ⏳  FhirRuntimeInstance 接口冻结
  D3 ⏳  DefinitionProvider 接口冻结
```
