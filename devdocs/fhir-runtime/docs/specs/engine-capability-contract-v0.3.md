# fhir-runtime — Engine Capability Contract v0.3

> **Status:** Frozen for v0.3.0 Release  
> **FHIR Version:** R4 (4.0.1)  
> **Specification Date:** 2026-03-07  
> **Audience:** Node.js API consumers, CLI consumers, downstream server and persistence layers  
> **Reference Target:** HAPI FHIR R4 for structural equivalence where applicable

---

## 1. Scope

### 1.1 In-Scope (v0.3)

| #   | Capability                                              | Notes                                             |
| --- | ------------------------------------------------------- | ------------------------------------------------- |
| 1   | FHIR R4 JSON parsing and serialization                  | Unchanged from v0.2                               |
| 2   | StructureDefinition registry and inheritance resolution | Unchanged from v0.2                               |
| 3   | Snapshot generation                                     | Unchanged from v0.2                               |
| 4   | Structural validation                                   | Unchanged from v0.2 core behavior                 |
| 5   | FHIRPath evaluation and invariant execution             | Unchanged from v0.2                               |
| 6   | Bundle loading and core definition loading              | Unchanged from v0.2                               |
| 7   | Provider Abstraction Layer (STAGE-1)                    | New in v0.3: terminology and reference interfaces |
| 8   | Default NoOp provider implementations                   | New in v0.3                                       |
| 9   | OperationOutcomeBuilder support                         | New in v0.3                                       |
| 10  | Optional validator provider hooks                       | New in v0.3                                       |

### 1.2 Out-of-Scope (v0.3)

| #   | Excluded Capability                                          | Rationale                      |
| --- | ------------------------------------------------------------ | ------------------------------ |
| 1   | Real terminology provider implementation                     | External system concern        |
| 2   | Actual terminology validation / binding strength enforcement | Planned for `STAGE-2 (v0.4.0)` |
| 3   | Persistence-backed reference resolution                      | Higher-layer concern           |
| 4   | SearchParameter indexing                                     | Persistence-layer concern      |
| 5   | REST FHIR server                                             | Server-layer concern           |
| 6   | IG package dependency resolution                             | Planned for later stages       |
| 7   | XML / RDF serialization                                      | JSON-focused runtime           |
| 8   | FHIR R5 / R6 support                                         | Future version target          |

---

## 2. Architecture Overview

### 2.1 Module Dependency Shape

```text
model ← parser ← context ← profile ← validator
                                  ↑
                              fhirpath

provider → model (types only)
validator → provider (optional integration)
```

### 2.2 Runtime Positioning

`fhir-runtime` remains a **runtime engine**, not a complete FHIR server.

In `v0.3.0`, the project now also provides the integration contracts required for higher-level systems to begin implementation without forcing terminology or persistence behavior into the core runtime.

### 2.3 Core Result Objects

The following result objects remain part of the public contract:

- `ParseResult<T>`
- `SnapshotResult`
- `ValidationResult`

New in `v0.3.0`:

- `OperationOutcome`
- `OperationOutcomeIssue`
- `OperationOutcomeIssueType`

---

## 3. Capability Contracts

### 3.1 Parsing Contract

`fhir-runtime` shall:

- parse valid FHIR R4 JSON into typed runtime structures
- return structured parse issues instead of requiring exception-based control flow
- preserve deterministic parse issue semantics

`fhir-runtime` shall not:

- perform terminology lookups during parsing
- require external services for parse operations

### 3.2 Snapshot Contract

`fhir-runtime` shall:

- generate snapshots from differential profiles using the existing profile pipeline
- preserve structural compatibility with the established v0.2 behavior
- report snapshot issues through structured result objects

`fhir-runtime` may additionally:

- convert snapshot results into FHIR `OperationOutcome` resources through `buildOperationOutcomeFromSnapshot()`

### 3.3 Validation Contract

`fhir-runtime` shall:

- validate resources structurally against canonical profiles
- preserve existing v0.2 structural validation behavior when no providers are supplied
- expose issues via `ValidationResult`

In `v0.3.0`, `ValidationOptions` may include:

- `terminologyProvider`
- `referenceResolver`

If providers are omitted:

- validation remains operational
- provider-based checks are skipped or reduced to non-breaking fallback behavior

### 3.4 Provider Abstraction Contract

The runtime now guarantees stable public interfaces for the Provider Abstraction Layer:

- `TerminologyProvider`
- `ReferenceResolver`

These interfaces are intentionally:

- async
- side-effect-agnostic
- transport-agnostic
- suitable for remote or local implementations

The runtime does **not** guarantee that any concrete external terminology or reference system is bundled.

### 3.5 NoOp Provider Contract

`NoOpTerminologyProvider` guarantees:

- `validateCode()` resolves to `{ result: true }`
- `expandValueSet()` resolves to `{ contains: [] }`
- `lookupCode()` resolves to `{ found: false }`

`NoOpReferenceResolver` guarantees:

- `resolve()` resolves to `undefined`
- `exists()` resolves to `true`

These defaults exist to keep the runtime usable in standalone mode and to unblock downstream integration work.

### 3.6 OperationOutcome Contract

The runtime now guarantees `OperationOutcomeBuilder` helpers for converting internal engine result types to FHIR R4 `OperationOutcome` resources:

- `buildOperationOutcome(result: ValidationResult)`
- `buildOperationOutcomeFromParse(result: ParseResult<unknown>)`
- `buildOperationOutcomeFromSnapshot(result: SnapshotResult)`

These helpers shall:

- always return `resourceType: 'OperationOutcome'`
- map engine issues to `OperationOutcome.issue[]`
- produce an informational success issue when no issues exist in the source result

---

## 4. Behavioral Guarantees

### 4.1 Backward Compatibility

`v0.3.0` is an additive release.

The project guarantees:

- existing `v0.2.0` top-level exports remain available
- previously valid consumer code remains valid unless it depended on undocumented internals
- provider integration points are optional and therefore backward compatible

### 4.2 Determinism

The runtime continues to guarantee deterministic behavior for:

- parsing
- snapshot generation
- structural validation
- `OperationOutcome` conversion from deterministic source results

### 4.3 Dependency Policy

The package continues to ship with:

- zero runtime dependencies
- no required network access
- no bundled terminology server implementation

### 4.4 Separation of Responsibilities

The runtime engine is responsible for:

- structural FHIR processing
- profile-driven validation
- integration contracts
- translation of engine results to FHIR-native outcome resources

Higher layers remain responsible for:

- persistence
- live terminology integration
- REST routing
- authentication and authorization
- search and indexing

---

## 5. Testing & Quality Assurance (v0.3)

### 5.1 Test Coverage

| Category                   | Count     | Status      |
| -------------------------- | --------- | ----------- |
| Total test files           | 51        | ✅ Passing  |
| Total test cases           | 2,847     | ✅ Passing  |
| Provider-focused new tests | 97        | ✅ Passing  |
| HAPI snapshot fixtures     | 35/35     | ✅ Passing  |
| Module coverage            | 7 modules | ✅ Complete |

### 5.2 Provider Abstraction Verification

| Verification Item                             | Result      |
| --------------------------------------------- | ----------- |
| Terminology provider interface contract       | ✅ Verified |
| Reference resolver interface contract         | ✅ Verified |
| NoOp terminology provider behavior            | ✅ Verified |
| NoOp reference resolver behavior              | ✅ Verified |
| OperationOutcomeBuilder conversions           | ✅ Verified |
| Validator provider integration                | ✅ Verified |
| Backward compatibility against prior baseline | ✅ Verified |

### 5.3 Existing Quality Baseline Retained

The release retains the previously established baseline for:

- US Core verification coverage
- HAPI-equivalent snapshot behavior
- stress testing categories
- no-throw structured result patterns

---

## 6. Release Gate (v0.3.0)

The following release conditions define `v0.3.0` readiness:

| #   | Gate                                         | Verification                                          | Status |
| --- | -------------------------------------------- | ----------------------------------------------------- | ------ |
| 1   | `src/provider/` public module implemented    | Types, NoOp providers, builders exported              | ✅     |
| 2   | Provider interfaces documented and tested    | Interface contract tests passing                      | ✅     |
| 3   | NoOp implementations tested                  | Behavior verified                                     | ✅     |
| 4   | OperationOutcomeBuilder conversions verified | Validation, parse, snapshot conversions pass          | ✅     |
| 5   | Validator provider hooks integrated          | Optional provider fields accepted                     | ✅     |
| 6   | Existing baseline preserved                  | Prior test suite still passing                        | ✅     |
| 7   | `tsc --noEmit` clean                         | Zero TypeScript errors                                | ✅     |
| 8   | Release docs updated                         | API reference, capability contract, changelog, README | ✅     |

---

## 7. Versioning & Compatibility Policy

- `v0.2.x` — bug fixes and stabilization around the pre-provider surface
- `v0.3.0` — provider abstraction release, additive only
- `v0.4.0` — terminology binding validation planned
- `v1.0.0` — API freeze target

All public exports documented in `docs/api/fhir-runtime-api-v0.3.md` are considered part of the `v0.3.0` public release contract.

---

## 8. Changes from v0.2.0

### 8.1 New Capabilities

- Added Provider Abstraction Layer interfaces
- Added NoOp provider implementations
- Added OperationOutcomeBuilder support
- Added optional validator provider integration points

### 8.2 Compatibility Impact

- No public removals
- No required migration for existing consumers
- New integration surface available for downstream `fhir-server` work

### 8.3 Planned Follow-Up

The next planned capability expansion is `v0.4.0`, focused on:

- binding strength validation
- in-memory terminology provider behavior
- CodeSystem / ValueSet registries
- inline ValueSet membership checks

---

For the authoritative public symbol inventory, see `docs/api/fhir-runtime-api-v0.3.md`.
