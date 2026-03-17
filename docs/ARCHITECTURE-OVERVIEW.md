# FHIR Engine 架构概览 (Architecture Overview)

**文档版本**: v1.1.0  
**适用引擎版本**: fhir-engine >= 0.6.1  
**最后更新**: 2026-03-18

---

## 版本说明 (Version Information)

### 核心组件版本

- **fhir-engine**: 0.6.1
- **fhir-definition**: 0.6.0
- **fhir-persistence**: 0.6.1
- **fhir-runtime**: 0.10.0

### 技术栈要求

- **Node.js**: >= 18.0.0
- **TypeScript**: >= 5.0.0
- **数据库**: SQLite 3.x / PostgreSQL >= 12.0

---

## 系统架构 (System Architecture)

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│                    (Your Application)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     FHIR Engine API                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  createFhirEngine, CRUD, Search, Validate, FHIRPath  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌────────────────┐ ┌────────────┐ ┌──────────────┐
│ fhir-runtime   │ │fhir-persist│ │fhir-definition│
│                │ │            │ │              │
│ • Validation   │ │ • CRUD     │ │ • Schema     │
│ • FHIRPath     │ │ • Search   │ │ • Types      │
│ • Evaluation   │ │ • Index    │ │ • Profiles   │
└────────┬───────┘ └─────┬──────┘ └──────┬───────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │ Storage Adapter  │
              └────────┬─────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│     SQLite      │         │   PostgreSQL    │
│  (better-sqlite3│         │      (pg)       │
│   or WASM)      │         │                 │
└─────────────────┘         └─────────────────┘
```

---

## 核心组件 (Core Components)

### 1. FHIR Engine (fhir-engine)

**职责**:

- 统一的 API 入口
- 组件生命周期管理
- 配置管理
- 插件系统

**主要接口**:

```typescript
interface FhirEngine {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  create<T>(resource: T): Promise<T>;
  read<T>(type: string, id: string): Promise<T>;
  update<T>(resource: T): Promise<T>;
  delete(type: string, id: string): Promise<void>;
  validate<T>(resource: T): Promise<ValidationResult>;
  getPersistence(): FhirPersistence;
  getRuntime(): FhirRuntimeInstance;
  getDefinitions(): DefinitionRegistry;
  getStatus(): FhirEngineStatus;
}
```

**版本**: >= 0.6.0

---

### 2. FHIR Runtime (fhir-runtime)

**职责**:

- 资源验证
- FHIRPath 表达式求值
- 类型转换和序列化
- 批量验证 (>= 0.9.0)

**核心功能**:

```typescript
// 验证
validate(resource: Resource): ValidationResult

// FHIRPath 求值
evalFhirPath(resource: Resource, expression: string): any[]
evalFhirPathBoolean(resource: Resource, expression: string): boolean
evalFhirPathString(resource: Resource, expression: string): string

// 批量验证 (v0.9.0+)
validateBatch(resources: Resource[], options?: BatchValidationOptions): BatchValidationResult

// Profile Slicing (v0.10.0+)
matchSlice(instance, slicedElement): string | null
countSliceInstances(items, slicedElement): Map<string, number>
generateSliceSkeleton(slice): Record<string, unknown>

// Choice Type 辅助 (v0.10.0+)
isChoiceType(element): boolean
getChoiceBaseName(path): string
buildChoiceJsonKey(baseName, typeCode): string
resolveActiveChoiceType(element, resource): ActiveChoiceInfo

// BackboneElement 辅助 (v0.10.0+)
isBackboneElement(element): boolean
isArrayElement(element): boolean
getBackboneChildren(parentPath, profile): CanonicalElement[]
```

**版本**: >= 0.10.0 (Profile Slicing、Choice Type、BackboneElement 工具)

---

### 3. FHIR Persistence (fhir-persistence)

**职责**:

- CRUD 操作实现
- 搜索参数解析
- 搜索执行
- 索引管理
- 重建索引 V2 (>= 0.6.0)

**核心功能**:

```typescript
// CRUD
create(resource: Resource): Promise<Resource>
read(type: string, id: string): Promise<Resource>
update(resource: Resource): Promise<Resource>
delete(type: string, id: string): Promise<void>

// 搜索
parseSearchRequest(type: string, params: any): SearchRequest
executeSearch(request: SearchRequest): Promise<SearchResult>

// 索引重建 (v0.6.0+)
reindexResourceTypeV2(adapter, runtime, type): Promise<void>
reindexAllV2(adapter, runtime): Promise<void>
```

**版本**: >= 0.6.0

---

### 4. FHIR Definition (fhir-definition)

**职责**:

- FHIR 规范定义加载
- 资源类型定义
- 搜索参数定义
- 数据类型定义
- Profile 管理

**核心接口**:

```typescript
interface DefinitionRegistry {
  getResourceDefinition(type: string): ResourceDefinition;
  getSearchParameter(type: string, name: string): SearchParameterDefinition;
  getDataType(name: string): DataTypeDefinition;
  listResourceTypes(): string[];
}
```

**版本**: >= 0.6.0

---

### 5. Storage Adapter

**职责**:

- 数据库抽象层
- SQL 生成和执行
- 事务管理
- 连接池管理

**支持的数据库**:

- **SQLite**: 通过 `better-sqlite3` (同步) 或 `@sqlite.org/sqlite-wasm` (WASM)
- **PostgreSQL**: 通过 `pg` (异步)

**核心接口**:

```typescript
interface StorageAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  execute(sql: string, params: any[]): Promise<any>;
  query(sql: string, params: any[]): Promise<any[]>;
}
```

**版本**: >= 0.6.0

---

## 数据流 (Data Flow)

### 创建资源流程

```
Application
    │
    ├─> engine.create(resource)
    │
    ▼
FhirEngine
    │
    ├─> runtime.validate(resource)  ← 验证资源
    │
    ├─> persistence.create(resource)
    │
    ▼
FhirPersistence
    │
    ├─> adapter.transaction(async tx => {
    │       ├─> tx.insert(resource_table, data)
    │       ├─> tx.insert(search_index_table, indices)
    │       └─> return resource
    │   })
    │
    ▼
StorageAdapter
    │
    ├─> BEGIN TRANSACTION
    ├─> INSERT INTO resources ...
    ├─> INSERT INTO search_indices ...
    ├─> COMMIT
    │
    ▼
Database (SQLite/PostgreSQL)
```

---

### 搜索资源流程

```
Application
    │
    ├─> parseSearchRequest('Patient', { family: 'Smith' })
    │
    ▼
FhirPersistence
    │
    ├─> 解析搜索参数
    ├─> 查询 search_parameter 定义
    ├─> 构建 SQL 查询
    │
    ▼
StorageAdapter
    │
    ├─> SELECT r.* FROM resources r
    │   JOIN search_indices si ON r.id = si.resource_id
    │   WHERE si.param_name = 'family'
    │   AND si.value_string = 'Smith'
    │
    ▼
Database
    │
    ├─> 返回匹配的资源
    │
    ▼
FhirPersistence
    │
    ├─> 构建 Bundle (searchset)
    ├─> 添加分页链接
    │
    ▼
Application
```

---

## 数据库模式 (Database Schema)

### 核心表结构

#### resources 表

```sql
CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  version_id TEXT NOT NULL,
  last_updated TIMESTAMP NOT NULL,
  content TEXT NOT NULL,  -- JSON
  deleted BOOLEAN DEFAULT FALSE,
  INDEX idx_resource_type (resource_type),
  INDEX idx_last_updated (last_updated)
);
```

#### search_indices 表

```sql
CREATE TABLE search_indices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  param_name TEXT NOT NULL,
  param_type TEXT NOT NULL,  -- string, token, reference, etc.
  value_string TEXT,
  value_number REAL,
  value_date TIMESTAMP,
  value_reference TEXT,
  INDEX idx_search_param (resource_type, param_name, value_string),
  INDEX idx_search_number (resource_type, param_name, value_number),
  INDEX idx_search_date (resource_type, param_name, value_date),
  FOREIGN KEY (resource_id) REFERENCES resources(id)
);
```

#### resource_history 表 (可选)

```sql
CREATE TABLE resource_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  last_updated TIMESTAMP NOT NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (resource_id) REFERENCES resources(id)
);
```

**版本**: >= 0.6.0

---

## 插件系统 (Plugin System)

### 插件架构

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

### 插件生命周期

```
1. Engine 创建
   ↓
2. 加载配置
   ↓
3. 初始化数据库
   ↓
4. 加载 FHIR 包
   ↓
5. 初始化插件 (plugin.initialize)
   ↓
6. Engine 就绪
   ↓
   ... 运行时 ...
   ↓
7. 关闭插件 (plugin.shutdown)
   ↓
8. 关闭数据库
   ↓
9. Engine 关闭
```

### 插件示例

```typescript
const auditPlugin: FhirEnginePlugin = {
  name: "audit-logger",
  version: "1.0.0",

  async initialize(context) {
    const { persistence, logger } = context;

    // 拦截 CRUD 操作
    const originalCreate = persistence.create.bind(persistence);
    persistence.create = async (resource) => {
      logger.info("Creating resource", { type: resource.resourceType });
      const result = await originalCreate(resource);
      logger.info("Created resource", { id: result.id });
      return result;
    };
  },
};
```

**版本**: >= 0.6.0

---

## 配置系统 (Configuration System)

### 配置层级

```
1. 默认配置 (Default Config)
   ↓
2. 配置文件 (fhir-config.json)
   ↓
3. 环境变量 (Environment Variables)
   ↓
4. 代码配置 (Programmatic Config)
```

### 配置示例

```typescript
// fhir-config.json
{
  "database": {
    "type": "postgres",
    "host": "${DB_HOST}",
    "port": "${DB_PORT}",
    "database": "${DB_NAME}",
    "user": "${DB_USER}",
    "password": "${DB_PASSWORD}"
  },
  "packages": {
    "sources": [
      { "name": "hl7.fhir.r4.core", "version": "4.0.1" }
    ],
    "cacheDir": "./fhir-packages"
  }
}
```

**版本**: >= 0.6.0

---

## 性能优化 (Performance Optimization)

### 1. 索引策略

- **自动索引**: 所有搜索参数自动创建索引
- **复合索引**: 支持多参数组合查询
- **部分索引**: 针对常用查询优化

### 2. 连接池

```typescript
// PostgreSQL 连接池配置
{
  database: {
    type: 'postgres',
    poolSize: 20,  // 根据并发调整
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  }
}
```

### 3. 批量操作

```typescript
// 使用事务批量插入
await adapter.transaction(async (tx) => {
  for (const resource of resources) {
    await tx.create(resource);
  }
});
```

### 4. 缓存策略

- **定义缓存**: FHIR 定义在内存中缓存
- **查询缓存**: 常用搜索结果缓存 (可通过插件实现)

**版本**: >= 0.6.0

---

## 扩展性 (Extensibility)

### 1. 自定义搜索参数

```typescript
// 通过 FHIR SearchParameter 资源定义
const customSearchParam = {
  resourceType: "SearchParameter",
  name: "custom-identifier",
  code: "custom-identifier",
  base: ["Patient"],
  type: "token",
  expression: 'Patient.identifier.where(system="http://custom.org")',
};

await engine.create(customSearchParam);
```

### 2. 自定义验证规则

```typescript
// 通过插件实现
const validationPlugin: FhirEnginePlugin = {
  name: "custom-validation",
  version: "1.0.0",

  async initialize(context) {
    const { runtime } = context;

    // 添加自定义验证逻辑
    const originalValidate = runtime.validate.bind(runtime);
    runtime.validate = async (resource) => {
      const result = await originalValidate(resource);

      // 添加自定义规则
      if (resource.resourceType === "Patient" && !resource.name) {
        result.issues.push({
          severity: "error",
          code: "required",
          diagnostics: "Patient must have a name",
        });
      }

      return result;
    };
  },
};
```

### 3. 自定义存储后端

```typescript
// 实现 StorageAdapter 接口
class CustomStorageAdapter implements StorageAdapter {
  async connect() {
    /* ... */
  }
  async disconnect() {
    /* ... */
  }
  async transaction<T>(fn) {
    /* ... */
  }
  async execute(sql, params) {
    /* ... */
  }
  async query(sql, params) {
    /* ... */
  }
}
```

**版本**: >= 0.6.0

---

## 安全性 (Security)

### 1. SQL 注入防护

- 所有查询使用参数化 SQL
- 输入验证和清理

### 2. 访问控制

- 通过插件实现 RBAC
- 支持 SMART on FHIR

### 3. 数据加密

- 支持数据库连接 SSL/TLS
- 敏感字段加密 (通过插件)

### 4. 审计日志

- 所有操作可记录
- 支持审计插件

**版本**: >= 0.6.0

---

## 部署架构 (Deployment Architecture)

### 单机部署

```
┌─────────────────────────┐
│   Application Server    │
│  ┌──────────────────┐  │
│  │   FHIR Engine    │  │
│  └────────┬─────────┘  │
│           │             │
│  ┌────────▼─────────┐  │
│  │  SQLite Database │  │
│  └──────────────────┘  │
└─────────────────────────┘
```

### 分布式部署

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ App Server 1 │  │ App Server 2 │  │ App Server N │
│ FHIR Engine  │  │ FHIR Engine  │  │ FHIR Engine  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │   PostgreSQL     │
              │   (Primary)      │
              └────────┬─────────┘
                       │
              ┌────────┴─────────┐
              │                  │
              ▼                  ▼
       ┌──────────┐       ┌──────────┐
       │ Replica 1│       │ Replica 2│
       └──────────┘       └──────────┘
```

**版本**: >= 0.6.0

---

## 监控和诊断 (Monitoring & Diagnostics)

### 健康检查

```typescript
const status = engine.getStatus();
// {
//   initialized: true,
//   database: 'connected',
//   packagesLoaded: true,
//   pluginsLoaded: 3
// }
```

### 性能指标

- 请求延迟
- 数据库连接池状态
- 缓存命中率
- 资源计数

### 日志级别

```typescript
const logger = createConsoleLogger("debug");
// 级别: debug < info < warn < error
```

**版本**: >= 0.6.0

---

## 版本兼容性矩阵 (Version Compatibility Matrix)

| fhir-engine | fhir-runtime | fhir-persistence | fhir-definition | Node.js |
| ----------- | ------------ | ---------------- | --------------- | ------- |
| 0.6.1       | 0.10.0       | 0.6.1            | 0.6.0           | >= 18.0 |
| 0.6.0       | 0.9.0        | 0.6.0            | 0.6.0           | >= 18.0 |
| 0.5.x       | 0.8.x        | 0.5.x            | 0.5.x           | >= 16.0 |

---

## 相关文档

- [接入指南](./INTEGRATION-GUIDE.md)
- [API 参考](./API-REFERENCE.md)
- [故障排查](./TROUBLESHOOTING.md)
- [问题上报](./BLOCKING-ISSUES.md)
