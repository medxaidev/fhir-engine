# FHIR Engine API 参考文档 (API Reference)

**文档版本**: v1.2.0  
**适用引擎版本**: fhir-engine >= 0.6.2  
**最后更新**: 2026-03-18

---

## 版本兼容性 (Version Compatibility)

| API 功能            | 最低版本                 | 推荐版本 |
| ------------------- | ------------------------ | -------- |
| Core Engine API     | 0.6.0                    | 0.6.2    |
| Search API          | 0.6.0                    | 0.6.2    |
| Reindex V2 API      | 0.6.0                    | 0.6.2    |
| Batch Validation    | 0.9.0 (fhir-runtime)     | 0.11.0   |
| FHIRPath Evaluation | 0.9.0 (fhir-runtime)     | 0.11.0   |
| Profile Slicing API | 0.10.0 (fhir-runtime)    | 0.11.0   |
| Choice Type API     | 0.10.0 (fhir-runtime)    | 0.11.0   |
| BackboneElement API | 0.10.0 (fhir-runtime)    | 0.11.0   |
| IG Extraction API   | 0.11.0 (fhir-runtime)    | 0.11.0   |
| Conformance Module  | 0.7.0 (fhir-persistence) | 0.7.0    |

---

## 目录 (Table of Contents)

1. [核心 API](#核心-api)
2. [配置 API](#配置-api)
3. [CRUD 操作](#crud-操作)
4. [搜索 API](#搜索-api)
5. [验证 API](#验证-api)
6. [FHIRPath API](#fhirpath-api)
7. [Profile Slicing API](#profile-slicing-api)
8. [Choice Type API](#choice-type-api)
9. [BackboneElement API](#backboneelement-api)
10. [IG Extraction API](#ig-extraction-api)
11. [Conformance Module API](#conformance-module-api)
12. [重建索引 API](#重建索引-api)
13. [适配器 API](#适配器-api)
14. [日志 API](#日志-api)
15. [类型定义](#类型定义)

---

## 核心 API

### `createFhirEngine(config: FhirEngineConfig): Promise<FhirEngine>`

创建 FHIR 引擎实例。

**参数**:

- `config`: `FhirEngineConfig` - 引擎配置对象

**返回**: `Promise<FhirEngine>` - FHIR 引擎实例

**示例**:

```typescript
import { createFhirEngine, defineConfig } from "fhir-engine";

const config = defineConfig({
  database: { type: "sqlite", filename: "./fhir.db" },
});

const engine = await createFhirEngine(config);
```

**版本**: >= 0.6.0

---

### `FhirEngine` 接口

#### `initialize(): Promise<void>`

初始化引擎，包括数据库连接、包加载、插件初始化。

**返回**: `Promise<void>`

**示例**:

```typescript
await engine.initialize();
```

**版本**: >= 0.6.0

---

#### `shutdown(): Promise<void>`

关闭引擎，释放资源。

**返回**: `Promise<void>`

**示例**:

```typescript
await engine.shutdown();
```

**版本**: >= 0.6.0

---

#### `getStatus(): FhirEngineStatus`

获取引擎状态。

**返回**: `FhirEngineStatus` - 引擎状态对象

**示例**:

```typescript
const status = engine.getStatus();
console.log("Initialized:", status.initialized);
```

**版本**: >= 0.6.0

---

#### `getPersistence(): FhirPersistence`

获取持久化层实例。

**返回**: `FhirPersistence` - 持久化层对象

**示例**:

```typescript
const persistence = engine.getPersistence();
const adapter = persistence.getAdapter();
```

**版本**: >= 0.6.0

---

#### `getRuntime(): FhirRuntimeInstance`

获取运行时实例。

**返回**: `FhirRuntimeInstance` - 运行时对象

**示例**:

```typescript
const runtime = engine.getRuntime();
```

**版本**: >= 0.6.0

---

#### `getDefinitions(): DefinitionRegistry`

获取定义注册表。

**返回**: `DefinitionRegistry` - 定义注册表对象

**示例**:

```typescript
const definitions = engine.getDefinitions();
const patientDef = definitions.getResourceDefinition("Patient");
```

**版本**: >= 0.6.0

---

## 配置 API

### `defineConfig(config: FhirEngineConfig): FhirEngineConfig`

定义配置对象（提供类型检查）。

**参数**:

- `config`: `FhirEngineConfig` - 配置对象

**返回**: `FhirEngineConfig` - 配置对象

**示例**:

```typescript
const config = defineConfig({
  database: {
    type: "postgres",
    host: "localhost",
    port: 5432,
    database: "fhir_db",
    user: "user",
    password: "pass",
  },
  packages: {
    sources: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
  },
});
```

**版本**: >= 0.6.0

---

### `loadFhirConfig(path: string): Promise<FhirEngineConfig>`

从文件加载配置。

**参数**:

- `path`: `string` - 配置文件路径

**返回**: `Promise<FhirEngineConfig>` - 配置对象

**示例**:

```typescript
const config = await loadFhirConfig("./fhir-config.json");
```

**版本**: >= 0.6.0

---

## CRUD 操作

### `create<T extends Resource>(resource: T): Promise<T>`

创建资源。

**参数**:

- `resource`: `T` - FHIR 资源对象

**返回**: `Promise<T>` - 创建后的资源（包含 id 和 meta）

**示例**:

```typescript
const patient = {
  resourceType: "Patient",
  name: [{ family: "Doe", given: ["John"] }],
};

const created = await engine.create(patient);
console.log("Created ID:", created.id);
```

**版本**: >= 0.6.0

---

### `read<T extends Resource>(resourceType: string, id: string): Promise<T>`

读取资源。

**参数**:

- `resourceType`: `string` - 资源类型
- `id`: `string` - 资源 ID

**返回**: `Promise<T>` - 资源对象

**抛出**: 资源不存在时抛出错误

**示例**:

```typescript
const patient = await engine.read("Patient", "patient-123");
```

**版本**: >= 0.6.0

---

### `update<T extends Resource>(resource: T): Promise<T>`

更新资源。

**参数**:

- `resource`: `T` - 包含 id 的资源对象

**返回**: `Promise<T>` - 更新后的资源

**示例**:

```typescript
patient.active = true;
const updated = await engine.update(patient);
```

**版本**: >= 0.6.0

---

### `delete(resourceType: string, id: string): Promise<void>`

删除资源。

**参数**:

- `resourceType`: `string` - 资源类型
- `id`: `string` - 资源 ID

**返回**: `Promise<void>`

**示例**:

```typescript
await engine.delete("Patient", "patient-123");
```

**版本**: >= 0.6.0

---

## 搜索 API

### `parseSearchRequest(resourceType: string, params: Record<string, any>): SearchRequest`

解析搜索参数。

**参数**:

- `resourceType`: `string` - 资源类型
- `params`: `Record<string, any>` - 搜索参数

**返回**: `SearchRequest` - 搜索请求对象

**示例**:

```typescript
import { parseSearchRequest } from "fhir-engine";

const searchRequest = parseSearchRequest("Patient", {
  family: "Smith",
  gender: "male",
  _count: 10,
  _offset: 0,
});
```

**版本**: >= 0.6.0

---

### `executeSearch(persistence: FhirPersistence, request: SearchRequest, options?: SearchOptions): Promise<SearchResult>`

执行搜索。

**参数**:

- `persistence`: `FhirPersistence` - 持久化层实例
- `request`: `SearchRequest` - 搜索请求
- `options`: `SearchOptions` (可选) - 搜索选项

**返回**: `Promise<SearchResult>` - 搜索结果

**示例**:

```typescript
import { executeSearch, parseSearchRequest } from "fhir-engine";

const searchRequest = parseSearchRequest("Patient", { family: "Smith" });
const results = await executeSearch(engine.getPersistence(), searchRequest);

console.log("Total:", results.total);
console.log(
  "Resources:",
  results.entry?.map((e) => e.resource),
);
```

**版本**: >= 0.6.0

---

### `SearchRequest` 类型

```typescript
interface SearchRequest {
  resourceType: string;
  parameters: SearchParameter[];
  count?: number;
  offset?: number;
  sort?: SortParameter[];
  includes?: string[];
  revIncludes?: string[];
}
```

**版本**: >= 0.6.0

---

### `SearchResult` 类型

```typescript
interface SearchResult {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{
    resource: Resource;
    search?: { mode: "match" | "include" };
  }>;
  link?: Array<{
    relation: string;
    url: string;
  }>;
}
```

**版本**: >= 0.6.0

---

## 验证 API

### `validate<T extends Resource>(resource: T): Promise<ValidationResult>`

验证单个资源。

**参数**:

- `resource`: `T` - 资源对象

**返回**: `Promise<ValidationResult>` - 验证结果

**示例**:

```typescript
const result = await engine.validate(patient);

if (!result.valid) {
  console.error("Validation errors:", result.issues);
}
```

**版本**: >= 0.6.0

---

### `validateBatch(resources: Resource[], options?: BatchValidationOptions): Promise<BatchValidationResult>`

批量验证资源。

**参数**:

- `resources`: `Resource[]` - 资源数组
- `options`: `BatchValidationOptions` (可选) - 验证选项

**返回**: `Promise<BatchValidationResult>` - 批量验证结果

**示例**:

```typescript
const results = await engine.validateBatch([patient1, patient2], {
  stopOnFirstError: false,
  includeWarnings: true,
});

console.log("Valid count:", results.validCount);
console.log("Invalid count:", results.invalidCount);
```

**版本**: >= 0.9.0 (需要 fhir-runtime >= 0.9.0)

---

### `BatchValidationOptions` 类型

```typescript
interface BatchValidationOptions {
  stopOnFirstError?: boolean;
  includeWarnings?: boolean;
  profile?: string;
}
```

**版本**: >= 0.9.0

---

### `BatchValidationResult` 类型

```typescript
interface BatchValidationResult {
  validCount: number;
  invalidCount: number;
  results: Array<{
    resource: Resource;
    valid: boolean;
    issues?: ValidationIssue[];
  }>;
}
```

**版本**: >= 0.9.0

---

## FHIRPath API

### `evalFhirPath(resource: Resource, expression: string): any[]`

执行 FHIRPath 表达式。

**参数**:

- `resource`: `Resource` - FHIR 资源
- `expression`: `string` - FHIRPath 表达式

**返回**: `any[]` - 结果数组

**示例**:

```typescript
import { evalFhirPath } from "fhir-engine";

const names = evalFhirPath(patient, "Patient.name.family");
console.log("Family names:", names);
```

**版本**: >= 0.9.0 (需要 fhir-runtime >= 0.9.0)

---

### `evalFhirPathBoolean(resource: Resource, expression: string): boolean`

执行 FHIRPath 布尔表达式。

**参数**:

- `resource`: `Resource` - FHIR 资源
- `expression`: `string` - FHIRPath 表达式

**返回**: `boolean` - 布尔结果

**示例**:

```typescript
import { evalFhirPathBoolean } from "fhir-engine";

const isActive = evalFhirPathBoolean(patient, "Patient.active = true");
```

**版本**: >= 0.9.0

---

### `evalFhirPathString(resource: Resource, expression: string): string | undefined`

执行 FHIRPath 表达式并返回字符串。

**参数**:

- `resource`: `Resource` - FHIR 资源
- `expression`: `string` - FHIRPath 表达式

**返回**: `string | undefined` - 字符串结果

**示例**:

```typescript
import { evalFhirPathString } from "fhir-engine";

const familyName = evalFhirPathString(patient, "Patient.name.first().family");
```

**版本**: >= 0.9.0

---

### `evalFhirPathTyped(resource: Resource, expression: string): TypedValue[]`

执行 FHIRPath 表达式并返回类型化值。

**参数**:

- `resource`: `Resource` - FHIR 资源
- `expression`: `string` - FHIRPath 表达式

**返回**: `TypedValue[]` - 类型化值数组

**版本**: >= 0.9.0

---

## Profile Slicing API

### `buildSlicingDefinition(slicing: ElementDefinitionSlicing | undefined): SlicingDefinition | undefined`

从 `ElementDefinitionSlicing` 构建规范化的 `SlicingDefinition`。

**参数**:

- `slicing`: `ElementDefinitionSlicing | undefined` - 元素定义中的切片信息

**返回**: `SlicingDefinition | undefined` - 规范化的切片定义

**示例**:

```typescript
import { buildSlicingDefinition } from "fhir-engine";

const slicingDef = buildSlicingDefinition(element.slicing);
```

**版本**: >= 0.6.1 (需要 fhir-runtime >= 0.10.0)

---

### `makeExtensionSlicing(): ElementDefinitionSlicing`

创建扩展元素的标准切片定义（按 `url` 切片，使用 `value` 判别器）。

**返回**: `ElementDefinitionSlicing` - 扩展切片定义

**示例**:

```typescript
import { makeExtensionSlicing } from "fhir-engine";

const extSlicing = makeExtensionSlicing();
```

**版本**: >= 0.6.1

---

### `hasSliceName(elementId: string): boolean`

检查元素 id 是否包含切片名称（`:` 分隔符）。

**参数**:

- `elementId`: `string` - 元素 id

**返回**: `boolean`

**示例**:

```typescript
import { hasSliceName } from "fhir-engine";

hasSliceName("Patient.identifier:MRN"); // true
hasSliceName("Patient.identifier"); // false
```

**版本**: >= 0.6.1

---

### `extractSliceName(elementId: string): string`

从元素 id 中提取切片名称。

**参数**:

- `elementId`: `string` - 元素 id

**返回**: `string` - 切片名称

**示例**:

```typescript
import { extractSliceName } from "fhir-engine";

extractSliceName("Patient.identifier:MRN"); // 'MRN'
```

**版本**: >= 0.6.1

---

### `getSliceSiblings(...)`

获取同一切片根路径下的所有命名切片元素。

**版本**: >= 0.6.1

---

### `validateSlicingCompatibility(baseSlicing, diffSlicing, issues, path): boolean`

验证 differential 中的切片定义是否与 base 切片定义兼容。

**参数**:

- `baseSlicing`: `ElementDefinitionSlicing` - 基础元素的切片定义
- `diffSlicing`: `ElementDefinitionSlicing` - differential 元素的切片定义
- `issues`: `SnapshotIssue[]` - 问题收集数组
- `path`: `string` - 元素路径

**返回**: `boolean` - 是否兼容

**版本**: >= 0.6.1

---

### `SlicingDefinition` 类型

```typescript
interface SlicingDefinition {
  discriminators: SlicingDiscriminatorDef[];
  rules: SlicingRules;
  ordered: boolean;
}
```

**版本**: >= 0.6.1

---

### `SlicingDiscriminatorDef` 类型

```typescript
interface SlicingDiscriminatorDef {
  type: DiscriminatorType;
  path: string;
}
```

**版本**: >= 0.6.1

---

### `SlicingRules` 类型

```typescript
type SlicingRules = "closed" | "open" | "openAtEnd";
```

**版本**: >= 0.6.1

---

## Choice Type API

### `isChoiceTypePath(path: string): boolean`

检查路径是否以 `[x]` 结尾（选择类型通配符）。

**参数**:

- `path`: `string` - 元素路径

**返回**: `boolean`

**示例**:

```typescript
import { isChoiceTypePath } from "fhir-engine";

isChoiceTypePath("Observation.value[x]"); // true
isChoiceTypePath("Observation.valueString"); // false
isChoiceTypePath("Observation.value"); // false
```

**版本**: >= 0.6.1

---

### `matchesChoiceType(choicePath: string, concretePath: string): boolean`

检查具体路径是否匹配选择类型路径。

**参数**:

- `choicePath`: `string` - 选择类型路径（如 `Observation.value[x]`）
- `concretePath`: `string` - 具体路径（如 `Observation.valueQuantity`）

**返回**: `boolean`

**示例**:

```typescript
import { matchesChoiceType } from "fhir-engine";

matchesChoiceType("Observation.value[x]", "Observation.valueQuantity"); // true
matchesChoiceType("Observation.value[x]", "Observation.valueString"); // true
matchesChoiceType("Observation.value[x]", "Observation.code"); // false
```

**版本**: >= 0.6.1

---

### `extractChoiceTypeName(choicePath: string, concretePath: string): string`

从具体路径中提取选择类型的类型名称。

**参数**:

- `choicePath`: `string` - 选择类型路径
- `concretePath`: `string` - 具体路径

**返回**: `string` - 类型名称

**示例**:

```typescript
import { extractChoiceTypeName } from "fhir-engine";

extractChoiceTypeName("Observation.value[x]", "Observation.valueQuantity"); // 'Quantity'
```

**版本**: >= 0.6.1

---

### `ChoiceTypeField` 类型

```typescript
interface ChoiceTypeField {
  // Choice type 字段的元数据
}
```

**版本**: >= 0.6.1

---

### `ChoiceValue` 类型

```typescript
interface ChoiceValue {
  // Choice type 值的元数据
}
```

**版本**: >= 0.6.1

---

## BackboneElement API

### `isBackboneElementType(element: CanonicalElement): boolean`

检查元素是否定义了 BackboneElement 或 Element 内部类型。当元素的 `types` 数组包含 `code === 'BackboneElement'` 或 `code === 'Element'` 时返回 `true`。

**参数**:

- `element`: `CanonicalElement` - 规范化元素

**返回**: `boolean`

**示例**:

```typescript
import { isBackboneElementType } from "fhir-engine";

isBackboneElementType(contactElement); // true (Patient.contact)
isBackboneElementType(nameElement); // false (Patient.name is HumanName)
```

**版本**: >= 0.6.1

---

## IG Extraction API

### `extractSDDependencies(sd: StructureDefinition): string[]`

从 StructureDefinition 中提取所有直接依赖的类型名称。扫描 snapshot.element[].type[].code 和 profile，去重后返回。

**参数**:

- `sd`: `StructureDefinition` - 完整的 SD（需有 snapshot）

**返回**: `string[]` - 依赖的类型名/Profile URL 数组（去重排序）

**示例**:

```typescript
import { extractSDDependencies } from "fhir-engine";

const deps = extractSDDependencies(patientSD);
// ['HumanName', 'Identifier', 'Address', ...]
```

**版本**: >= 0.6.2 (需要 fhir-runtime >= 0.11.0)

---

### `extractElementIndexRows(sd: StructureDefinition): ElementIndexRow[]`

从 StructureDefinition snapshot 中提取 element 索引行。每个 element 转换为一个 ElementIndexRow。

**参数**:

- `sd`: `StructureDefinition` - 完整的 SD（需有 snapshot）

**返回**: `ElementIndexRow[]` - element 索引行数组

**版本**: >= 0.6.2

---

### `flattenConceptHierarchy(codeSystem: CodeSystemDefinition): ConceptRow[]`

将 CodeSystem.concept[] 嵌套结构扁平化为 parent-child 行。

**参数**:

- `codeSystem`: `CodeSystemDefinition` - CodeSystem 资源

**返回**: `ConceptRow[]` - 扁平化的 concept 行数组

**版本**: >= 0.6.2

---

### `ElementIndexRow` 类型

```typescript
interface ElementIndexRow {
  id: string;
  structureId: string;
  path: string;
  min?: number;
  max?: string;
  typeCodes: string[];
  isSlice: boolean;
  sliceName?: string;
  isExtension: boolean;
  bindingValueSet?: string;
  mustSupport: boolean;
}
```

**版本**: >= 0.6.2

---

### `ConceptRow` 类型

```typescript
interface ConceptRow {
  id: string;
  codeSystemUrl: string;
  codeSystemVersion?: string;
  code: string;
  display?: string;
  parentCode: string | null;
  level: number;
}
```

**版本**: >= 0.6.2

---

## Conformance Module API

### `IGImportOrchestrator`

协调所有 conformance repo，执行完整 IG 导入流程。

```typescript
class IGImportOrchestrator {
  constructor(
    adapter: StorageAdapter,
    dialect: DDLDialect,
    options?: {
      extractElementIndex?: (
        sd: Record<string, unknown>,
      ) => ElementIndexEntry[];
      flattenConcepts?: (
        cs: Record<string, unknown>,
      ) => ConceptHierarchyEntry[];
    },
  );

  ensureAllTables(): Promise<void>;
  importIG(igId: string, bundle: FhirBundle): Promise<IGImportResult>;
  get repos(): {
    resourceMap;
    sdIndex;
    elementIndex;
    expansionCache;
    conceptHierarchy;
    searchParamIndex;
  };
}
```

**版本**: >= 0.6.2 (需要 fhir-persistence >= 0.7.0)

---

### `IGResourceMapRepo`

IG 资源映射表 CRUD。

```typescript
class IGResourceMapRepo {
  ensureTable(): Promise<void>;
  batchInsert(igId: string, entries: IGResourceMapEntry[]): Promise<number>;
  getIGIndex(igId: string): Promise<IGIndex>;
  getByType(igId: string, resourceType: string): Promise<IGResourceMapEntry[]>;
  removeIG(igId: string): Promise<void>;
}
```

**版本**: >= 0.6.2

---

### `SDIndexRepo`

StructureDefinition 索引表 CRUD。

```typescript
class SDIndexRepo {
  ensureTable(): Promise<void>;
  upsert(entry: SDIndexEntry): Promise<void>;
  batchUpsert(entries: SDIndexEntry[]): Promise<number>;
  getById(id: string): Promise<SDIndexEntry | undefined>;
  getByUrl(url: string): Promise<SDIndexEntry[]>;
  getByType(type: string): Promise<SDIndexEntry[]>;
  getByBaseDefinition(baseUrl: string): Promise<SDIndexEntry[]>;
  remove(id: string): Promise<void>;
}
```

**版本**: >= 0.6.2

---

### `ElementIndexRepo`

Element 索引表 CRUD。

```typescript
class ElementIndexRepo {
  ensureTable(): Promise<void>;
  batchInsert(
    structureId: string,
    elements: ElementIndexEntry[],
  ): Promise<number>;
  getByStructureId(structureId: string): Promise<ElementIndexEntry[]>;
  searchByPath(pathPattern: string): Promise<ElementIndexEntry[]>;
  removeByStructureId(structureId: string): Promise<void>;
}
```

**版本**: >= 0.6.2

---

### `ExpansionCacheRepo`

ValueSet expansion 缓存表。

```typescript
class ExpansionCacheRepo {
  ensureTable(): Promise<void>;
  upsert(
    url: string,
    version: string,
    expansionJson: string,
    codeCount: number,
  ): Promise<void>;
  get(url: string, version: string): Promise<CachedExpansion | undefined>;
  invalidate(url: string, version: string): Promise<void>;
  clear(): Promise<void>;
}
```

**版本**: >= 0.6.2

---

### `ConceptHierarchyRepo`

CodeSystem concept 层级表 CRUD。

```typescript
class ConceptHierarchyRepo {
  ensureTable(): Promise<void>;
  batchInsert(entries: ConceptHierarchyEntry[]): Promise<number>;
  getTree(codeSystemUrl: string): Promise<ConceptHierarchyEntry[]>;
  getChildren(
    codeSystemUrl: string,
    parentCode: string,
  ): Promise<ConceptHierarchyEntry[]>;
  lookup(
    codeSystemUrl: string,
    code: string,
  ): Promise<ConceptHierarchyEntry | undefined>;
  removeByCodeSystem(codeSystemUrl: string): Promise<void>;
}
```

**版本**: >= 0.6.2

---

### `SearchParamIndexRepo`

SearchParameter 索引表 CRUD。

**版本**: >= 0.6.2

---

### Conformance 类型

```typescript
interface IGResourceMapEntry {
  igId: string;
  resourceType: string;
  resourceId: string;
  resourceUrl?: string;
  resourceName?: string;
  baseType?: string;
}

interface IGIndex {
  profiles: IGResourceMapEntry[];
  extensions: IGResourceMapEntry[];
  valueSets: IGResourceMapEntry[];
  codeSystems: IGResourceMapEntry[];
  searchParameters: IGResourceMapEntry[];
}

interface SDIndexEntry {
  id: string;
  url?: string;
  version?: string;
  type?: string;
  kind?: string;
  baseDefinition?: string;
  derivation?: string;
  snapshotHash?: string;
}

interface ElementIndexEntry {
  id: string;
  structureId: string;
  path: string;
  min?: number;
  max?: string;
  typeCodes?: string[];
  isSlice?: boolean;
  sliceName?: string;
  isExtension?: boolean;
  bindingValueSet?: string;
  mustSupport?: boolean;
}

interface CachedExpansion {
  valuesetUrl: string;
  version: string;
  expandedAt: string;
  codeCount: number;
  expansionJson: string;
}

interface ConceptHierarchyEntry {
  id: string;
  codeSystemUrl: string;
  codeSystemVersion?: string;
  code: string;
  display?: string;
  parentCode?: string;
  level: number;
}

interface IGImportResult {
  igId: string;
  resourceCount: number;
  sdIndexCount: number;
  elementIndexCount: number;
  conceptCount: number;
  spIndexCount: number;
  errors: string[];
}
```

**版本**: >= 0.6.2

---

## 重建索引 API

### `reindexResourceTypeV2(adapter: StorageAdapter, runtime: FhirRuntimeInstance, resourceType: string): Promise<void>`

重建指定资源类型的索引。

**参数**:

- `adapter`: `StorageAdapter` - 存储适配器
- `runtime`: `FhirRuntimeInstance` - 运行时实例
- `resourceType`: `string` - 资源类型

**返回**: `Promise<void>`

**示例**:

```typescript
import { reindexResourceTypeV2 } from "fhir-engine";

await reindexResourceTypeV2(
  engine.getPersistence().getAdapter(),
  engine.getRuntime(),
  "Patient",
);
```

**版本**: >= 0.6.0 (需要 fhir-persistence >= 0.6.0)

---

### `reindexAllV2(adapter: StorageAdapter, runtime: FhirRuntimeInstance): Promise<void>`

重建所有资源类型的索引。

**参数**:

- `adapter`: `StorageAdapter` - 存储适配器
- `runtime`: `FhirRuntimeInstance` - 运行时实例

**返回**: `Promise<void>`

**示例**:

```typescript
import { reindexAllV2 } from "fhir-engine";

await reindexAllV2(engine.getPersistence().getAdapter(), engine.getRuntime());
```

**版本**: >= 0.6.0

---

## 适配器 API

### `createAdapter(config: DatabaseConfig): StorageAdapter`

创建存储适配器。

**参数**:

- `config`: `DatabaseConfig` - 数据库配置

**返回**: `StorageAdapter` - 存储适配器实例

**示例**:

```typescript
import { createAdapter } from "fhir-engine";

const adapter = createAdapter({
  type: "sqlite",
  filename: "./fhir.db",
});
```

**版本**: >= 0.6.0

---

## 日志 API

### `createConsoleLogger(level?: 'debug' | 'info' | 'warn' | 'error'): Logger`

创建控制台日志记录器。

**参数**:

- `level`: `'debug' | 'info' | 'warn' | 'error'` (可选) - 日志级别，默认 'info'

**返回**: `Logger` - 日志记录器实例

**示例**:

```typescript
import { createConsoleLogger } from "fhir-engine";

const logger = createConsoleLogger("debug");
```

**版本**: >= 0.6.0

---

### `Logger` 接口

```typescript
interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}
```

**版本**: >= 0.6.0

---

## 类型定义

### `FhirEngineConfig`

```typescript
interface FhirEngineConfig {
  database: DatabaseConfig;
  packages?: PackagesConfig;
  logger?: Logger;
  plugins?: FhirEnginePlugin[];
}
```

**版本**: >= 0.6.0

---

### `DatabaseConfig`

```typescript
type DatabaseConfig =
  | SqliteDatabaseConfig
  | SqliteWasmDatabaseConfig
  | PostgresDatabaseConfig;

interface SqliteDatabaseConfig {
  type: "sqlite";
  filename: string;
}

interface SqliteWasmDatabaseConfig {
  type: "sqlite-wasm";
  filename?: string;
}

interface PostgresDatabaseConfig {
  type: "postgres";
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  poolSize?: number;
}
```

**版本**: >= 0.6.0

---

### `PackagesConfig`

```typescript
interface PackagesConfig {
  sources: Array<{
    name: string;
    version: string;
    url?: string;
  }>;
  cacheDir?: string;
}
```

**版本**: >= 0.6.0

---

### `FhirEnginePlugin`

```typescript
interface FhirEnginePlugin {
  name: string;
  version: string;
  initialize(context: EngineContext): Promise<void>;
  shutdown?(): Promise<void>;
}

interface EngineContext {
  engine: FhirEngine;
  persistence: FhirPersistence;
  runtime: FhirRuntimeInstance;
  definitions: DefinitionRegistry;
  logger: Logger;
}
```

**版本**: >= 0.6.0

---

### `FhirEngineStatus`

```typescript
interface FhirEngineStatus {
  initialized: boolean;
  database: "connected" | "disconnected" | "error";
  packagesLoaded: boolean;
  pluginsLoaded: number;
}
```

**版本**: >= 0.6.0

---

## 包解析 API

### `resolvePackages(options: ResolvePackagesOptions): Promise<ResolvePackagesResult>`

解析 FHIR 包。

**参数**:

- `options`: `ResolvePackagesOptions` - 解析选项

**返回**: `Promise<ResolvePackagesResult>` - 解析结果

**示例**:

```typescript
import { resolvePackages } from "fhir-engine";

const result = await resolvePackages({
  sources: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
  cacheDir: "./fhir-packages",
});

console.log("Resolved packages:", result.packages);
```

**版本**: >= 0.6.0

---

## 错误代码 (Error Codes)

| 错误代码              | 描述         | 版本     |
| --------------------- | ------------ | -------- |
| `VALIDATION_ERROR`    | 资源验证失败 | >= 0.6.0 |
| `RESOURCE_NOT_FOUND`  | 资源不存在   | >= 0.6.0 |
| `DUPLICATE_RESOURCE`  | 资源重复     | >= 0.6.0 |
| `DATABASE_ERROR`      | 数据库错误   | >= 0.6.0 |
| `CONFIGURATION_ERROR` | 配置错误     | >= 0.6.0 |
| `PACKAGE_LOAD_ERROR`  | 包加载失败   | >= 0.6.0 |

---

## 相关文档

- [接入指南](./INTEGRATION-GUIDE.md)
- [架构概览](./ARCHITECTURE-OVERVIEW.md)
- [故障排查](./TROUBLESHOOTING.md)
- [问题上报](./BLOCKING-ISSUES.md)
