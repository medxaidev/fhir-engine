# 一、FHIR Studio 的核心定位

**FHIR Studio = FHIR Developer IDE**

不是：

```
Server Admin UI
```

而是：

```
FHIR Development Environment
```

目标用户：

```
FHIR 开发者
医院系统工程师
医疗数据工程师
IG 作者
```

核心价值：

```
让 FHIR 开发变得简单
```

---

# 二、FHIR Studio 整体架构

整体结构：

```
FHIR Studio
│
├── UI Layer (React)
│
├── Studio Core
│
├── fhir-client
│
└── Server Layer
    ├── Local Server
    └── Remote Server
```

完整调用链：

```
React UI
   ↓
Studio Core
   ↓
fhir-client
   ↓
FHIR API
   ↓
FHIR Server
   ↓
FHIR Engine
   ↓
Persistence
```

---

# 三、FHIR Studio UI 架构

UI 设计参考：

Visual Studio Code

布局：

```
FHIR Studio
│
├── Left Sidebar
│
├── Main Workspace
│
└── Bottom Console
```

结构：

```
┌──────────────┬───────────────────────────┐
│              │                           │
│  Explorer    │      Workspace            │
│              │                           │
│              │                           │
├──────────────┴───────────────────────────┤
│                Console                   │
└──────────────────────────────────────────┘
```

---

# 四、Studio 核心模块

## 1️⃣ Server Explorer

用于管理连接的服务器。

```
Servers
│
├── Local Studio
├── Test Server
└── Production Server
```

支持：

```
Local SQLite Server
Remote FHIR Server
```

例如可以连接：

* HAPI FHIR
* Medplum

---

# 五、Resource Studio（核心）

FHIR 最重要的开发对象是：

```
Resource
```

Studio 必须提供完整资源工作台。

功能：

```
Resource Explorer
Resource Editor
Validation
Version History
```

结构：

```
Resources
│
├── Patient
├── Observation
├── Encounter
└── Medication
```

点击：

```
Observation/123
```

打开：

```
Resource Editor
```

---

## Resource Editor

必须支持三种模式：

```
Form View
JSON View
Diff View
```

Form View：

```
Patient
├── name
├── gender
├── birthDate
```

JSON View：

```
{
 "resourceType":"Patient"
}
```

Diff View：

```
compare versions
```

---

# 六、Query Studio

FHIR API 调试器。

类似：

Postman

支持：

```
GET /Patient
GET /Observation?subject=Patient/1
```

UI：

```
Query Builder
```

结构：

```
Resource: Observation
Filter: subject=Patient/123
Sort: date
Limit: 20
```

返回：

```
FHIR Bundle Viewer
```

---

# 七、FHIRPath Studio

FHIRPath 是开发者非常需要的工具。

目前几乎没有好的 IDE。

Studio 可以提供：

```
FHIRPath Playground
```

例如：

```
Patient.name.given
```

实时返回：

```
["John"]
```

高级功能：

```
AST View
Explain
Debug
```

---

# 八、IG Studio（Implementation Guide）

这是 FHIR 开发最大痛点之一。

现在主要工具是：

* FHIR IG Publisher

但非常复杂。

Studio 可以提供：

```
IG Workspace
```

结构：

```
IG
│
├── Profiles
├── Extensions
├── ValueSets
├── CodeSystems
└── Examples
```

例如：

```
Profile Builder
```

UI：

```
Base: Patient
Add Constraint
Add Extension
```

---

# 九、Terminology Studio

FHIR 中非常重要：

```
ValueSet
CodeSystem
```

IDE 必须提供：

```
Terminology Editor
```

功能：

```
ValueSet Browser
CodeSystem Editor
Expansion Viewer
```

例如：

```
LOINC
SNOMED
```

---

# 十、Workflow Studio（未来）

FHIR workflow：

```
Task
PlanDefinition
ActivityDefinition
```

IDE 可以做：

```
Workflow Designer
```

类似流程图：

```
Patient Registered
      ↓
Create Encounter
      ↓
Order Lab
```

这会非常强大。

---

# 十一、数据浏览器

类似数据库工具：

DBeaver

可以浏览：

```
Patient
Observation
Encounter
```

以表格形式：

```
| id | name | gender |
```

支持：

```
filter
sort
search
```

---

# 十二、Console

开发控制台：

```
FHIR API log
Server log
FHIRPath log
```

用于调试。

---

# 十三、Plugin 系统（非常重要）

真正的 IDE 必须支持：

```
Plugin System
```

插件可以增加：

```
SMART App Builder
Data Import
Terminology Tools
AI Assistant
```

例如未来：

```
AI Clinical Copilot
```

---

# 十四、Studio 技术架构

推荐技术：

UI：

```
React
PrismUI
```

核心：

```
studio-core
```

数据：

```
fhir-client
```

本地服务器：

```
medxai-server
```

数据库：

```
SQLite
```

---

# 十五、Studio 支持两种运行模式

## 模式 1

本地开发模式：

```
Studio
   ↓
Local Server
   ↓
SQLite
```

---

## 模式 2

远程服务器模式：

```
Studio
   ↓
FHIR Client
   ↓
Remote Server
```

例如：

```
HAPI FHIR
Medplum
```

---

# 十六、第一阶段 MVP

非常重要：不要做太大。

**FHIR Studio v1**

只做：

```
Server Explorer
Resource Explorer
Resource Editor
Query Studio
```

加：

```
Local SQLite Server
```

这已经非常有价值。

---

# 十七、第二阶段

增加：

```
FHIRPath Studio
Terminology Studio
```

---

# 十八、第三阶段

增加：

```
IG Studio
Workflow Studio
```

---

# 十九、长期战略

最终：

```
FHIR Studio = FHIR Developer Platform
```

生态：

```
FHIR Server
FHIR Studio
FHIR SDK
FHIR Plugins
```

成为：

```
FHIR Developer Toolchain
```
 
