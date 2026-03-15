# fhir-runtime — API Reference v0.3

> **Package:** `fhir-runtime@0.3.0`  
> **FHIR Version:** R4 (4.0.1)  
> **Release Date:** 2026-03-07  
> **License:** MIT  
> **Node.js:** >=18.0.0  
> **Module Format:** ESM (primary) + CJS (compatibility)  
> **Companion Document:** `docs/specs/engine-capability-contract-v0.3.md`

This document is the public API reference for `fhir-runtime` at `v0.3.0`.

Compared with `v0.2.0`, this release adds the completed **Provider Abstraction Layer (STAGE-1)**:

- `TerminologyProvider`
- `ReferenceResolver`
- `NoOpTerminologyProvider`
- `NoOpReferenceResolver`
- `OperationOutcome` types
- `OperationOutcomeBuilder` helper functions
- optional provider hooks on `ValidationOptions`

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
9. [v0.3 Additions](#9-v03-additions)
10. [Compatibility Notes](#10-compatibility-notes)

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
- public `fhirpath` evaluation helpers
- `provider` (new in `v0.3.0`)

### 1.2 Release Delta from v0.2

New top-level type exports in `v0.3.0`:

- `TerminologyProvider`
- `ValidateCodeParams`
- `ValidateCodeResult`
- `ExpandValueSetParams`
- `ValueSetExpansion`
- `ValueSetExpansionContains`
- `LookupCodeParams`
- `LookupCodeResult`
- `ReferenceResolver`
- `OperationOutcome`
- `OperationOutcomeIssue`
- `OperationOutcomeIssueType`

New top-level value exports in `v0.3.0`:

- `NoOpTerminologyProvider`
- `NoOpReferenceResolver`
- `buildOperationOutcome`
- `buildOperationOutcomeFromParse`
- `buildOperationOutcomeFromSnapshot`

---

## 2. Module: model

**Source:** `src/model/`  
**Purpose:** FHIR R4 type definitions — branded primitives, enums, complex types, `ElementDefinition`, `StructureDefinition`, `CanonicalProfile`.

This module remains unchanged in public intent from `v0.2.0`.

### 2.1 Export Categories

- Branded primitive FHIR types
- FHIR enums
- Base complex element/resource types
- `ElementDefinition` family types
- `StructureDefinition` family types
- Canonical profile semantic model types

### 2.2 Notes

- Exports are primarily type-level contracts
- No `provider` types were merged into `model`
- `OperationOutcome` is intentionally defined under `provider`, not `model`

---

## 3. Module: parser

**Source:** `src/parser/`  
**Purpose:** FHIR JSON parsing and serialization.

### 3.1 Top-Level Types

- `ParseSeverity`
- `ParseErrorCode`
- `ParseIssue`
- `ParseResult<T>`
- `ChoiceValue`
- `ChoiceTypeField`

### 3.2 Top-Level Functions

- `parseFhirJson`
- `parseFhirObject`
- `parseStructureDefinition`
- `parseElementDefinition`
- `serializeToFhirJson`
- `serializeToFhirObject`
- `parseSuccess`
- `parseFailure`
- `createIssue`
- `hasErrors`

### 3.3 v0.3 Notes

`v0.3.0` adds `buildOperationOutcomeFromParse()` in the provider module for translating `ParseResult` into FHIR-native `OperationOutcome` output.

---

## 4. Module: context

**Source:** `src/context/`  
**Purpose:** StructureDefinition registry, loading, inheritance resolution, bundle loading, and core definition access.

### 4.1 Key Types

- `FhirContext`
- `FhirContextOptions`
- `StructureDefinitionLoader`
- `LoaderOptions`
- `ContextStatistics`
- `BundleLoadOptions`
- `BundleLoadResult`
- `BundleLoadError`

### 4.2 Key Values

- `FhirContextImpl`
- `MemoryLoader`
- `FileSystemLoader`
- `CompositeLoader`
- `loadBundleFromObject`
- `loadBundleFromFile`
- `loadBundlesFromFiles`
- `loadAllCoreDefinitions`
- `loadCoreDefinition`
- `loadCoreDefinitionSync`
- `getCoreDefinitionsDir`
- `extractInnerTypes`

### 4.3 v0.3 Notes

No new top-level context exports were added specifically for `v0.3.0`.

---

## 5. Module: profile

**Source:** `src/profile/`  
**Purpose:** Snapshot generation, canonical profile building, path utilities, and differential merge logic.

### 5.1 Key Types

- `SnapshotGeneratorOptions`
- `SnapshotResult`
- `SnapshotIssue`
- `SnapshotIssueCode`
- `DiffElementTracker`
- `TraversalScope`
- `MergeContext`

### 5.2 Key Values

- `SnapshotGenerator`
- `buildCanonicalProfile`
- `buildCanonicalElement`
- `buildTypeConstraints`
- `buildBindingConstraint`
- `buildInvariants`
- `buildSlicingDefinition`
- profile error classes and merge/path utility helpers re-exported from `src/index.ts`

### 5.3 v0.3 Notes

`v0.3.0` adds `buildOperationOutcomeFromSnapshot()` in the provider module for translating snapshot results into `OperationOutcome` resources.

---

## 6. Module: validator

**Source:** `src/validator/`  
**Purpose:** Profile-based structural validation with issue reporting and FHIRPath invariant integration.

### 6.1 Key Types

- `ValidationOptions`
- `ValidationResult`
- `ValidationIssue`
- `ValidationIssueCode`

### 6.2 Key Values

- `StructureValidator`
- `createValidationIssue`
- `resolveValidationOptions`
- `hasValidationErrors`
- `extractValues`
- `ProfileNotFoundError`
- `ValidationFailedError`

### 6.3 `ValidationOptions` Changes in v0.3

The following optional fields were added:

```ts
interface ValidationOptions {
  terminologyProvider?: TerminologyProvider;
  referenceResolver?: ReferenceResolver;
}
```

#### Behavior

- If `terminologyProvider` is supplied, the validator can invoke provider hooks for binding-related checks
- If `terminologyProvider` is absent, validation remains backward compatible
- If `referenceResolver` is supplied, it becomes available for reference-oriented validation hooks
- If `referenceResolver` is absent, structural validation still works as before

### 6.4 v0.3 Notes

`buildOperationOutcome()` converts `ValidationResult` into a FHIR R4 `OperationOutcome` resource.

---

## 7. Module: fhirpath

**Source:** `src/fhirpath/`  
**Purpose:** FHIRPath parsing and evaluation.

### 7.1 Top-Level Public Helpers

- `evalFhirPath`
- `evalFhirPathBoolean`
- `evalFhirPathTyped`
- `evalFhirPathString`

### 7.2 Notes

The full internal `fhirpath` implementation remains organized under `src/fhirpath/`, but the top-level package documents only the supported re-exported evaluation helpers.

---

## 8. Module: provider

**Source:** `src/provider/`  
**Purpose:** Provider abstraction layer for terminology integration, reference resolution, and FHIR-native `OperationOutcome` generation.

This module is **new in `v0.3.0`**.

### 8.1 Terminology Provider Types

#### `ValidateCodeParams`

```ts
interface ValidateCodeParams {
  readonly system: string;
  readonly code: string;
  readonly valueSetUrl?: string;
  readonly display?: string;
}
```

#### `ValidateCodeResult`

```ts
interface ValidateCodeResult {
  readonly result: boolean;
  readonly message?: string;
  readonly display?: string;
}
```

#### `ExpandValueSetParams`

```ts
interface ExpandValueSetParams {
  readonly url: string;
  readonly filter?: string;
  readonly offset?: number;
  readonly count?: number;
}
```

#### `ValueSetExpansion`

```ts
interface ValueSetExpansion {
  readonly total?: number;
  readonly contains: readonly ValueSetExpansionContains[];
}
```

#### `ValueSetExpansionContains`

```ts
interface ValueSetExpansionContains {
  readonly system: string;
  readonly code: string;
  readonly display?: string;
}
```

#### `LookupCodeParams`

```ts
interface LookupCodeParams {
  readonly system: string;
  readonly code: string;
}
```

#### `LookupCodeResult`

```ts
interface LookupCodeResult {
  readonly found: boolean;
  readonly display?: string;
  readonly definition?: string;
}
```

#### `TerminologyProvider`

```ts
interface TerminologyProvider {
  validateCode(params: ValidateCodeParams): Promise<ValidateCodeResult>;
  expandValueSet(params: ExpandValueSetParams): Promise<ValueSetExpansion>;
  lookupCode(params: LookupCodeParams): Promise<LookupCodeResult>;
}
```

### 8.2 Reference Resolver

#### `ReferenceResolver`

```ts
interface ReferenceResolver {
  resolve(reference: string): Promise<Resource | undefined>;
  exists(reference: string): Promise<boolean>;
}
```

### 8.3 NoOp Implementations

#### `NoOpTerminologyProvider`

Default behavior:

- `validateCode()` always returns `{ result: true }`
- `expandValueSet()` always returns `{ contains: [] }`
- `lookupCode()` always returns `{ found: false }`

#### `NoOpReferenceResolver`

Default behavior:

- `resolve()` always returns `undefined`
- `exists()` always returns `true`

### 8.4 OperationOutcome Types

#### `OperationOutcome`

```ts
interface OperationOutcome {
  readonly resourceType: "OperationOutcome";
  readonly issue: readonly OperationOutcomeIssue[];
}
```

#### `OperationOutcomeIssue`

```ts
interface OperationOutcomeIssue {
  readonly severity: "fatal" | "error" | "warning" | "information";
  readonly code: OperationOutcomeIssueType;
  readonly diagnostics?: string;
  readonly details?: { readonly text?: string };
  readonly expression?: readonly string[];
}
```

#### `OperationOutcomeIssueType`

```ts
type OperationOutcomeIssueType =
  | "invalid"
  | "structure"
  | "required"
  | "value"
  | "invariant"
  | "processing"
  | "not-supported"
  | "not-found"
  | "business-rule"
  | "informational";
```

### 8.5 OperationOutcome Builder Functions

#### `buildOperationOutcome(result)`

```ts
function buildOperationOutcome(result: ValidationResult): OperationOutcome;
```

Converts a `ValidationResult` into a FHIR R4 `OperationOutcome`.

#### `buildOperationOutcomeFromParse(result)`

```ts
function buildOperationOutcomeFromParse(
  result: ParseResult<unknown>,
): OperationOutcome;
```

Converts a `ParseResult` into a FHIR R4 `OperationOutcome`.

#### `buildOperationOutcomeFromSnapshot(result)`

```ts
function buildOperationOutcomeFromSnapshot(
  result: SnapshotResult,
): OperationOutcome;
```

Converts a `SnapshotResult` into a FHIR R4 `OperationOutcome`.

### 8.6 Design Notes

- Provider APIs are async and promise-based
- No networking logic is embedded in `fhir-runtime`
- NoOp implementations preserve standalone runtime usage
- `OperationOutcome` support is kept self-contained in the provider layer

---

## 9. v0.3 Additions

### 9.1 New Capability Surface

`v0.3.0` introduces a new seventh module:

- `provider`

### 9.2 Release Summary

- New Provider Abstraction Layer contracts for terminology and references
- New NoOp implementations for placeholder integration scenarios
- New `OperationOutcomeBuilder` support for validation, parse, and snapshot results
- Validator integration extended with optional provider fields while remaining backward compatible

### 9.3 Testing Summary

- 97 new tests across 6 provider-focused test files
- Existing v0.2 baseline remains passing
- Backward compatible behavior preserved

---

## 10. Compatibility Notes

### 10.1 Backward Compatibility

`v0.3.0` is additive relative to `v0.2.0`.

- No public exports were removed
- Existing parser/profile/validator usage remains valid
- New provider integration points are optional and therefore backward compatible

### 10.2 Recommended Consumer Usage

Use `v0.3.0` if you need:

- a stable runtime engine for structural FHIR R4 processing
- server-layer integration contracts for terminology and reference services
- `OperationOutcome` generation for API responses

### 10.3 Still Out of Scope in v0.3

- actual terminology validation
- real terminology provider implementation
- cross-resource persistence-backed reference resolution
- IG package resolution
- REST server behavior

Actual terminology validation is planned for `STAGE-2 (v0.4.0)`.

---

For behavioral guarantees and release constraints, see `docs/specs/engine-capability-contract-v0.3.md`.
