# fhir-runtime — API Reference v0.5

> **Package:** `fhir-runtime@0.5.0`  
> **FHIR Version:** R4 (4.0.1)  
> **Release Date:** 2026-03-09  
> **License:** MIT  
> **Node.js:** >=18.0.0  
> **Module Format:** ESM (primary) + CJS (compatibility)  
> **Companion Document:** `docs/specs/engine-capability-contract-v0.5.md`

This document is the public API reference for `fhir-runtime` at `v0.5.0`.

Compared with `v0.4.0`, this release adds the completed **Terminology Binding Validation (STAGE-3)**:

- `InMemoryTerminologyProvider` — local in-memory terminology validation
- `validateBinding()` — binding strength-aware code validation
- `CodeSystemRegistry` / `ValueSetRegistry` — in-memory terminology registries
- `isCodeInValueSet()` — ValueSet membership evaluation
- Binding strength utilities (`severityForBindingStrength`, etc.)

Any symbol not exported from `src/index.ts` remains internal and may change without notice.

---

## Table of Contents

1. [Top-Level Export Surface](#1-top-level-export-surface)
2. [Module: model](#2-module-model)
3. [Module: parser](#3-module-parser)
4. [Module: context](#4-module-context)
5. [Module: profile](#5-module-profile)
6. [Module: validator](#6-module-validator)
7. [Module: fhirpath](#7-module-fhirpath)
8. [Module: provider](#8-module-provider)
9. [Module: terminology](#9-module-terminology)
10. [Module: pipeline](#10-module-pipeline)
11. [v0.5 Additions](#11-v05-additions)
12. [Compatibility Notes](#12-compatibility-notes)

---

## 1. Top-Level Export Surface

The package public API is defined by `src/index.ts`.

### 1.1 Core Runtime Exports

The following module families are re-exported from the top-level package entry:

- `model`
- `parser`
- `context`
- `profile`
- `validator`
- `fhirpath`
- `provider` (STAGE-1: v0.3.0)
- `terminology` (STAGE-3: v0.5.0) ← **new**
- `pipeline` (STAGE-2: v0.4.0)

### 1.2 Export Count

| Version | Type Exports | Value Exports | Total |
|---------|-------------|---------------|-------|
| v0.2.0  | 119         | 92            | 211   |
| v0.3.0  | 130         | 97            | 227   |
| v0.4.0  | 144         | 105           | 249   |
| v0.5.0  | 155         | 115           | 270   |

---

## 2–8. Modules: model, parser, context, profile, validator, fhirpath, provider

See [fhir-runtime-api-v0.4.md](./fhir-runtime-api-v0.4.md) — these modules are unchanged from v0.4.

---

## 9. Module: terminology

**Source:** `src/terminology/`  
**Added in:** v0.5.0 (STAGE-3)  
**Dependency direction:** `terminology → model, provider`

### 9.1 Types

| Type | Description |
|------|-------------|
| `CodeSystemDefinition` | In-memory CodeSystem representation (url, version, name, concepts) |
| `CodeSystemConcept` | A concept in a CodeSystem (code, display, definition, children) |
| `ValueSetDefinition` | In-memory ValueSet representation (url, version, name, compose, expansion) |
| `ValueSetCompose` | Intensional ValueSet definition (include/exclude rules) |
| `ValueSetComposeInclude` | Single include/exclude clause (system, version, concept, filter) |
| `ValueSetComposeConcept` | Explicitly enumerated concept in compose |
| `ValueSetComposeFilter` | Filter rule (property, op, value) |
| `ValueSetExpansionDef` | Pre-expanded ValueSet (total, contains) |
| `ValueSetExpansionContainsDef` | Single concept in expansion |
| `BindingValidationResult` | Result of binding validation (valid, severity, message, code, system, valueSetUrl) |
| `BindingConstraintInput` | Binding constraint input (strength, valueSetUrl) |

### 9.2 Classes

#### `InMemoryTerminologyProvider`

Implements `TerminologyProvider`. Stores CodeSystems and ValueSets in memory.

```typescript
class InMemoryTerminologyProvider implements TerminologyProvider {
  registerCodeSystem(cs: CodeSystemDefinition): void;
  registerValueSet(vs: ValueSetDefinition): void;
  loadFromBundle(bundle: unknown): void;
  getCodeSystemRegistry(): CodeSystemRegistry;
  getValueSetRegistry(): ValueSetRegistry;
  // TerminologyProvider interface:
  validateCode(params: ValidateCodeParams): Promise<ValidateCodeResult>;
  expandValueSet(params: ExpandValueSetParams): Promise<ValueSetExpansion>;
  lookupCode(params: LookupCodeParams): Promise<LookupCodeResult>;
}
```

#### `CodeSystemRegistry`

In-memory CodeSystem storage with hierarchical lookup.

```typescript
class CodeSystemRegistry {
  register(cs: CodeSystemDefinition): void;
  get(url: string): CodeSystemDefinition | undefined;
  has(url: string): boolean;
  remove(url: string): boolean;
  readonly size: number;
  urls(): string[];
  clear(): void;
  lookupCode(systemUrl: string, code: string): CodeSystemConcept | undefined;
  hasCode(systemUrl: string, code: string): boolean;
  isDescendantOf(systemUrl: string, descendantCode: string, ancestorCode: string): boolean;
  allCodes(systemUrl: string): string[];
}
```

#### `ValueSetRegistry`

In-memory ValueSet storage.

```typescript
class ValueSetRegistry {
  register(vs: ValueSetDefinition): void;
  get(url: string): ValueSetDefinition | undefined;
  has(url: string): boolean;
  remove(url: string): boolean;
  readonly size: number;
  urls(): string[];
  clear(): void;
}
```

### 9.3 Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `validateBinding` | `(value, binding, provider?) → Promise<BindingValidationResult>` | Validate a coded value against a binding constraint |
| `extractCodedValues` | `(value) → CodeEntry[]` | Extract code entries from FHIR coded elements (code, Coding, CodeableConcept) |
| `isCodeInValueSet` | `(vs, system, code, csRegistry?) → boolean` | Check ValueSet membership (expansion or compose) |
| `severityForBindingStrength` | `(strength) → severity \| undefined` | Map binding strength to issue severity when code is not in ValueSet |
| `severityWhenNoProvider` | `(strength) → severity \| undefined` | Map binding strength to severity when no provider available |
| `requiresValidation` | `(strength) → boolean` | Whether a binding strength requires validation |
| `bindingStrengthDescription` | `(strength) → string` | Human-readable description of binding strength |

### 9.4 Binding Strength Matrix

| Strength | With Provider (invalid code) | Without Provider |
|----------|------------------------------|------------------|
| `required` | error | warning |
| `extensible` | warning | information |
| `preferred` | information | skip |
| `example` | skip | skip |

### 9.5 ValueSet Membership Algorithm

1. If ValueSet has `expansion` → check `expansion.contains`
2. If ValueSet has `compose` → evaluate `include` / `exclude` rules
3. Include with `concept` list → enumeration match
4. Include with `filter` → filter evaluation (is-a, in, regex, etc.)
5. Include with only `system` → entire CodeSystem included (verified against registry)

---

## 10. Module: pipeline

See [fhir-runtime-api-v0.4.md](./fhir-runtime-api-v0.4.md) — unchanged from v0.4.

**v0.5 note:** `TerminologyValidationStep` is now fully functional when `InMemoryTerminologyProvider` is injected via `PipelineOptions.terminologyProvider`.

---

## 11. v0.5 Additions

### 11.1 New Type Exports (11)

```typescript
export type {
  CodeSystemDefinition,
  CodeSystemConcept,
  ValueSetDefinition,
  ValueSetCompose,
  ValueSetComposeInclude,
  ValueSetComposeConcept,
  ValueSetComposeFilter,
  ValueSetExpansionDef,
  ValueSetExpansionContainsDef,
  BindingValidationResult,
  BindingConstraintInput,
} from './terminology/index.js';
```

### 11.2 New Value Exports (10)

```typescript
export {
  InMemoryTerminologyProvider,
  validateBinding,
  extractCodedValues,
  severityForBindingStrength,
  severityWhenNoProvider,
  requiresValidation,
  bindingStrengthDescription,
  CodeSystemRegistry,
  ValueSetRegistry,
  isCodeInValueSet,
} from './terminology/index.js';
```

---

## 12. Compatibility Notes

- All v0.4.0 exports remain available and unchanged
- Zero runtime dependencies (unchanged)
- Node.js >=18.0.0 (unchanged)
- ESM primary + CJS compatibility (unchanged)
- Total public exports: ~270 (155 types + 115 values)
