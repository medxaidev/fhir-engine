# FHIR Engine 接入指南 (Integration Guide)

**文档版本**: v1.3.0  
**适用引擎版本**: fhir-engine >= 0.7.0  
**最后更新**: 2026-03-20

---

## 版本要求 (Version Requirements)

### 必需环境 (Required Environment)

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **TypeScript**: >= 5.0.0 (推荐 5.9.3)

### 核心依赖版本 (Core Dependencies)

- **fhir-engine**: ^0.7.0
- **fhir-definition**: ^0.6.0
- **fhir-persistence**: ^0.9.0
- **fhir-runtime**: ^0.11.0

### 数据库支持 (Database Support)

- **SQLite**: better-sqlite3 >= 7.6.0 或 @sqlite.org/sqlite-wasm
- **PostgreSQL**: pg >= 8.20.0, PostgreSQL Server >= 12.0

---

## 快速开始 (Quick Start)

### 1. 安装 (Installation)

```bash
npm install fhir-engine
```

### 2. 基础配置 (Basic Configuration)

#### SQLite 配置示例

```typescript
import { createFhirEngine, defineConfig } from "fhir-engine";

const config = defineConfig({
  database: {
    type: "sqlite",
    filename: "./fhir-data.db",
  },
  packages: {
    sources: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
  },
});

const engine = await createFhirEngine(config);
await engine.initialize();
```

#### PostgreSQL 配置示例

```typescript
import { createFhirEngine, defineConfig } from "fhir-engine";

const config = defineConfig({
  database: {
    type: "postgres",
    host: "localhost",
    port: 5432,
    database: "fhir_db",
    user: "fhir_user",
    password: "your_password",
  },
  packages: {
    sources: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
  },
});

const engine = await createFhirEngine(config);
await engine.initialize();
```

### 3. 基本操作 (Basic Operations)

#### 创建资源 (Create Resource)

```typescript
const patient = {
  resourceType: "Patient",
  name: [{ family: "Smith", given: ["John"] }],
  gender: "male",
  birthDate: "1980-01-01",
};

const created = await engine.create(patient);
console.log("Created patient:", created.id);
```

#### 读取资源 (Read Resource)

```typescript
const patient = await engine.read("Patient", "patient-id");
console.log("Patient:", patient);
```

#### 更新资源 (Update Resource)

```typescript
patient.telecom = [{ system: "phone", value: "555-1234" }];
const updated = await engine.update(patient);
```

#### 删除资源 (Delete Resource)

```typescript
await engine.delete("Patient", "patient-id");
```

#### 搜索资源 (Search Resources)

```typescript
import { parseSearchRequest, executeSearch } from "fhir-engine";

const searchRequest = parseSearchRequest("Patient", {
  family: "Smith",
  gender: "male",
});

const results = await executeSearch(engine.getPersistence(), searchRequest);

console.log("Found patients:", results.entry?.length);
```

---

## 高级配置 (Advanced Configuration)

### 完整配置选项

```typescript
import { defineConfig, createConsoleLogger } from "fhir-engine";

const config = defineConfig({
  // 数据库配置
  database: {
    type: "postgres",
    host: "localhost",
    port: 5432,
    database: "fhir_db",
    user: "fhir_user",
    password: "password",
    ssl: false,
    poolSize: 10,
  },

  // FHIR 包配置
  packages: {
    sources: [
      { name: "hl7.fhir.r4.core", version: "4.0.1" },
      { name: "hl7.fhir.us.core", version: "5.0.1" },
    ],
    cacheDir: "./fhir-packages",
  },

  // 日志配置
  logger: createConsoleLogger("info"),

  // 插件配置
  plugins: [
    // 自定义插件
  ],
});
```

### 自定义日志 (Custom Logger)

```typescript
import type { Logger } from "fhir-engine";

const customLogger: Logger = {
  debug: (msg, meta) => console.debug(msg, meta),
  info: (msg, meta) => console.info(msg, meta),
  warn: (msg, meta) => console.warn(msg, meta),
  error: (msg, meta) => console.error(msg, meta),
};

const config = defineConfig({
  database: {
    /* ... */
  },
  logger: customLogger,
});
```

### 插件开发 (Plugin Development)

```typescript
import type { FhirEnginePlugin, EngineContext } from "fhir-engine";

const myPlugin: FhirEnginePlugin = {
  name: "my-custom-plugin",
  version: "1.0.0",

  async initialize(context: EngineContext) {
    console.log("Plugin initialized");
    // 访问 context.engine, context.persistence, context.runtime
  },

  async shutdown() {
    console.log("Plugin shutdown");
  },
};

const config = defineConfig({
  database: {
    /* ... */
  },
  plugins: [myPlugin],
});
```

---

## 数据迁移 (Data Migration)

### 重建索引 (Reindex)

```typescript
import { reindexResourceTypeV2, reindexAllV2 } from "fhir-engine";

// 重建单个资源类型索引
await reindexResourceTypeV2(
  engine.getPersistence().getAdapter(),
  engine.getRuntime(),
  "Patient",
);

// 重建所有资源索引
await reindexAllV2(engine.getPersistence().getAdapter(), engine.getRuntime());
```

---

## 验证和校验 (Validation)

### 资源验证

```typescript
const validationResult = await engine.validate(patient);

if (!validationResult.valid) {
  console.error("Validation errors:", validationResult.issues);
}
```

### 批量验证 (Batch Validation)

```typescript
import type { BatchValidationOptions } from "fhir-engine";

const options: BatchValidationOptions = {
  stopOnFirstError: false,
  includeWarnings: true,
};

const results = await engine.validateBatch([patient1, patient2], options);
```

---

## FHIRPath 查询 (FHIRPath Evaluation)

```typescript
import { evalFhirPath, evalFhirPathBoolean } from "fhir-engine";

// 提取值
const names = evalFhirPath(patient, "Patient.name.family");
console.log("Family names:", names);

// 布尔判断
const isActive = evalFhirPathBoolean(patient, "Patient.active = true");
console.log("Is active:", isActive);
```

---

## Profile Slicing (v0.6.1+)

FHIR 切片 API — 构建切片定义、检测切片名称、验证切片兼容性：

```typescript
import {
  buildSlicingDefinition,
  makeExtensionSlicing,
  hasSliceName,
  extractSliceName,
  getSliceSiblings,
  validateSlicingCompatibility,
} from "fhir-engine";
import type {
  SlicingDefinition,
  SlicingDiscriminatorDef,
  SlicingRules,
} from "fhir-engine";

// 从 ElementDefinitionSlicing 构建 SlicingDefinition
const slicingDef = buildSlicingDefinition(element.slicing);

// 创建扩展切片（按 url 切片，value 判别器）
const extSlicing = makeExtensionSlicing();

// 检查元素 id 是否包含切片名称
hasSliceName("Patient.identifier:MRN"); // true
hasSliceName("Patient.identifier"); // false

// 从元素 id 提取切片名称
extractSliceName("Patient.identifier:MRN"); // 'MRN'
```

---

## Choice Type 工具函数 (v0.6.1+)

处理 FHIR 选择类型元素（`value[x]`、`onset[x]` 等）：

```typescript
import {
  isChoiceTypePath,
  matchesChoiceType,
  extractChoiceTypeName,
} from "fhir-engine";
import type { ChoiceTypeField, ChoiceValue } from "fhir-engine";

// 检查路径是否为选择类型
isChoiceTypePath("Observation.value[x]"); // true
isChoiceTypePath("Observation.valueString"); // false

// 检查具体路径是否匹配选择类型路径
matchesChoiceType("Observation.value[x]", "Observation.valueQuantity"); // true
matchesChoiceType("Observation.value[x]", "Observation.code"); // false

// 从具体路径提取类型名称
extractChoiceTypeName("Observation.value[x]", "Observation.valueQuantity"); // 'Quantity'
```

---

## BackboneElement 工具函数 (v0.6.1+)

```typescript
import { isBackboneElementType } from "fhir-engine";

// 判断元素是否定义了 BackboneElement 类型
isBackboneElementType(element); // true 如果 types 包含 BackboneElement 或 Element
```

---

## IG 数据提取 (v0.6.2+)

从 FHIR IG 资源中提取结构化数据：

```typescript
import {
  extractSDDependencies,
  extractElementIndexRows,
  flattenConceptHierarchy,
} from "fhir-engine";
import type { ElementIndexRow, ConceptRow } from "fhir-engine";

// 提取 StructureDefinition 的所有依赖
const deps = extractSDDependencies(structureDefinition);
// ['HumanName', 'Identifier', 'http://hl7.org/fhir/us/core/StructureDefinition/...']

// 从 StructureDefinition snapshot 提取元素索引行
const rows: ElementIndexRow[] = extractElementIndexRows(structureDefinition);

// 将 CodeSystem 概念层级结构扁平化为父子关系行
const concepts: ConceptRow[] = flattenConceptHierarchy(codeSystem);
```

---

## Conformance 存储模块 (v0.6.2+)

IG 持久化和索引：

```typescript
import {
  IGImportOrchestrator,
  IGResourceMapRepo,
  SDIndexRepo,
  ElementIndexRepo,
  ExpansionCacheRepo,
  ConceptHierarchyRepo,
} from "fhir-engine";

// 创建编排器执行完整 IG 导入
const orchestrator = new IGImportOrchestrator(adapter, dialect, {
  extractElementIndex: (sd) => extractElementIndexRows(sd),
  flattenConcepts: (cs) => flattenConceptHierarchy(cs),
});
await orchestrator.ensureAllTables();
const result = await orchestrator.importIG("hl7.fhir.us.core@6.1.0", igBundle);

// 或直接使用单独的 Repo
const sdIndex = new SDIndexRepo(adapter, dialect);
await sdIndex.ensureTable();
const entries = await sdIndex.getByType("Patient");
```

---

## 性能优化建议 (Performance Tips)

### 1. 连接池配置

```typescript
const config = defineConfig({
  database: {
    type: "postgres",
    poolSize: 20, // 根据并发需求调整
    // ...
  },
});
```

### 2. 批量操作

```typescript
// 使用事务进行批量操作
const adapter = engine.getPersistence().getAdapter();
await adapter.transaction(async (tx) => {
  for (const resource of resources) {
    await tx.create(resource);
  }
});
```

### 3. 搜索优化

```typescript
// 使用分页
const searchRequest = parseSearchRequest("Patient", {
  _count: 50,
  _offset: 0,
});
```

---

## 生产环境部署 (Production Deployment)

### 环境变量配置

```bash
# .env
NODE_ENV=production
DB_TYPE=postgres
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_NAME=fhir_prod
DB_USER=fhir_prod_user
DB_PASSWORD=secure_password
DB_SSL=true
DB_POOL_SIZE=50
```

### 配置加载

```typescript
import { loadFhirConfig } from "fhir-engine";

const config = await loadFhirConfig("./fhir-config.json");
const engine = await createFhirEngine(config);
```

### 健康检查

```typescript
const status = engine.getStatus();
console.log("Engine status:", status);
// { initialized: true, database: 'connected', ... }
```

---

## 错误处理 (Error Handling)

```typescript
try {
  await engine.create(patient);
} catch (error) {
  if (error.code === "VALIDATION_ERROR") {
    console.error("Validation failed:", error.issues);
  } else if (error.code === "DUPLICATE_RESOURCE") {
    console.error("Resource already exists");
  } else {
    console.error("Unexpected error:", error);
  }
}
```

---

## 示例项目 (Example Projects)

### Express.js 集成

```typescript
import express from "express";
import { createFhirEngine, defineConfig } from "fhir-engine";

const app = express();
app.use(express.json());

const engine = await createFhirEngine(
  defineConfig({
    database: { type: "sqlite", filename: "./fhir.db" },
  }),
);
await engine.initialize();

app.post("/fhir/:resourceType", async (req, res) => {
  try {
    const resource = await engine.create(req.body);
    res.status(201).json(resource);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000, () => console.log("FHIR server running on port 3000"));
```

---

## 下一步 (Next Steps)

1. 查看 [API-REFERENCE.md](./API-REFERENCE.md) 了解完整 API 文档
2. 查看 [ARCHITECTURE-OVERVIEW.md](./ARCHITECTURE-OVERVIEW.md) 了解架构设计
3. 遇到问题请查看 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
4. 阻塞问题请使用 [BLOCKING-ISSUES.md](./BLOCKING-ISSUES.md) 模版上报

---

## 技术支持 (Support)

- **GitHub Issues**: https://github.com/medxaidev/fhir-engine/issues
- **文档**: https://github.com/medxaidev/fhir-engine#readme
- **邮件**: fangjun20208@gmail.com
