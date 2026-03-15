# fhir-runtime — API Reference v0.4

> **Package:** `fhir-runtime@0.4.0`  
> **FHIR Version:** R4 (4.0.1)  
> **Release Date:** 2026-03-08  
> **License:** MIT  
> **Node.js:** >=18.0.0  
> **Module Format:** ESM (primary) + CJS (compatibility)  
> **Companion Document:** `docs/specs/engine-capability-contract-v0.4.md`

This document is the public API reference for `fhir-runtime` at `v0.4.0`.

Compared with `v0.3.0`, this release adds the completed **Validation Pipeline & DX Enhancement (STAGE-4)**:

- `ValidationPipeline` — composable validation orchestrator
- `StructuralValidationStep`, `TerminologyValidationStep`, `InvariantValidationStep` — built-in steps
- `HookManager` — pipeline lifecycle event system
- `generateReport()` — structured validation reports
- `enhanceIssue()` / `enhanceIssues()` — DX-enhanced error messages
- Batch validation support

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
9. [Module: pipeline](#9-module-pipeline)
10. [v0.4 Additions](#10-v04-additions)
11. [Compatibility Notes](#11-compatibility-notes)

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
- `provider` (added in `v0.3.0`)
- `pipeline` (new in `v0.4.0`)

### 1.2 Release Delta from v0.3

New top-level type exports in `v0.4.0`:

- `ValidationStep`
- `PipelineContext`
- `PipelineOptions`
- `PipelineResult`
- `StepResult`
- `BatchEntry`
- `BatchResult`
- `BatchEntryResult`
- `PipelineEvent`
- `PipelineEventHandler`
- `PipelineEventData`
- `EnhancedValidationIssue`
- `ValidationReport`
- `ReportSummary`

New top-level value exports in `v0.4.0`:

- `ValidationPipeline`
- `StructuralValidationStep`
- `TerminologyValidationStep`
- `InvariantValidationStep`
- `generateReport`
- `enhanceIssue`
- `enhanceIssues`
- `HookManager`

---

## 2. Module: model

**Source:** `src/model/`  
**Purpose:** FHIR R4 type definitions — branded primitives, enums, complex types, `ElementDefinition`, `StructureDefinition`, `CanonicalProfile`.

This module remains unchanged from `v0.3.0`.

---

## 3. Module: parser

**Source:** `src/parser/`  
**Purpose:** FHIR JSON parsing and serialization.

This module remains unchanged from `v0.3.0`.

---

## 4. Module: context

**Source:** `src/context/`  
**Purpose:** StructureDefinition registry, loading, inheritance resolution, bundle loading, and core definition access.

This module remains unchanged from `v0.3.0`.

---

## 5. Module: profile

**Source:** `src/profile/`  
**Purpose:** Snapshot generation, canonical profile building, path utilities, and differential merge logic.

This module remains unchanged from `v0.3.0`.

---

## 6. Module: validator

**Source:** `src/validator/`  
**Purpose:** Profile-based structural validation with issue reporting and FHIRPath invariant integration.

This module remains unchanged from `v0.3.0`. The new pipeline module wraps the existing validator as a composable step.

---

## 7. Module: fhirpath

**Source:** `src/fhirpath/`  
**Purpose:** FHIRPath parsing and evaluation.

This module remains unchanged from `v0.3.0`.

---

## 8. Module: provider

**Source:** `src/provider/`  
**Purpose:** Provider abstraction layer for terminology integration, reference resolution, and FHIR-native `OperationOutcome` generation.

This module remains unchanged from `v0.3.0`. The pipeline's `TerminologyValidationStep` uses the `TerminologyProvider` interface from this module.

---

## 9. Module: pipeline

**Source:** `src/pipeline/`  
**Purpose:** Composable validation pipeline with pluggable steps, lifecycle hooks, batch validation, enhanced error messages, and structured reports.

This module is **new in `v0.4.0`**.

### 9.1 Core Types

#### `ValidationStep`

```ts
interface ValidationStep {
  readonly name: string;
  readonly priority?: number;
  validate(
    resource: Resource,
    profile: CanonicalProfile,
    context: PipelineContext,
  ): Promise<ValidationIssue[]>;
  shouldRun?(resource: Resource, profile: CanonicalProfile): boolean;
}
```

The pluggable step interface. Steps are executed in `priority` order (lower = earlier). If `shouldRun` returns `false`, the step is skipped.

#### `PipelineContext`

```ts
interface PipelineContext {
  readonly options: PipelineOptions;
  readonly issues: readonly ValidationIssue[];
  readonly shared: Map<string, unknown>;
  readonly aborted: boolean;
  readonly terminologyProvider?: TerminologyProvider;
  readonly referenceResolver?: ReferenceResolver;
  readonly fhirContext?: FhirContext;
}
```

Shared context passed to each step. Provides access to accumulated issues, shared data, abort state, and optional providers.

#### `PipelineOptions`

```ts
interface PipelineOptions {
  failFast?: boolean;
  maxDepth?: number;
  minSeverity?: 'error' | 'warning' | 'information';
  terminologyProvider?: TerminologyProvider;
  referenceResolver?: ReferenceResolver;
  fhirContext?: FhirContext;
}
```

- `failFast` — abort remaining steps after first error
- `maxDepth` — limit validation depth
- `minSeverity` — filter issues below this severity level

#### `PipelineResult`

```ts
interface PipelineResult {
  valid: boolean;
  resource: Resource;
  profileUrl: string;
  issues: readonly ValidationIssue[];
  stepResults: readonly StepResult[];
  duration: number;
}
```

#### `StepResult`

```ts
interface StepResult {
  stepName: string;
  issues: readonly ValidationIssue[];
  duration: number;
  skipped: boolean;
}
```

### 9.2 Batch Types

#### `BatchEntry`

```ts
interface BatchEntry {
  resource: Resource;
  profile: CanonicalProfile;
  label?: string;
}
```

#### `BatchResult`

```ts
interface BatchResult {
  total: number;
  passed: number;
  failed: number;
  results: readonly BatchEntryResult[];
  duration: number;
}
```

#### `BatchEntryResult`

```ts
interface BatchEntryResult {
  label?: string;
  result: PipelineResult;
}
```

### 9.3 Hook Types

#### `PipelineEvent`

```ts
type PipelineEvent =
  | 'beforeValidation'
  | 'afterValidation'
  | 'beforeStep'
  | 'afterStep'
  | 'onIssue'
  | 'onError';
```

#### `PipelineEventHandler`

```ts
type PipelineEventHandler = (data: PipelineEventData) => void | Promise<void>;
```

#### `PipelineEventData`

```ts
interface PipelineEventData {
  event: PipelineEvent;
  resource?: Resource;
  profile?: CanonicalProfile;
  step?: ValidationStep;
  issue?: ValidationIssue;
  result?: PipelineResult;
  context?: PipelineContext;
}
```

### 9.4 Enhanced Messages

#### `EnhancedValidationIssue`

```ts
interface EnhancedValidationIssue extends ValidationIssue {
  suggestion?: string;
  documentationUrl?: string;
  expected?: string;
  actual?: string;
}
```

### 9.5 Report Types

#### `ValidationReport`

```ts
interface ValidationReport {
  timestamp: string;
  summary: ReportSummary;
  issuesBySeverity: Record<string, ValidationIssue[]>;
  issuesByPath: Record<string, ValidationIssue[]>;
  issuesByStep: Record<string, ValidationIssue[]>;
}
```

#### `ReportSummary`

```ts
interface ReportSummary {
  resourceType: string;
  profileUrl: string;
  valid: boolean;
  totalIssues: number;
  errors: number;
  warnings: number;
  information: number;
  stepsRun: number;
  duration: number;
}
```

### 9.6 Classes

#### `ValidationPipeline`

```ts
class ValidationPipeline {
  constructor(options?: PipelineOptions);
  addStep(step: ValidationStep): this;
  removeStep(name: string): this;
  on(event: PipelineEvent, handler: PipelineEventHandler): this;
  validate(resource: Resource, profile: CanonicalProfile): Promise<PipelineResult>;
  validateBatch(entries: BatchEntry[]): Promise<BatchResult>;
  getSteps(): readonly ValidationStep[];
}
```

#### `StructuralValidationStep`

```ts
class StructuralValidationStep implements ValidationStep {
  readonly name = 'structural';
  readonly priority = 10;
}
```

Wraps the existing `StructureValidator` as a pipeline step.

#### `TerminologyValidationStep`

```ts
class TerminologyValidationStep implements ValidationStep {
  readonly name = 'terminology';
  readonly priority = 20;
}
```

Validates coded elements against their declared bindings using the `TerminologyProvider` from the pipeline context. Skipped if no provider is available.

#### `InvariantValidationStep`

```ts
class InvariantValidationStep implements ValidationStep {
  readonly name = 'invariant';
  readonly priority = 30;
}
```

Evaluates FHIRPath invariant constraints from profile elements.

#### `HookManager`

```ts
class HookManager {
  on(event: PipelineEvent, handler: PipelineEventHandler): void;
  off(event: PipelineEvent, handler: PipelineEventHandler): void;
  emit(data: PipelineEventData): Promise<void>;
  hasHandlers(event: PipelineEvent): boolean;
  clear(): void;
}
```

### 9.7 Functions

#### `generateReport(result)`

```ts
function generateReport(result: PipelineResult): ValidationReport;
```

Generates a structured validation report from a pipeline result, grouping issues by severity, path, and step.

#### `enhanceIssue(issue)`

```ts
function enhanceIssue(issue: ValidationIssue): EnhancedValidationIssue;
```

Enriches a validation issue with a suggestion, documentation URL, and expected/actual values.

#### `enhanceIssues(issues)`

```ts
function enhanceIssues(issues: readonly ValidationIssue[]): EnhancedValidationIssue[];
```

Enhances an array of validation issues.

### 9.8 Design Notes

- All validation steps are async (because `TerminologyProvider` is async)
- Steps execute in priority order (lower priority number = earlier execution)
- The pipeline wraps existing validation infrastructure; it does not replace `StructureValidator`
- Enhanced messages cover all standard `ValidationIssueCode` types
- Hook handlers are executed sequentially in registration order

---

## 10. v0.4 Additions

### 10.1 New Capability Surface

`v0.4.0` introduces a new eighth module:

- `pipeline`

### 10.2 Release Summary

- New composable validation pipeline with pluggable step architecture
- Three built-in validation steps (structural, terminology, invariant)
- Lifecycle hook system for pipeline events
- Batch validation for multiple resources
- Enhanced error messages with fix suggestions and documentation links
- Structured validation reports with multi-axis issue grouping

### 10.3 Testing Summary

- 110 new tests across 9 pipeline-focused test files
- 16 JSON fixture tests for batch validation
- 18 JSON fixture tests for enhanced error messages
- 17 end-to-end integration tests
- Existing v0.3 baseline remains passing
- Total: 2,995 tests across 65 test files

---

## 11. Compatibility Notes

### 11.1 Backward Compatibility

`v0.4.0` is additive relative to `v0.3.0`.

- No public exports were removed
- Existing parser/profile/validator/provider usage remains valid
- Pipeline is an optional enhancement layer; existing `StructureValidator` flows are unaffected

### 11.2 Recommended Consumer Usage

Use `v0.4.0` if you need:

- composable, multi-step validation pipelines
- lifecycle hooks for monitoring or customizing validation flow
- batch validation of multiple resources
- developer-friendly enhanced error messages with fix suggestions
- structured validation reports

### 11.3 Still Out of Scope in v0.4

- IG package loading and dependency resolution
- SearchParameter indexing
- REST FHIR server behavior
- XML / RDF serialization
- FHIR R5 / R6 support

IG package support is planned for `STAGE-3 (v0.5.0)`.

---

For behavioral guarantees and release constraints, see `docs/specs/engine-capability-contract-v0.4.md`.
