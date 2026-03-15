# fhir-runtime — Engine Capability Contract v0.4

> **Status:** Frozen for v0.4.0 Release  
> **FHIR Version:** R4 (4.0.1)  
> **Specification Date:** 2026-03-08  
> **Audience:** Node.js API consumers, CLI consumers, downstream server and persistence layers  
> **Reference Target:** HAPI FHIR R4 for structural equivalence where applicable

---

## 1. Scope

### 1.1 In-Scope (v0.4)

| #   | Capability                                              | Notes                                               |
| --- | ------------------------------------------------------- | --------------------------------------------------- |
| 1   | FHIR R4 JSON parsing and serialization                  | Unchanged from v0.3                                 |
| 2   | StructureDefinition registry and inheritance resolution | Unchanged from v0.3                                 |
| 3   | Snapshot generation                                     | Unchanged from v0.3                                 |
| 4   | Structural validation                                   | Unchanged from v0.3                                 |
| 5   | FHIRPath evaluation and invariant execution             | Unchanged from v0.3                                 |
| 6   | Bundle loading and core definition loading              | Unchanged from v0.3                                 |
| 7   | Provider Abstraction Layer (STAGE-1)                    | Unchanged from v0.3                                 |
| 8   | Default NoOp provider implementations                   | Unchanged from v0.3                                 |
| 9   | OperationOutcomeBuilder support                         | Unchanged from v0.3                                 |
| 10  | Optional validator provider hooks                       | Unchanged from v0.3                                 |
| 11  | Composable Validation Pipeline (STAGE-4)                | New in v0.4: pluggable step orchestration           |
| 12  | Built-in validation steps                               | New in v0.4: structural, terminology, invariant     |
| 13  | Pipeline lifecycle hook system                          | New in v0.4: event-driven extensibility             |
| 14  | Batch validation                                        | New in v0.4: multi-resource validation              |
| 15  | Enhanced error messages                                 | New in v0.4: suggestions, docs links, expected/actual |
| 16  | Structured validation reports                           | New in v0.4: multi-axis issue grouping              |

### 1.2 Out-of-Scope (v0.4)

| #   | Excluded Capability                                          | Rationale                        |
| --- | ------------------------------------------------------------ | -------------------------------- |
| 1   | IG package loading and dependency resolution                 | Planned for `STAGE-3 (v0.5.0)`  |
| 2   | NpmPackageLoader for .tgz packages                           | Planned for `STAGE-3 (v0.5.0)`  |
| 3   | Cross-package canonical resolution                           | Planned for later stages         |
| 4   | SearchParameter indexing                                     | Persistence-layer concern        |
| 5   | REST FHIR server                                             | Server-layer concern             |
| 6   | Persistence-backed reference resolution                      | Higher-layer concern             |
| 7   | XML / RDF serialization                                      | JSON-focused runtime             |
| 8   | FHIR R5 / R6 support                                         | Future version target            |
| 9   | Concurrent batch validation                                  | Sequential execution sufficient  |

---

## 2. Architecture Overview

### 2.1 Module Dependency Shape

```text
model ← parser ← context ← profile ← validator
                                  ↑
                              fhirpath

provider → model (types only)
validator → provider (optional integration)
pipeline → model, validator, provider (wraps existing infrastructure)
pipeline → fhirpath (via InvariantValidationStep)
```

### 2.2 Runtime Positioning

`fhir-runtime` remains a **runtime engine**, not a complete FHIR server.

In `v0.4.0`, the project adds a composable validation pipeline that orchestrates existing validation capabilities into a flexible, extensible workflow with lifecycle hooks, batch support, and developer-friendly output.

### 2.3 Core Result Objects

Existing result objects remain part of the public contract:

- `ParseResult<T>`
- `SnapshotResult`
- `ValidationResult`
- `OperationOutcome` / `OperationOutcomeIssue`

New in `v0.4.0`:

- `PipelineResult`
- `StepResult`
- `BatchResult` / `BatchEntryResult`
- `EnhancedValidationIssue`
- `ValidationReport` / `ReportSummary`

---

## 3. Capability Contracts

### 3.1 Parsing Contract

Unchanged from v0.3.

### 3.2 Snapshot Contract

Unchanged from v0.3.

### 3.3 Validation Contract

Unchanged from v0.3. The new pipeline module wraps the existing validator as a composable step but does not alter the `StructureValidator` behavior.

### 3.4 Provider Abstraction Contract

Unchanged from v0.3.

### 3.5 NoOp Provider Contract

Unchanged from v0.3.

### 3.6 OperationOutcome Contract

Unchanged from v0.3.

### 3.7 Pipeline Contract

The runtime now guarantees a composable validation pipeline:

**`ValidationPipeline` shall:**

- execute registered `ValidationStep` instances in priority order
- pass a shared `PipelineContext` to each step
- collect all issues from all steps into a unified `PipelineResult`
- support `failFast` mode that aborts remaining steps after the first error
- support `minSeverity` filtering to exclude issues below the configured threshold
- support batch validation of multiple resources via `validateBatch()`
- fire lifecycle hooks (`beforeValidation`, `afterValidation`, `beforeStep`, `afterStep`, `onIssue`, `onError`)

**`ValidationPipeline` shall not:**

- replace or modify the existing `StructureValidator` behavior
- require any specific validation step to be registered
- guarantee parallel execution of batch entries (sequential only)

### 3.8 Built-in Step Contract

#### `StructuralValidationStep`

- Wraps the existing `StructureValidator`
- Priority: 10
- Always available; does not require external providers

#### `TerminologyValidationStep`

- Validates coded elements against declared bindings using `TerminologyProvider`
- Priority: 20
- Returns empty issues when no `TerminologyProvider` is available in context
- Maps binding strength to issue severity: `required` → error, `extensible` → warning, `preferred`/`example` → information

#### `InvariantValidationStep`

- Evaluates FHIRPath constraints from profile elements
- Priority: 30
- Wraps the existing `validateInvariants()` function

### 3.9 Hook System Contract

- Handlers are invoked sequentially in registration order
- Handlers may be async
- Handler errors do not abort the pipeline (they are caught internally)
- Events are emitted for all registered handlers matching the event type

### 3.10 Enhanced Messages Contract

`enhanceIssue()` shall:

- return an `EnhancedValidationIssue` for any `ValidationIssue`
- provide a `suggestion` for all standard `ValidationIssueCode` types that have registered rules
- provide a `documentationUrl` linking to the relevant FHIR R4 spec section where applicable
- extract `expected` / `actual` values from issue messages where applicable
- preserve all original `ValidationIssue` properties

### 3.11 Report Contract

`generateReport()` shall:

- return a `ValidationReport` with a UTC ISO timestamp
- include a `ReportSummary` with resource type, profile URL, validity, issue counts, step count, and duration
- group issues by severity, path, and step name

---

## 4. Behavioral Guarantees

### 4.1 Backward Compatibility

`v0.4.0` is an additive release.

The project guarantees:

- existing `v0.3.0` top-level exports remain available
- previously valid consumer code remains valid
- the pipeline is an optional enhancement; existing `StructureValidator` flows are unaffected
- provider integration from v0.3 is preserved and extended

### 4.2 Determinism

The runtime continues to guarantee deterministic behavior for:

- parsing
- snapshot generation
- structural validation
- pipeline validation (given same steps, options, and providers)
- `OperationOutcome` conversion
- report generation (except timestamp)

### 4.3 Dependency Policy

The package continues to ship with:

- zero runtime dependencies
- no required network access
- no bundled terminology server implementation

### 4.4 Separation of Responsibilities

The runtime engine is responsible for:

- structural FHIR processing
- profile-driven validation
- composable validation pipeline orchestration
- integration contracts
- developer-friendly validation output

Higher layers remain responsible for:

- persistence
- live terminology integration (implementing `TerminologyProvider`)
- REST routing
- authentication and authorization
- search and indexing

---

## 5. Testing & Quality Assurance (v0.4)

### 5.1 Test Coverage

| Category                    | Count      | Status      |
| --------------------------- | ---------- | ----------- |
| Total test files            | 65         | ✅ Passing  |
| Total test cases            | 2,995      | ✅ Passing  |
| Pipeline-focused new tests  | 110        | ✅ Passing  |
| JSON fixture tests (batch)  | 16         | ✅ Passing  |
| JSON fixture tests (enhance)| 18         | ✅ Passing  |
| Integration tests           | 17         | ✅ Passing  |
| HAPI snapshot fixtures      | 35/35      | ✅ Passing  |
| Module coverage             | 8 modules  | ✅ Complete |

### 5.2 Pipeline Verification

| Verification Item                                 | Result      |
| ------------------------------------------------- | ----------- |
| ValidationPipeline basic flow (5+ tests)          | ✅ Verified |
| ValidationPipeline failFast (5+ tests)            | ✅ Verified |
| ValidationPipeline minSeverity filter (5+ tests)  | ✅ Verified |
| StructuralValidationStep (5+ tests)               | ✅ Verified |
| TerminologyValidationStep (5+ tests)              | ✅ Verified |
| InvariantValidationStep (5+ tests)                | ✅ Verified |
| Hook system (5+ tests)                            | ✅ Verified |
| Batch validation (15+ JSON fixture tests)         | ✅ Verified |
| Enhanced error messages (15+ JSON fixture tests)  | ✅ Verified |
| Report generator (5+ tests)                       | ✅ Verified |
| End-to-end pipeline integration (15+ tests)       | ✅ Verified |
| Backward compatibility against v0.3 baseline      | ✅ Verified |

### 5.3 Existing Quality Baseline Retained

The release retains the previously established baseline for:

- US Core verification coverage
- HAPI-equivalent snapshot behavior
- stress testing categories
- no-throw structured result patterns
- provider abstraction contracts

---

## 6. Release Gate (v0.4.0)

| #   | Gate                                          | Verification                                           | Status |
| --- | --------------------------------------------- | ------------------------------------------------------ | ------ |
| 1   | `src/pipeline/` public module implemented     | Types, steps, pipeline, batch, report, hooks exported  | ✅     |
| 2   | ValidationPipeline class tested               | ≥5 unit tests per feature (flow, failFast, severity)   | ✅     |
| 3   | Built-in steps implemented and tested         | Structural, terminology, invariant — ≥5 tests each     | ✅     |
| 4   | Hook system implemented and tested            | ≥5 tests                                               | ✅     |
| 5   | Batch validation tested with JSON fixtures    | ≥15 JSON fixture tests                                 | ✅     |
| 6   | Enhanced messages tested with JSON fixtures   | ≥15 JSON fixture tests                                 | ✅     |
| 7   | Report generator tested                       | ≥5 tests                                               | ✅     |
| 8   | End-to-end pipeline integration tested        | ≥15 integration tests                                  | ✅     |
| 9   | Existing v0.3 baseline preserved              | Prior test suite still passing                         | ✅     |
| 10  | `tsc --noEmit` clean                          | Zero TypeScript errors                                 | ✅     |
| 11  | Release docs updated                          | API reference, capability contract, changelog, README  | ✅     |
| 12  | New API added to `src/index.ts` barrel export | 14 type exports + 8 value exports                      | ✅     |

---

## 7. Versioning & Compatibility Policy

- `v0.3.x` — provider abstraction surface
- `v0.4.0` — validation pipeline & DX enhancement release, additive only
- `v0.5.0` — IG package loading planned
- `v1.0.0` — API freeze target

All public exports documented in `docs/api/fhir-runtime-api-v0.4.md` are considered part of the `v0.4.0` public release contract.

---

## 8. Changes from v0.3.0

### 8.1 New Capabilities

- Added composable validation pipeline with pluggable step architecture
- Added three built-in validation steps (structural, terminology, invariant)
- Added lifecycle hook system for pipeline events
- Added batch validation for multiple resources
- Added enhanced error messages with suggestions and documentation links
- Added structured validation reports

### 8.2 Compatibility Impact

- No public removals
- No required migration for existing consumers
- New pipeline surface available for advanced validation workflows

### 8.3 Planned Follow-Up

The next planned capability expansion is `v0.5.0`, focused on:

- IG package loading (.tgz)
- NpmPackageLoader
- Dependency resolution
- Cross-package canonical resolution

---

For the authoritative public symbol inventory, see `docs/api/fhir-runtime-api-v0.4.md`.
