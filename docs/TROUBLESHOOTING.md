# FHIR Engine 故障排查指南 (Troubleshooting Guide)

**文档版本**: v1.1.0  
**适用引擎版本**: fhir-engine >= 0.6.1  
**最后更新**: 2026-03-18

---

## 版本要求 (Version Requirements)

在排查问题前，请确认您的环境满足以下要求：

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **fhir-engine**: >= 0.6.1
- **fhir-runtime**: >= 0.10.0
- **fhir-persistence**: >= 0.6.1
- **fhir-definition**: >= 0.6.0

---

## 目录 (Table of Contents)

1. [安装问题](#安装问题)
2. [初始化问题](#初始化问题)
3. [数据库连接问题](#数据库连接问题)
4. [CRUD 操作问题](#crud-操作问题)
5. [搜索问题](#搜索问题)
6. [验证问题](#验证问题)
7. [性能问题](#性能问题)
8. [包加载问题](#包加载问题)
9. [插件问题](#插件问题)
10. [常见错误代码](#常见错误代码)

---

## 安装问题

### 问题 1: npm install 失败

**症状**:

```bash
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**原因**: 依赖版本冲突

**解决方案**:

1. 检查 Node.js 版本

```bash
node --version  # 应该 >= 18.0.0
npm --version   # 应该 >= 9.0.0
```

2. 清理缓存并重新安装

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

3. 使用 `--legacy-peer-deps` 标志

```bash
npm install --legacy-peer-deps
```

**适用版本**: >= 0.6.0

---

### 问题 2: TypeScript 类型错误

**症状**:

```
error TS2307: Cannot find module 'fhir-engine' or its corresponding type declarations.
```

**解决方案**:

1. 确认 TypeScript 版本

```bash
npx tsc --version  # 应该 >= 5.0.0
```

2. 检查 `tsconfig.json`

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

3. 重新安装类型定义

```bash
npm install --save-dev @types/node
```

**适用版本**: >= 0.6.0

---

## 初始化问题

### 问题 3: Engine 初始化超时

**症状**:

```typescript
const engine = await createFhirEngine(config);
await engine.initialize(); // 超时或挂起
```

**原因**:

- 数据库连接失败
- FHIR 包下载缓慢
- 网络问题

**解决方案**:

1. 增加超时时间

```typescript
const config = defineConfig({
  database: {
    /* ... */
  },
  packages: {
    sources: [
      /* ... */
    ],
    timeout: 60000, // 60 秒
  },
});
```

2. 使用本地 FHIR 包

```typescript
const config = defineConfig({
  packages: {
    sources: [
      {
        name: "hl7.fhir.r4.core",
        version: "4.0.1",
        url: "file:///path/to/local/package.tgz",
      },
    ],
  },
});
```

3. 检查数据库连接

```typescript
const adapter = createAdapter(config.database);
await adapter.connect(); // 测试连接
await adapter.disconnect();
```

**适用版本**: >= 0.6.0

---

### 问题 4: 包加载失败

**症状**:

```
Error: Failed to load package hl7.fhir.r4.core@4.0.1
```

**解决方案**:

1. 检查网络连接

```bash
curl -I https://packages.fhir.org/hl7.fhir.r4.core/4.0.1
```

2. 清理包缓存

```bash
rm -rf ./fhir-packages
```

3. 手动下载包

```bash
mkdir -p fhir-packages
cd fhir-packages
npm pack hl7.fhir.r4.core@4.0.1
```

4. 使用本地包路径

```typescript
const config = defineConfig({
  packages: {
    cacheDir: "./fhir-packages",
    sources: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
  },
});
```

**适用版本**: >= 0.6.0

---

## 数据库连接问题

### 问题 5: SQLite 文件权限错误

**症状**:

```
Error: SQLITE_CANTOPEN: unable to open database file
```

**解决方案**:

1. 检查文件路径和权限

```bash
ls -la ./fhir-data.db
chmod 644 ./fhir-data.db
```

2. 确保目录存在

```typescript
import { mkdir } from "fs/promises";

await mkdir("./data", { recursive: true });

const config = defineConfig({
  database: {
    type: "sqlite",
    filename: "./data/fhir.db",
  },
});
```

3. 使用绝对路径

```typescript
import { resolve } from "path";

const config = defineConfig({
  database: {
    type: "sqlite",
    filename: resolve(process.cwd(), "fhir.db"),
  },
});
```

**适用版本**: >= 0.6.0

---

### 问题 6: PostgreSQL 连接被拒绝

**症状**:

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方案**:

1. 检查 PostgreSQL 服务状态

```bash
# Linux/Mac
sudo systemctl status postgresql

# 或
pg_isready -h localhost -p 5432
```

2. 检查连接参数

```typescript
const config = defineConfig({
  database: {
    type: "postgres",
    host: "localhost", // 确认主机名
    port: 5432, // 确认端口
    database: "fhir_db",
    user: "fhir_user",
    password: "password",
  },
});
```

3. 测试连接

```bash
psql -h localhost -p 5432 -U fhir_user -d fhir_db
```

4. 检查 `pg_hba.conf` 配置

```
# 允许本地连接
host    all    all    127.0.0.1/32    md5
```

**适用版本**: >= 0.6.0

---

### 问题 7: PostgreSQL 认证失败

**症状**:

```
Error: password authentication failed for user "fhir_user"
```

**解决方案**:

1. 重置密码

```sql
ALTER USER fhir_user WITH PASSWORD 'new_password';
```

2. 使用环境变量

```bash
export DB_PASSWORD='your_password'
```

```typescript
const config = defineConfig({
  database: {
    type: "postgres",
    password: process.env.DB_PASSWORD,
  },
});
```

3. 检查用户权限

```sql
GRANT ALL PRIVILEGES ON DATABASE fhir_db TO fhir_user;
```

**适用版本**: >= 0.6.0

---

## CRUD 操作问题

### 问题 8: 创建资源失败 - 验证错误

**症状**:

```typescript
await engine.create(patient);
// Error: Validation failed: Patient.name is required
```

**解决方案**:

1. 检查资源结构

```typescript
const patient = {
  resourceType: "Patient",
  name: [{ family: "Smith", given: ["John"] }], // 必需
  gender: "male", // 如果是必需字段
};
```

2. 使用验证 API 预检查

```typescript
const validationResult = await engine.validate(patient);
if (!validationResult.valid) {
  console.error("Validation errors:", validationResult.issues);
}
```

3. 查看详细错误信息

```typescript
try {
  await engine.create(patient);
} catch (error) {
  console.error("Error code:", error.code);
  console.error("Issues:", error.issues);
}
```

**适用版本**: >= 0.6.0

---

### 问题 9: 资源不存在

**症状**:

```typescript
await engine.read("Patient", "invalid-id");
// Error: Resource not found: Patient/invalid-id
```

**解决方案**:

1. 使用 try-catch 处理

```typescript
try {
  const patient = await engine.read("Patient", patientId);
} catch (error) {
  if (error.code === "RESOURCE_NOT_FOUND") {
    console.log("Patient does not exist");
  }
}
```

2. 先搜索再读取

```typescript
import { parseSearchRequest, executeSearch } from "fhir-engine";

const searchRequest = parseSearchRequest("Patient", {
  identifier: "system|value",
});

const results = await executeSearch(engine.getPersistence(), searchRequest);

if (results.entry && results.entry.length > 0) {
  const patient = results.entry[0].resource;
}
```

**适用版本**: >= 0.6.0

---

### 问题 10: 更新冲突

**症状**:

```
Error: Version conflict: expected version 1, got version 2
```

**解决方案**:

1. 重新读取最新版本

```typescript
const patient = await engine.read("Patient", patientId);
patient.active = true;
await engine.update(patient);
```

2. 使用乐观锁

```typescript
try {
  await engine.update(patient);
} catch (error) {
  if (error.code === "VERSION_CONFLICT") {
    // 重新读取并重试
    const latest = await engine.read("Patient", patient.id);
    // 合并更改
    await engine.update(latest);
  }
}
```

**适用版本**: >= 0.6.0

---

## 搜索问题

### 问题 11: 搜索返回空结果

**症状**:

```typescript
const results = await executeSearch(persistence, searchRequest);
// results.entry is undefined or empty
```

**解决方案**:

1. 检查搜索参数

```typescript
const searchRequest = parseSearchRequest("Patient", {
  family: "Smith", // 确认参数名正确
  _count: 10,
});

console.log("Search request:", JSON.stringify(searchRequest, null, 2));
```

2. 验证数据存在

```typescript
// 直接查询数据库
const adapter = engine.getPersistence().getAdapter();
const resources = await adapter.query(
  "SELECT * FROM resources WHERE resource_type = ?",
  ["Patient"],
);
console.log("Total patients:", resources.length);
```

3. 检查索引

```typescript
// 重建索引
import { reindexResourceTypeV2 } from "fhir-engine";

await reindexResourceTypeV2(
  engine.getPersistence().getAdapter(),
  engine.getRuntime(),
  "Patient",
);
```

**适用版本**: >= 0.6.0

---

### 问题 12: 搜索性能慢

**症状**:
搜索请求耗时过长（> 5 秒）

**解决方案**:

1. 使用分页

```typescript
const searchRequest = parseSearchRequest("Patient", {
  _count: 50, // 限制结果数量
  _offset: 0,
});
```

2. 添加更具体的搜索条件

```typescript
// 不好：太宽泛
const request1 = parseSearchRequest("Patient", {});

// 好：具体条件
const request2 = parseSearchRequest("Patient", {
  family: "Smith",
  birthdate: "gt2000-01-01",
});
```

3. 检查数据库索引

```sql
-- PostgreSQL
EXPLAIN ANALYZE SELECT * FROM resources WHERE resource_type = 'Patient';

-- 创建索引
CREATE INDEX idx_resource_type ON resources(resource_type);
```

4. 使用连接池

```typescript
const config = defineConfig({
  database: {
    type: "postgres",
    poolSize: 20, // 增加连接池大小
  },
});
```

**适用版本**: >= 0.6.0

---

### 问题 13: 搜索参数不支持

**症状**:

```
Error: Search parameter 'custom-param' not found for Patient
```

**解决方案**:

1. 检查参数是否存在

```typescript
const definitions = engine.getDefinitions();
const searchParam = definitions.getSearchParameter("Patient", "custom-param");
```

2. 使用标准搜索参数

```typescript
// 查看所有支持的搜索参数
const patientDef = definitions.getResourceDefinition("Patient");
console.log("Search parameters:", patientDef.searchParameters);
```

3. 定义自定义搜索参数

```typescript
const customSearchParam = {
  resourceType: "SearchParameter",
  name: "custom-param",
  code: "custom-param",
  base: ["Patient"],
  type: "string",
  expression: 'Patient.extension.where(url="http://example.org/custom").value',
};

await engine.create(customSearchParam);
```

**适用版本**: >= 0.6.0

---

## 验证问题

### 问题 14: 验证规则过于严格

**症状**:
资源验证失败，但在其他 FHIR 服务器上可以通过

**解决方案**:

1. 检查 FHIR 版本

```typescript
// 确认使用正确的 FHIR 版本包
const config = defineConfig({
  packages: {
    sources: [
      { name: "hl7.fhir.r4.core", version: "4.0.1" }, // R4
    ],
  },
});
```

2. 使用宽松验证模式（通过插件）

```typescript
const lenientValidationPlugin: FhirEnginePlugin = {
  name: "lenient-validation",
  version: "1.0.0",

  async initialize(context) {
    const { runtime } = context;
    const originalValidate = runtime.validate.bind(runtime);

    runtime.validate = async (resource) => {
      const result = await originalValidate(resource);
      // 过滤掉警告级别的问题
      result.issues = result.issues.filter((i) => i.severity === "error");
      result.valid = result.issues.length === 0;
      return result;
    };
  },
};
```

3. 查看详细验证信息

```typescript
const result = await engine.validate(patient);
console.log("Validation issues:", JSON.stringify(result.issues, null, 2));
```

**适用版本**: >= 0.6.0

---

### 问题 15: 批量验证内存溢出

**症状**:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**解决方案**:

1. 增加 Node.js 内存限制

```bash
node --max-old-space-size=4096 your-app.js
```

2. 分批验证

```typescript
const batchSize = 100;
for (let i = 0; i < resources.length; i += batchSize) {
  const batch = resources.slice(i, i + batchSize);
  const results = await engine.validateBatch(batch);
  console.log(`Validated ${i + batch.length} / ${resources.length}`);
}
```

3. 使用流式处理

```typescript
import { Transform } from "stream";

const validationStream = new Transform({
  objectMode: true,
  async transform(resource, encoding, callback) {
    try {
      const result = await engine.validate(resource);
      callback(null, result);
    } catch (error) {
      callback(error);
    }
  },
});
```

**适用版本**: >= 0.9.0

---

## 性能问题

### 问题 16: 内存使用过高

**症状**:
应用内存使用持续增长

**解决方案**:

1. 检查连接泄漏

```typescript
// 确保正确关闭引擎
process.on("SIGINT", async () => {
  await engine.shutdown();
  process.exit(0);
});
```

2. 限制并发请求

```typescript
import pLimit from "p-limit";

const limit = pLimit(10); // 最多 10 个并发

const promises = resources.map((resource) =>
  limit(() => engine.create(resource)),
);

await Promise.all(promises);
```

3. 使用流式处理大数据集

```typescript
// 避免一次性加载所有数据
const searchRequest = parseSearchRequest("Patient", {
  _count: 100,
  _offset: 0,
});

let offset = 0;
while (true) {
  searchRequest.offset = offset;
  const results = await executeSearch(persistence, searchRequest);

  if (!results.entry || results.entry.length === 0) break;

  // 处理批次
  for (const entry of results.entry) {
    await processResource(entry.resource);
  }

  offset += 100;
}
```

**适用版本**: >= 0.6.0

---

### 问题 17: CPU 使用率高

**症状**:
CPU 使用率持续 100%

**解决方案**:

1. 分析性能瓶颈

```typescript
console.time("create");
await engine.create(patient);
console.timeEnd("create");
```

2. 优化验证

```typescript
// 跳过验证（仅在确定数据有效时）
const config = defineConfig({
  skipValidation: true, // 需要通过插件实现
});
```

3. 使用数据库批量操作

```typescript
const adapter = engine.getPersistence().getAdapter();

await adapter.transaction(async (tx) => {
  // 批量插入
  const sql =
    "INSERT INTO resources (id, resource_type, content) VALUES (?, ?, ?)";
  for (const resource of resources) {
    await tx.execute(sql, [
      resource.id,
      resource.resourceType,
      JSON.stringify(resource),
    ]);
  }
});
```

4. 启用查询缓存（通过插件）

**适用版本**: >= 0.6.0

---

## 包加载问题

### 问题 18: 包版本冲突

**症状**:

```
Error: Package hl7.fhir.r4.core@4.0.1 conflicts with hl7.fhir.r4.core@4.0.0
```

**解决方案**:

1. 使用一致的版本

```typescript
const config = defineConfig({
  packages: {
    sources: [
      { name: "hl7.fhir.r4.core", version: "4.0.1" },
      { name: "hl7.fhir.us.core", version: "5.0.1" }, // 确保兼容
    ],
  },
});
```

2. 清理包缓存

```bash
rm -rf ./fhir-packages
```

3. 检查依赖树

```bash
npm ls fhir-definition
```

**适用版本**: >= 0.6.0

---

## 插件问题

### 问题 19: 插件初始化失败

**症状**:

```
Error: Plugin 'my-plugin' failed to initialize
```

**解决方案**:

1. 检查插件代码

```typescript
const myPlugin: FhirEnginePlugin = {
  name: "my-plugin",
  version: "1.0.0",

  async initialize(context) {
    try {
      // 初始化逻辑
      console.log("Plugin initialized");
    } catch (error) {
      console.error("Plugin init error:", error);
      throw error;
    }
  },
};
```

2. 添加错误处理

```typescript
try {
  const engine = await createFhirEngine(config);
  await engine.initialize();
} catch (error) {
  console.error("Engine initialization failed:", error);
  // 检查是哪个插件失败
}
```

3. 逐个测试插件

```typescript
// 先不加载插件
const config1 = defineConfig({
  database: {
    /* ... */
  },
  plugins: [],
});

// 逐个添加
const config2 = defineConfig({
  database: {
    /* ... */
  },
  plugins: [plugin1], // 测试单个插件
});
```

**适用版本**: >= 0.6.0

---

## 常见错误代码

### VALIDATION_ERROR

**原因**: 资源验证失败

**解决**: 检查资源结构，使用 `validate()` API 查看详细错误

**版本**: >= 0.6.0

---

### RESOURCE_NOT_FOUND

**原因**: 请求的资源不存在

**解决**: 确认资源 ID 正确，使用搜索 API 查找资源

**版本**: >= 0.6.0

---

### DUPLICATE_RESOURCE

**原因**: 资源 ID 已存在

**解决**: 使用不同的 ID 或使用 `update()` 更新现有资源

**版本**: >= 0.6.0

---

### DATABASE_ERROR

**原因**: 数据库操作失败

**解决**: 检查数据库连接、权限、磁盘空间

**版本**: >= 0.6.0

---

### CONFIGURATION_ERROR

**原因**: 配置无效

**解决**: 检查配置对象，确保所有必需字段存在

**版本**: >= 0.6.0

---

### PACKAGE_LOAD_ERROR

**原因**: FHIR 包加载失败

**解决**: 检查网络连接、包名称和版本、使用本地包

**版本**: >= 0.6.0

---

## 调试技巧

### 启用调试日志

```typescript
import { createConsoleLogger } from "fhir-engine";

const config = defineConfig({
  database: {
    /* ... */
  },
  logger: createConsoleLogger("debug"),
});
```

### 使用 Node.js 调试器

```bash
node --inspect-brk your-app.js
```

### 查看 SQL 查询

```typescript
const adapter = engine.getPersistence().getAdapter();

// 添加 SQL 日志（通过插件）
const sqlLogPlugin: FhirEnginePlugin = {
  name: "sql-logger",
  version: "1.0.0",

  async initialize(context) {
    const { persistence } = context;
    const adapter = persistence.getAdapter();
    const originalQuery = adapter.query.bind(adapter);

    adapter.query = async (sql, params) => {
      console.log("SQL:", sql);
      console.log("Params:", params);
      return originalQuery(sql, params);
    };
  },
};
```

---

## 获取帮助

如果以上方法无法解决您的问题：

1. 查看 [API 文档](./API-REFERENCE.md)
2. 查看 [架构文档](./ARCHITECTURE-OVERVIEW.md)
3. 搜索 [GitHub Issues](https://github.com/medxaidev/fhir-engine/issues)
4. 提交新的 [问题报告](./BLOCKING-ISSUES.md)

---

## 相关文档

- [接入指南](./INTEGRATION-GUIDE.md)
- [API 参考](./API-REFERENCE.md)
- [架构概览](./ARCHITECTURE-OVERVIEW.md)
- [问题上报](./BLOCKING-ISSUES.md)
