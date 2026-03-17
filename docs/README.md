# FHIR Engine 文档中心 (Documentation Hub)

**文档版本**: v1.1.0  
**适用引擎版本**: fhir-engine >= 0.6.1  
**最后更新**: 2026-03-18

---

## 欢迎 (Welcome)

欢迎使用 FHIR Engine 文档中心！本文档集合旨在帮助开发者快速接入和使用 FHIR Engine，构建符合 HL7 FHIR 标准的医疗健康应用。

---

## 版本信息 (Version Information)

### 当前版本

- **fhir-engine**: 0.6.1
- **fhir-runtime**: 0.10.0
- **fhir-persistence**: 0.6.1
- **fhir-definition**: 0.6.0

### 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **TypeScript**: >= 5.0.0 (推荐 5.9.3)

### 数据库支持

- **SQLite**: 3.x (better-sqlite3 或 WASM)
- **PostgreSQL**: >= 12.0

---

## 文档导航 (Documentation Navigation)

### 📚 核心文档 (Core Documentation)

#### 1. [接入指南 (INTEGRATION-GUIDE.md)](./INTEGRATION-GUIDE.md)

**适合**: 新用户、首次接入

**内容包括**:

- ✅ 快速开始指南
- ✅ 安装和配置
- ✅ 基本操作示例
- ✅ 高级配置选项
- ✅ 数据迁移
- ✅ 生产环境部署
- ✅ 性能优化建议

**阅读时间**: 30-45 分钟

---

#### 2. [API 参考文档 (API-REFERENCE.md)](./API-REFERENCE.md)

**适合**: 开发者、API 集成

**内容包括**:

- ✅ 完整 API 列表
- ✅ 函数签名和参数
- ✅ 返回值和类型定义
- ✅ 代码示例
- ✅ 版本兼容性说明
- ✅ 错误代码参考

**阅读时间**: 作为参考手册使用

---

#### 3. [架构概览 (ARCHITECTURE-OVERVIEW.md)](./ARCHITECTURE-OVERVIEW.md)

**适合**: 架构师、高级开发者

**内容包括**:

- ✅ 系统架构设计
- ✅ 核心组件说明
- ✅ 数据流分析
- ✅ 数据库模式
- ✅ 插件系统
- ✅ 扩展性设计
- ✅ 部署架构

**阅读时间**: 45-60 分钟

---

#### 4. [故障排查指南 (TROUBLESHOOTING.md)](./TROUBLESHOOTING.md)

**适合**: 所有用户

**内容包括**:

- ✅ 常见问题解决方案
- ✅ 安装问题
- ✅ 数据库连接问题
- ✅ 性能问题
- ✅ 错误代码说明
- ✅ 调试技巧

**阅读时间**: 根据问题查阅

---

#### 5. [阻塞问题上报模版 (BLOCKING-ISSUES.md)](./BLOCKING-ISSUES.md)

**适合**: 遇到无法解决问题的用户

**内容包括**:

- ✅ 问题报告模版
- ✅ 环境信息清单
- ✅ 示例问题报告
- ✅ 响应时间预期
- ✅ 贡献指南

**使用场景**: 提交 GitHub Issue 前

---

### 📖 其他文档 (Additional Documentation)

#### [API.md](./API.md)

详细的 API 技术文档（英文）

#### [OVERVIEW.md](./OVERVIEW.md)

项目概览和设计理念（英文）

#### [AI_CONTEXT.md](./AI_CONTEXT.md)

AI 辅助开发上下文信息

---

## 快速开始 (Quick Start)

### 5 分钟快速体验

```bash
# 1. 安装
npm install fhir-engine

# 2. 创建项目
mkdir my-fhir-app && cd my-fhir-app
npm init -y
npm install fhir-engine
```

```typescript
// 3. 创建 index.ts
import { createFhirEngine, defineConfig } from "fhir-engine";

const config = defineConfig({
  database: {
    type: "sqlite",
    filename: "./fhir.db",
  },
  packages: {
    sources: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
  },
});

const engine = await createFhirEngine(config);
await engine.initialize();

// 4. 创建患者资源
const patient = await engine.create({
  resourceType: "Patient",
  name: [{ family: "Smith", given: ["John"] }],
  gender: "male",
  birthDate: "1980-01-01",
});

console.log("Created patient:", patient.id);

// 5. 读取资源
const retrieved = await engine.read("Patient", patient.id);
console.log("Retrieved patient:", retrieved);

await engine.shutdown();
```

```bash
# 6. 运行
npx tsx index.ts
```

**详细说明**: 请查看 [接入指南](./INTEGRATION-GUIDE.md)

---

## 学习路径 (Learning Path)

### 初级用户 (Beginner)

1. 阅读 [接入指南](./INTEGRATION-GUIDE.md) 的"快速开始"部分
2. 运行示例代码
3. 了解基本 CRUD 操作
4. 查看 [故障排查指南](./TROUBLESHOOTING.md) 解决常见问题

**预计时间**: 2-3 小时

---

### 中级用户 (Intermediate)

1. 深入学习 [API 参考文档](./API-REFERENCE.md)
2. 了解搜索和验证功能
3. 学习 [架构概览](./ARCHITECTURE-OVERVIEW.md) 中的核心组件
4. 实现自定义插件
5. 优化性能配置

**预计时间**: 1-2 天

---

### 高级用户 (Advanced)

1. 完整阅读 [架构概览](./ARCHITECTURE-OVERVIEW.md)
2. 理解数据流和存储机制
3. 实现自定义存储适配器
4. 设计分布式部署方案
5. 贡献代码和文档

**预计时间**: 3-5 天

---

## 常见使用场景 (Common Use Cases)

### 场景 1: 构建 FHIR 服务器

**推荐阅读**:

1. [接入指南](./INTEGRATION-GUIDE.md) - Express.js 集成示例
2. [API 参考](./API-REFERENCE.md) - CRUD 和搜索 API
3. [架构概览](./ARCHITECTURE-OVERVIEW.md) - 部署架构

---

### 场景 2: 医疗数据存储和检索

**推荐阅读**:

1. [接入指南](./INTEGRATION-GUIDE.md) - 数据库配置
2. [API 参考](./API-REFERENCE.md) - 搜索 API
3. [故障排查](./TROUBLESHOOTING.md) - 性能优化

---

### 场景 3: FHIR 数据验证服务

**推荐阅读**:

1. [API 参考](./API-REFERENCE.md) - 验证 API
2. [接入指南](./INTEGRATION-GUIDE.md) - 批量验证
3. [故障排查](./TROUBLESHOOTING.md) - 验证问题

---

### 场景 4: 数据迁移和转换

**推荐阅读**:

1. [接入指南](./INTEGRATION-GUIDE.md) - 数据迁移
2. [API 参考](./API-REFERENCE.md) - 重建索引 API
3. [架构概览](./ARCHITECTURE-OVERVIEW.md) - 数据库模式

---

## 版本升级指南 (Upgrade Guide)

### 从 0.5.x 升级到 0.6.0

**重大变更**:

1. 重建索引 API 升级到 V2
2. 批量验证功能需要 fhir-runtime >= 0.9.0
3. 数据库模式有更新

**升级步骤**:

```bash
# 1. 更新依赖
npm install fhir-engine@^0.6.0 fhir-runtime@^0.9.0 fhir-persistence@^0.6.0

# 2. 更新代码
# 将 reindexResourceType 改为 reindexResourceTypeV2
# 将 reindexAll 改为 reindexAllV2

# 3. 重建索引
npx tsx scripts/reindex.ts
```

**详细说明**: 查看 [CHANGELOG.md](../CHANGELOG.md)

---

## 性能基准 (Performance Benchmarks)

### SQLite (better-sqlite3)

- **创建**: ~1,000 资源/秒
- **读取**: ~5,000 资源/秒
- **搜索**: ~500 查询/秒（简单查询）
- **内存占用**: ~50MB（基础配置）

### PostgreSQL

- **创建**: ~2,000 资源/秒
- **读取**: ~10,000 资源/秒
- **搜索**: ~1,000 查询/秒（简单查询）
- **并发**: 支持 100+ 并发连接

**测试环境**: Node.js 18.20.0, 8GB RAM, SSD

---

## 最佳实践 (Best Practices)

### 1. 配置管理

- ✅ 使用环境变量管理敏感信息
- ✅ 不同环境使用不同配置文件
- ✅ 启用适当的日志级别

### 2. 错误处理

- ✅ 使用 try-catch 包装所有异步操作
- ✅ 记录详细的错误日志
- ✅ 实现优雅的错误恢复机制

### 3. 性能优化

- ✅ 使用连接池
- ✅ 启用数据库索引
- ✅ 实现查询结果缓存
- ✅ 使用批量操作

### 4. 安全性

- ✅ 使用参数化查询防止 SQL 注入
- ✅ 启用数据库 SSL 连接
- ✅ 实现访问控制
- ✅ 定期更新依赖

**详细说明**: 查看 [接入指南](./INTEGRATION-GUIDE.md)

---

## 社区和支持 (Community & Support)

### 获取帮助

1. **文档**: 首先查阅本文档集合
2. **GitHub Issues**: https://github.com/medxaidev/fhir-engine/issues
3. **GitHub Discussions**: https://github.com/medxaidev/fhir-engine/discussions
4. **邮件**: fangjun20208@gmail.com

### 报告问题

使用 [阻塞问题上报模版](./BLOCKING-ISSUES.md) 提交详细的问题报告

### 贡献代码

1. Fork 仓库
2. 创建特性分支
3. 提交 Pull Request
4. 等待代码审查

### 贡献文档

文档改进同样欢迎！发现错误或有改进建议，请提交 PR。

---

## 相关资源 (Related Resources)

### 官方资源

- **GitHub 仓库**: https://github.com/medxaidev/fhir-engine
- **npm 包**: https://www.npmjs.com/package/fhir-engine
- **更新日志**: [CHANGELOG.md](../CHANGELOG.md)
- **许可证**: [LICENSE](../LICENSE) (MIT)

### FHIR 规范

- **FHIR R4**: https://hl7.org/fhir/R4/
- **FHIR 包注册表**: https://packages.fhir.org/
- **HL7 官网**: https://www.hl7.org/

### 相关项目

- **fhir-runtime**: FHIR 运行时和验证
- **fhir-persistence**: FHIR 持久化层
- **fhir-definition**: FHIR 定义和类型

---

## 文档版本历史 (Documentation Version History)

| 版本   | 日期       | 变更说明                                                                              |
| ------ | ---------- | ------------------------------------------------------------------------------------- |
| v1.1.0 | 2026-03-18 | 升级 fhir-runtime 0.10.0，新增 Profile Slicing、Choice Type、BackboneElement API 文档 |
| v1.0.0 | 2026-03-17 | 初始版本，包含完整文档集合                                                            |

---

## 反馈和建议 (Feedback)

我们重视您的反馈！如果您对文档有任何建议或发现错误：

1. 在 GitHub 上提交 Issue
2. 发送邮件到 fangjun20208@gmail.com
3. 直接提交文档改进 PR

---

## 文档清单 (Documentation Checklist)

- [x] **INTEGRATION-GUIDE.md** - 接入指南
- [x] **API-REFERENCE.md** - API 参考文档
- [x] **ARCHITECTURE-OVERVIEW.md** - 架构概览
- [x] **TROUBLESHOOTING.md** - 故障排查指南
- [x] **BLOCKING-ISSUES.md** - 阻塞问题上报模版
- [x] **README.md** - 文档索引（本文档）

---

## 许可证 (License)

FHIR Engine 采用 MIT 许可证。详见 [LICENSE](../LICENSE) 文件。

---

**祝您使用愉快！Happy Coding! 🚀**

如有任何问题，请随时联系我们。
