# fhir-runtime — API Reference v0.8

> **Package:** `fhir-runtime@0.8.0`  
> **FHIR Version:** R4 (4.0.1)  
> **Release Date:** 2026-03-12  
> **License:** MIT  
> **Node.js:** >=18.0.0  
> **Module Format:** ESM (primary) + CJS (compatibility)  
> **Dependencies:** `fhir-definition@0.4.0`  
> **Companion Document:** `docs/specs/engine-capability-contract-v0.8.md`

This document is the public API reference for `fhir-runtime` at `v0.8.0`.

Compared with `v0.7.2`, this release adds the completed **fhir-definition Integration (STAGE-6)**:

- `DefinitionProvider` — re-exported from `fhir-definition`, core interface for consuming FHIR definitions
- `DefinitionBridge` — adapter composing FhirContext + VS/CS/SP registries into unified DefinitionProvider
- `NoOpDefinitionProvider` — default no-op implementation
- `DefinitionProviderLoader` — bridges DefinitionProvider into FhirContext's loader pipeline
- `createRuntime()` — async factory creating fully configured FhirRuntimeInstance
- `FhirRuntimeInstance` — unified runtime object with validate(), getSearchParameters(), extractSearchValues()
- Re-exported fhir-definition types: `DefinitionRegistry`, `InMemoryDefinitionRegistry`, `RegistryStatistics`, etc.

Any symbol not exported from `src/index.ts` remains internal and may change without notice.

---

## Table of Contents

1. [Top-Level Export Surface](#1-top-level-export-surface)
2. [Modules 1–11: Unchanged](#2-11-modules-unchanged)
3. [Module: definition](#12-module-definition)
4. [v0.8 Additions](#13-v08-additions)
5. [Compatibility Notes](#14-compatibility-notes)

---

## 1. Top-Level Export Surface

### 1.1 Core Runtime Exports

- `model`, `parser`, `context`, `profile`, `validator`, `fhirpath`
- `provider` (STAGE-1: v0.3.0)
- `terminology` (STAGE-3: v0.5.0)
- `package` (STAGE-4: v0.6.0)
- `integration` (STAGE-5: v0.7.0)
- `pipeline` (STAGE-2: v0.4.0)
- `definition` (STAGE-6: v0.8.0) ← **new**

### 1.2 Export Count

| Version | Modules | Type Exports | Value Exports | Total |
|---------|---------|-------------|---------------|-------|
| v0.6.0  | 10      | 165         | 131           | ~296  |
| v0.7.0  | 11      | 177         | 142           | ~319  |
| v0.8.0  | 12      | 188         | 146           | ~334  |

---

## 2–11. Modules: model, parser, context, profile, validator, fhirpath, provider, terminology, package, pipeline, integration

See [fhir-runtime-api-v0.7.md](./fhir-runtime-api-v0.7.md) — unchanged from v0.7.

---

## 12. Module: definition

**Source:** `src/definition/`  
**Added in:** v0.8.0 (STAGE-6)  
**Dependency direction:** `definition → model, context, provider, terminology, integration, validator, profile, fhir-definition`

### 12.1 Re-exported Types from fhir-definition

| Type | Description |
|------|-------------|
| `DefinitionProvider` | Core interface for consuming FHIR definitions (SD, VS, CS, SP) |
| `FhirDefStructureDefinition` | Minimal SD type from fhir-definition |
| `FhirDefValueSet` | Minimal VS type from fhir-definition |
| `FhirDefCodeSystem` | Minimal CS type from fhir-definition |
| `FhirDefSearchParameter` | Minimal SP type from fhir-definition |
| `DefinitionRegistry` | Interface for definition registry |
| `InMemoryDefinitionRegistry` | In-memory implementation (from fhir-definition) |
| `RegistryStatistics` | Statistics for loaded definitions |

### 12.2 Bridge Types

| Type | Description |
|------|-------------|
| `DefinitionBridgeOptions` | Options for creating DefinitionBridge (context, valueSets, codeSystems, searchParameters) |
| `RuntimeOptions` | Options for createRuntime() factory (definitions, context, terminology, referenceResolver, preloadCore) |
| `FhirRuntimeInstance` | Unified runtime object with validate(), getSearchParameters(), extractSearchValues() |

### 12.3 Classes

| Class | Description |
|-------|-------------|
| `DefinitionBridge` | Adapter composing FhirContext + registries → DefinitionProvider |
| `NoOpDefinitionProvider` | No-op implementation returning undefined/empty for all queries |
| `DefinitionProviderLoader` | StructureDefinitionLoader adapter bridging DefinitionProvider into FhirContext |

### 12.4 Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `createRuntime` | `(options?: RuntimeOptions) => Promise<FhirRuntimeInstance>` | Async factory creating fully configured runtime instance |

### 12.5 Usage Patterns

#### Pattern 1: With fhir-definition (Recommended)

```typescript
import { createRuntime } from 'fhir-runtime';
import { InMemoryDefinitionRegistry, loadFromDirectory } from 'fhir-definition';

const registry = new InMemoryDefinitionRegistry();
await loadFromDirectory('./fhir-packages/hl7.fhir.us.core', registry);
const runtime = await createRuntime({ definitions: registry });

const result = await runtime.validate(patient, 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient');
```

#### Pattern 2: With FhirContext (Legacy)

```typescript
import { createRuntime, FhirContextImpl, MemoryLoader } from 'fhir-runtime';

const context = new FhirContextImpl({ loaders: [new MemoryLoader(new Map())] });
const runtime = await createRuntime({ context });
```

#### Pattern 3: Bare Minimum

```typescript
import { createRuntime } from 'fhir-runtime';

const runtime = await createRuntime(); // Auto-loads R4 core definitions
const result = await runtime.validate(patient, 'http://hl7.org/fhir/StructureDefinition/Patient');
```

---

## 13. v0.8 Additions

### 13.1 New Exports (15 total)

**Type Exports (11)**:
- `DefinitionProvider`
- `FhirDefStructureDefinition`
- `FhirDefValueSet`
- `FhirDefCodeSystem`
- `FhirDefSearchParameter`
- `DefinitionRegistry`
- `InMemoryDefinitionRegistry`
- `RegistryStatistics`
- `DefinitionBridgeOptions`
- `RuntimeOptions`
- `FhirRuntimeInstance`

**Value Exports (4)**:
- `DefinitionBridge`
- `NoOpDefinitionProvider`
- `DefinitionProviderLoader`
- `createRuntime`

### 13.2 Breaking Changes

**None.** v0.8.0 is fully backward compatible with v0.7.x.

### 13.3 Important Notes

**FhirContextImpl with empty loaders**:
```typescript
// ❌ Throws error (CompositeLoader requires ≥1 loader)
new FhirContextImpl({ loaders: [] })

// ✅ Correct
new FhirContextImpl({ loaders: [new MemoryLoader(new Map())] })

// ✅ Or use createRuntime()
await createRuntime()
```

---

## 14. Compatibility Notes

### 14.1 Dependency Change

- **v0.7.x**: Zero runtime dependencies
- **v0.8.0**: Single dependency: `fhir-definition@0.4.0`

### 14.2 Migration Path

All existing code continues to work without modification. New APIs are purely additive.

See [devdocs/migration/UPGRADE-TO-v0.8.0-CHECKLIST.md](../../devdocs/migration/UPGRADE-TO-v0.8.0-CHECKLIST.md) for upgrade guide.

---

**Last Updated:** 2026-03-12  
**Status:** Stable  
**Next Release:** TBD
