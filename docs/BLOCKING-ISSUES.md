# 阻塞问题上报模版 (Blocking Issues Template)

**文档版本**: v1.2.0  
**适用引擎版本**: fhir-engine >= 0.6.2  
**最后更新**: 2026-03-18

---

## 使用说明 (Instructions)

当您遇到阻塞性问题（无法通过文档解决的问题）时，请使用此模版在 GitHub Issues 中提交问题报告。

**提交地址**: https://github.com/medxaidev/fhir-engine/issues

---

## 问题报告模版 (Issue Template)

### 标题格式 (Title Format)

```
[BUG/FEATURE/QUESTION] 简短描述问题
```

示例：

- `[BUG] PostgreSQL 连接池耗尽导致应用挂起`
- `[FEATURE] 支持自定义搜索参数持久化`
- `[QUESTION] 如何在生产环境中进行零停机升级`

---

### 问题描述模版 (Issue Description Template)

````markdown
## 环境信息 (Environment Information)

**必填项**:

- **fhir-engine 版本**: [例如: 0.6.0]
- **fhir-runtime 版本**: [例如: 0.9.0]
- **fhir-persistence 版本**: [例如: 0.6.0]
- **fhir-definition 版本**: [例如: 0.6.0]
- **Node.js 版本**: [例如: 18.20.0]
- **npm 版本**: [例如: 9.8.1]
- **TypeScript 版本**: [例如: 5.9.3]
- **操作系统**: [例如: Ubuntu 22.04 / macOS 14.0 / Windows 11]
- **数据库类型和版本**: [例如: PostgreSQL 15.3 / SQLite 3.42.0]

**可选项**:

- **包管理器**: [例如: npm / yarn / pnpm]
- **部署环境**: [例如: Docker / Kubernetes / 裸机]
- **其他相关依赖**: [列出可能相关的其他包]

---

## 问题类型 (Issue Type)

请选择一项：

- [ ] Bug（程序错误）
- [ ] Feature Request（功能请求）
- [ ] Performance Issue（性能问题）
- [ ] Documentation Issue（文档问题）
- [ ] Question（使用问题）
- [ ] Security Issue（安全问题）

---

## 问题描述 (Problem Description)

### 简要描述 (Brief Description)

[用 1-2 句话描述问题]

### 详细描述 (Detailed Description)

[详细描述问题的表现、影响范围、发生频率等]

### 预期行为 (Expected Behavior)

[描述您期望的正确行为]

### 实际行为 (Actual Behavior)

[描述实际发生的行为]

---

## 重现步骤 (Steps to Reproduce)

请提供详细的重现步骤：

1. [第一步]
2. [第二步]
3. [第三步]
4. ...

### 最小可重现示例 (Minimal Reproducible Example)

```typescript
// 请提供最小化的代码示例
import { createFhirEngine, defineConfig } from "fhir-engine";

const config = defineConfig({
  database: {
    type: "sqlite",
    filename: "./test.db",
  },
});

const engine = await createFhirEngine(config);
await engine.initialize();

// 触发问题的代码
// ...
```
````

---

## 错误信息 (Error Messages)

### 错误堆栈 (Error Stack Trace)

```
[粘贴完整的错误堆栈信息]
```

### 日志输出 (Log Output)

```
[粘贴相关的日志输出，建议使用 debug 级别]
```

### 截图 (Screenshots)

[如果适用，请添加截图]

---

## 配置信息 (Configuration)

### Engine 配置 (Engine Configuration)

```typescript
// 请提供您的配置（移除敏感信息如密码）
const config = defineConfig({
  database: {
    type: "postgres",
    host: "localhost",
    port: 5432,
    database: "fhir_db",
    user: "fhir_user",
    password: "***", // 已隐藏
  },
  packages: {
    sources: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
  },
});
```

### package.json 依赖 (Dependencies)

```json
{
  "dependencies": {
    "fhir-engine": "^0.6.0"
    // 其他相关依赖
  }
}
```

---

## 已尝试的解决方案 (Attempted Solutions)

请列出您已经尝试过的解决方案：

1. [尝试方案 1] - [结果]
2. [尝试方案 2] - [结果]
3. ...

---

## 影响评估 (Impact Assessment)

### 严重程度 (Severity)

请选择一项：

- [ ] Critical（关键）- 生产环境完全无法使用
- [ ] High（高）- 核心功能受阻，有临时解决方案
- [ ] Medium（中）- 部分功能受影响
- [ ] Low（低）- 轻微影响或功能增强

### 影响范围 (Impact Scope)

- **受影响的功能**: [例如: CRUD 操作 / 搜索 / 验证]
- **受影响的用户数**: [例如: 所有用户 / 特定场景用户]
- **业务影响**: [描述对业务的影响]

### 紧急程度 (Urgency)

- [ ] Immediate（立即）- 需要在 24 小时内解决
- [ ] High（高）- 需要在 1 周内解决
- [ ] Medium（中）- 需要在 1 个月内解决
- [ ] Low（低）- 可以延后处理

---

## 可能的原因分析 (Possible Root Cause)

[如果您有任何关于问题原因的猜测，请在此描述]

---

## 建议的解决方案 (Suggested Solution)

[如果您有解决方案的想法，请在此描述]

---

## 附加信息 (Additional Information)

### 相关 Issues

[列出相关的 GitHub Issues 链接]

### 相关文档

[列出您已查阅的文档]

### 其他备注

[任何其他可能有用的信息]

---

## 联系方式 (Contact Information)

**可选项**（如果需要进一步沟通）:

- **邮箱**: [your-email@example.com]
- **GitHub**: [@your-username]
- **时区**: [例如: UTC+8]

---

## Checklist

提交前请确认：

- [ ] 我已阅读 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) 并尝试了相关解决方案
- [ ] 我已搜索现有 Issues，确认这不是重复问题
- [ ] 我已提供完整的环境信息
- [ ] 我已提供可重现的示例代码
- [ ] 我已移除配置中的敏感信息（密码、密钥等）
- [ ] 我已评估问题的严重程度和影响范围
- [ ] 标题清晰描述了问题

---

## 版本兼容性说明 (Version Compatibility Notes)

如果您使用的是旧版本，请考虑升级到最新版本：

| 组件             | 当前最新版本 | 最低支持版本 |
| ---------------- | ------------ | ------------ |
| fhir-engine      | 0.6.2        | 0.6.2        |
| fhir-runtime     | 0.11.0       | 0.11.0       |
| fhir-persistence | 0.7.0        | 0.7.0        |
| fhir-definition  | 0.6.0        | 0.6.0        |
| Node.js          | 20.x         | 18.0.0       |

---

## 安全问题特别说明 (Security Issues)

**如果您发现安全漏洞，请不要在公开 Issue 中提交！**

请通过以下方式私密报告：

- **邮箱**: fangjun20208@gmail.com
- **主题**: [SECURITY] 简短描述

我们会在 48 小时内响应安全问题报告。

---

## 响应时间预期 (Response Time Expectations)

| 严重程度 | 首次响应时间 | 解决目标时间 |
| -------- | ------------ | ------------ |
| Critical | 24 小时内    | 3-5 个工作日 |
| High     | 2-3 个工作日 | 1-2 周       |
| Medium   | 1 周内       | 1 个月       |
| Low      | 2 周内       | 根据优先级   |

---

## 贡献代码 (Contributing)

如果您愿意提交 Pull Request 来修复此问题：

1. Fork 仓库
2. 创建特性分支 (`git checkout -b fix/issue-description`)
3. 提交更改 (`git commit -am 'Fix: description'`)
4. 推送到分支 (`git push origin fix/issue-description`)
5. 创建 Pull Request

请确保：

- [ ] 代码通过所有测试 (`npm test`)
- [ ] 添加了相关测试用例
- [ ] 更新了相关文档
- [ ] 遵循项目代码风格

---

## 相关资源 (Related Resources)

- [接入指南](./INTEGRATION-GUIDE.md)
- [API 参考](./API-REFERENCE.md)
- [架构概览](./ARCHITECTURE-OVERVIEW.md)
- [故障排查](./TROUBLESHOOTING.md)
- [GitHub Issues](https://github.com/medxaidev/fhir-engine/issues)
- [GitHub Discussions](https://github.com/medxaidev/fhir-engine/discussions)

---

**感谢您的反馈！您的问题报告将帮助我们改进 FHIR Engine。**

````

---

## 示例问题报告 (Example Issue Report)

### 示例 1: Bug 报告

```markdown
## 环境信息

- **fhir-engine 版本**: 0.6.0
- **fhir-runtime 版本**: 0.9.0
- **fhir-persistence 版本**: 0.6.0
- **fhir-definition 版本**: 0.6.0
- **Node.js 版本**: 18.20.0
- **npm 版本**: 9.8.1
- **TypeScript 版本**: 5.9.3
- **操作系统**: Ubuntu 22.04
- **数据库类型和版本**: PostgreSQL 15.3

## 问题类型

- [x] Bug（程序错误）

## 问题描述

### 简要描述
在高并发场景下，PostgreSQL 连接池耗尽导致应用挂起。

### 详细描述
当同时处理超过 50 个请求时，应用会挂起并停止响应。查看日志发现 "Connection pool exhausted" 错误。

### 预期行为
应用应该能够处理至少 100 个并发请求，超出连接池限制时应该排队等待而不是挂起。

### 实际行为
超过 50 个并发请求后，应用完全挂起，需要重启才能恢复。

## 重现步骤

1. 配置 PostgreSQL 连接池大小为 10
2. 使用 Apache Bench 发送 100 个并发请求
3. 观察应用行为

### 最小可重现示例

```typescript
import { createFhirEngine, defineConfig } from 'fhir-engine';

const config = defineConfig({
  database: {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'fhir_db',
    user: 'fhir_user',
    password: '***',
    poolSize: 10
  }
});

const engine = await createFhirEngine(config);
await engine.initialize();

// 模拟并发请求
const promises = Array.from({ length: 100 }, (_, i) =>
  engine.create({
    resourceType: 'Patient',
    name: [{ family: `Patient${i}` }]
  })
);

await Promise.all(promises); // 挂起
````

## 错误信息

### 错误堆栈

```
Error: Connection pool exhausted
    at Pool.connect (/node_modules/pg/lib/pool.js:45:15)
    at PostgresAdapter.query (/node_modules/fhir-persistence/dist/adapters/postgres.js:123:20)
```

## 影响评估

### 严重程度

- [x] High（高）- 核心功能受阻，有临时解决方案

### 影响范围

- **受影响的功能**: 所有 CRUD 操作
- **受影响的用户数**: 生产环境所有用户
- **业务影响**: 高峰期服务不可用

### 紧急程度

- [x] High（高）- 需要在 1 周内解决

## 已尝试的解决方案

1. 增加 poolSize 到 50 - 延缓但未解决问题
2. 添加请求限流 - 临时缓解，但影响性能

## 可能的原因分析

可能是连接未正确释放，或者事务超时设置不当。

## 建议的解决方案

1. 添加连接超时和自动回收机制
2. 实现请求队列管理
3. 改进错误处理，避免连接泄漏

## Checklist

- [x] 我已阅读 TROUBLESHOOTING.md 并尝试了相关解决方案
- [x] 我已搜索现有 Issues，确认这不是重复问题
- [x] 我已提供完整的环境信息
- [x] 我已提供可重现的示例代码
- [x] 我已移除配置中的敏感信息
- [x] 我已评估问题的严重程度和影响范围
- [x] 标题清晰描述了问题

````

---

### 示例 2: Feature Request

```markdown
## 环境信息

- **fhir-engine 版本**: 0.6.0
- **Node.js 版本**: 18.20.0
- **操作系统**: macOS 14.0

## 问题类型

- [x] Feature Request（功能请求）

## 问题描述

### 简要描述
希望支持自定义搜索参数的持久化和管理。

### 详细描述
当前自定义搜索参数需要在每次启动时重新创建，希望能够将自定义搜索参数持久化到数据库，并在引擎启动时自动加载。

### 预期行为
1. 创建的 SearchParameter 资源自动持久化
2. 引擎启动时自动加载自定义搜索参数
3. 支持搜索参数的版本管理

## 使用场景 (Use Case)

我们的应用需要定义多个自定义搜索参数来支持特定的业务查询需求。当前每次部署都需要手动重新创建这些参数，非常不便。

## 建议的实现方案

1. 在数据库中添加 `search_parameters` 表
2. 在引擎初始化时扫描并加载自定义参数
3. 提供 API 来管理搜索参数

## 影响评估

### 严重程度
- [x] Medium（中）- 部分功能受影响

### 紧急程度
- [x] Medium（中）- 需要在 1 个月内解决

## Checklist

- [x] 我已阅读 TROUBLESHOOTING.md 并尝试了相关解决方案
- [x] 我已搜索现有 Issues，确认这不是重复问题
- [x] 我已提供完整的环境信息
- [x] 标题清晰描述了问题
````

---

## 问题跟踪 (Issue Tracking)

提交问题后，您可以：

1. **订阅通知**: 在 GitHub Issue 页面点击 "Subscribe" 接收更新
2. **查看进度**: 通过 Issue 标签了解处理状态
3. **参与讨论**: 在 Issue 评论中提供更多信息或反馈
4. **测试修复**: 当有 PR 提交时，帮助测试修复方案

### Issue 标签说明

- `bug`: 程序错误
- `enhancement`: 功能增强
- `documentation`: 文档相关
- `performance`: 性能问题
- `security`: 安全问题
- `help wanted`: 欢迎贡献
- `good first issue`: 适合新手
- `priority: critical`: 关键优先级
- `priority: high`: 高优先级
- `priority: medium`: 中优先级
- `priority: low`: 低优先级

---

## 相关文档

- [接入指南](./INTEGRATION-GUIDE.md)
- [API 参考](./API-REFERENCE.md)
- [架构概览](./ARCHITECTURE-OVERVIEW.md)
- [故障排查](./TROUBLESHOOTING.md)
- [文档索引](./README.md)
