# fhir-runtime — API Reference v0.7

> **Package:** `fhir-runtime@0.7.0`  
> **FHIR Version:** R4 (4.0.1)  
> **Release Date:** 2026-03-10  
> **License:** MIT  
> **Node.js:** >=18.0.0  
> **Module Format:** ESM (primary) + CJS (compatibility)  
> **Companion Document:** `docs/specs/engine-capability-contract-v0.7.md`

This document is the public API reference for `fhir-runtime` at `v0.7.0`.

Compared with `v0.6.0`, this release adds the completed **Server/Persistence Integration (STAGE-5)**:

- `parseSearchParameter()` / `parseSearchParametersFromBundle()` — typed SearchParameter parsing
- `extractSearchValues()` / `extractAllSearchValues()` — FHIRPath-based search index value extraction
- `extractReferences()` / `extractReferencesFromBundle()` — Reference tree walking
- `validateReferenceTargets()` — Reference target type validation
- `buildCapabilityFragment()` — CapabilityStatement REST fragment generation
- `ResourceTypeRegistry` + `FHIR_R4_RESOURCE_TYPES` — resource type catalog

Any symbol not exported from `src/index.ts` remains internal and may change without notice.

---

## Table of Contents

1. [Top-Level Export Surface](#1-top-level-export-surface)
2. [Modules 2–10: Unchanged](#2-10-modules-unchanged)
3. [Module: integration](#11-module-integration)
4. [v0.7 Additions](#12-v07-additions)
5. [Compatibility Notes](#13-compatibility-notes)

---

## 1. Top-Level Export Surface

### 1.1 Core Runtime Exports

- `model`, `parser`, `context`, `profile`, `validator`, `fhirpath`
- `provider` (STAGE-1: v0.3.0)
- `terminology` (STAGE-3: v0.5.0)
- `package` (STAGE-4: v0.6.0)
- `integration` (STAGE-5: v0.7.0) ← **new**
- `pipeline` (STAGE-2: v0.4.0)

### 1.2 Export Count

| Version | Type Exports | Value Exports | Total |
|---------|-------------|---------------|-------|
| v0.3.0  | 130         | 97            | 227   |
| v0.4.0  | 144         | 105           | 249   |
| v0.5.0  | 155         | 115           | 270   |
| v0.6.0  | 165         | 131           | ~296  |
| v0.7.0  | 177         | 142           | ~280+ |

---

## 2–10. Modules: model, parser, context, profile, validator, fhirpath, provider, terminology, package, pipeline

See [fhir-runtime-api-v0.6.md](./fhir-runtime-api-v0.6.md) — unchanged from v0.6.

---

## 11. Module: integration

**Source:** `src/integration/`  
**Added in:** v0.7.0 (STAGE-5)  
**Dependency direction:** `integration → model, parser, context, fhirpath`

### 11.1 Types

| Type | Description |
|------|-------------|
| `SearchParamType` | Union of 9 FHIR search param types: number, date, string, token, reference, composite, quantity, uri, special |
| `SearchParameter` | Parsed FHIR SearchParameter resource (url, name, code, base, type, expression, etc.) |
| `SearchIndexValue` | Discriminated union of extracted search values (string, token, reference, date, number, quantity, uri) |
| `SearchIndexEntry` | Search index entry for a single SearchParameter (code, type, values[]) |
| `ReferenceType` | Reference classification: literal, logical, contained, absolute |
| `ReferenceInfo` | Extracted reference info (path, reference, targetType, referenceType, targetId, display) |
| `CapabilitySearchParam` | Search parameter entry in CapabilityStatement REST resource |
| `CapabilityRestResource` | Resource entry in CapabilityStatement REST section |
| `CapabilityStatementRest` | REST section of a CapabilityStatement (mode, resource[]) |
| `ResourceTypeInfo` | Resource type metadata (type, url, kind, abstract, baseDefinition) |

### 11.2 Classes

#### `ResourceTypeRegistry`

Registry of known FHIR resource types with metadata.

```typescript
class ResourceTypeRegistry {
  register(info: ResourceTypeInfo): void;
  get(type: string): ResourceTypeInfo | undefined;
  isKnown(type: string): boolean;
  getAll(): ResourceTypeInfo[];
  getConcreteTypes(): ResourceTypeInfo[];
  remove(type: string): boolean;
  clear(): void;
  readonly size: number;
  static fromContext(context: FhirContext): ResourceTypeRegistry;
  static fromList(types: ResourceTypeInfo[]): ResourceTypeRegistry;
}
```

### 11.3 Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `parseSearchParameter` | `(json: unknown) → ParseResult<SearchParameter>` | Parse single SearchParameter from JSON |
| `parseSearchParametersFromBundle` | `(bundle: unknown) → ParseResult<SearchParameter[]>` | Batch parse SearchParameters from Bundle |
| `extractSearchValues` | `(resource, searchParam) → SearchIndexEntry` | Extract search values for single param |
| `extractAllSearchValues` | `(resource, searchParams[]) → SearchIndexEntry[]` | Extract values for all applicable params |
| `extractReferences` | `(resource) → ReferenceInfo[]` | Extract all References from a resource |
| `extractReferencesFromBundle` | `(bundle) → ReferenceInfo[]` | Extract all References from a Bundle |
| `validateReferenceTargets` | `(resource, profile) → Issue[]` | Validate reference target types |
| `buildCapabilityFragment` | `(profiles, searchParams?, mode?) → CapabilityStatementRest` | Generate CapabilityStatement REST fragment |

### 11.4 Constants

| Constant | Type | Description |
|----------|------|-------------|
| `FHIR_R4_RESOURCE_TYPES` | `readonly string[]` | Complete list of 148 FHIR R4 resource types |

---

## 12. v0.7 Additions

### 12.1 New Type Exports (12)

```typescript
export type {
  SearchParamType, SearchParameter,
  SearchIndexValue, SearchIndexEntry,
  ReferenceType, ReferenceInfo,
  CapabilitySearchParam, CapabilityRestResource, CapabilityStatementRest,
  ResourceTypeInfo,
} from './integration/index.js';
```

### 12.2 New Value Exports (11)

```typescript
export {
  parseSearchParameter, parseSearchParametersFromBundle,
  extractSearchValues, extractAllSearchValues,
  extractReferences, extractReferencesFromBundle, validateReferenceTargets,
  buildCapabilityFragment,
  ResourceTypeRegistry, FHIR_R4_RESOURCE_TYPES,
} from './integration/index.js';
```

---

## 13. Compatibility Notes

- All v0.6.0 exports remain available and unchanged
- `extractSearchValues()` uses existing `evalFhirPath()` — no new parser dependencies
- No SQL or persistence logic — separation of concerns with fhir-persistence maintained
- Zero runtime dependencies (unchanged)
- Node.js >=18.0.0 (unchanged)
- ESM primary + CJS compatibility (unchanged)
