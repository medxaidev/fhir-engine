# fhir-runtime — Engine Capability Contract v0.5

> **Status:** Frozen for v0.5.0 Release  
> **FHIR Version:** R4 (4.0.1)  
> **Specification Date:** 2026-03-09  
> **Audience:** Node.js API consumers, CLI consumers, downstream server and persistence layers  
> **Reference Target:** HAPI FHIR R4 for structural equivalence where applicable

---

## 1. Scope

### 1.1 In-Scope (v0.5)

| #   | Capability                                              | Notes                                               |
| --- | ------------------------------------------------------- | --------------------------------------------------- |
| 1   | FHIR R4 JSON parsing and serialization                  | Unchanged from v0.4                                 |
| 2   | StructureDefinition registry and inheritance resolution | Unchanged from v0.4                                 |
| 3   | Snapshot generation                                     | Unchanged from v0.4                                 |
| 4   | Structural validation                                   | Unchanged from v0.4                                 |
| 5   | FHIRPath evaluation and invariant execution             | Unchanged from v0.4                                 |
| 6   | Bundle loading and core definition loading              | Unchanged from v0.4                                 |
| 7   | Provider Abstraction Layer (STAGE-1)                    | Unchanged from v0.4                                 |
| 8   | Default NoOp provider implementations                   | Unchanged from v0.4                                 |
| 9   | OperationOutcomeBuilder support                         | Unchanged from v0.4                                 |
| 10  | Optional validator provider hooks                       | Unchanged from v0.4                                 |
| 11  | Composable Validation Pipeline (STAGE-2)                | Unchanged from v0.4                                 |
| 12  | Built-in validation steps                               | Unchanged from v0.4                                 |
| 13  | Pipeline lifecycle hook system                          | Unchanged from v0.4                                 |
| 14  | Batch validation                                        | Unchanged from v0.4                                 |
| 15  | Enhanced error messages                                 | Unchanged from v0.4                                 |
| 16  | Structured validation reports                           | Unchanged from v0.4                                 |
| 17  | In-memory terminology provider (STAGE-3)                | New in v0.5: InMemoryTerminologyProvider            |
| 18  | Binding strength validation                             | New in v0.5: required/extensible/preferred/example  |
| 19  | CodeSystem and ValueSet registries                      | New in v0.5: in-memory terminology storage          |
| 20  | ValueSet membership evaluation                          | New in v0.5: expansion, compose, hierarchical filters |
| 21  | Bundle loading for terminology resources                | New in v0.5: CodeSystem/ValueSet from bundles       |

### 1.2 Out-of-Scope (v0.5)

| #   | Excluded Capability                                          | Rationale                        |
| --- | ------------------------------------------------------------ | -------------------------------- |
| 1   | IG package loading and dependency resolution                 | Planned for `STAGE-4 (v0.6.0)`  |
| 2   | NpmPackageLoader for .tgz packages                           | Planned for `STAGE-4 (v0.6.0)`  |
| 3   | Cross-package canonical resolution                           | Planned for `STAGE-4 (v0.6.0)`  |
| 4   | Remote terminology server calls                              | Server-layer concern             |
| 5   | Full $expand operation semantics                             | Partial expansion supported      |
| 6   | Large CodeSystem optimization (SNOMED CT / LOINC)            | InMemory not suitable for 300k+ concepts |
| 7   | SearchParameter indexing                                     | Persistence-layer concern        |
| 8   | REST FHIR server                                             | Server-layer concern             |
| 9   | Persistence-backed reference resolution                      | Higher-layer concern             |
| 10  | XML / RDF serialization                                      | JSON-focused runtime             |
| 11  | FHIR R5 / R6 support                                         | Future version target            |

---

## 2. Architecture Overview

### 2.1 Module Dependency Shape (v0.5)

```
model ← parser ← context ← profile ← validator ← fhirpath
                                         ↑
                                      provider
                                         ↑
                                     terminology (NEW)
                                         ↑
                                      pipeline
```

### 2.2 Module Count

| Version | Modules | Exports | Tests | Test Files |
|---------|---------|---------|-------|------------|
| v0.2.0  | 6       | 211     | 2,400+| 45         |
| v0.3.0  | 7       | 227     | 2,885 | 56         |
| v0.4.0  | 8       | 249     | 2,995 | 65         |
| v0.5.0  | 9       | ~270    | 3,128 | 75         |

---

## 3. Terminology Capability Contract (v0.5)

### 3.1 InMemoryTerminologyProvider

**Contract:**

- `validateCode(params)` → validates a code against a CodeSystem or ValueSet stored in memory
- `expandValueSet(params)` → expands a ValueSet from expansion or compose, with filter and pagination
- `lookupCode(params)` → looks up a code in a registered CodeSystem

**Registration:**

- `registerCodeSystem(cs)` — stores a `CodeSystemDefinition` by URL
- `registerValueSet(vs)` — stores a `ValueSetDefinition` by URL
- `loadFromBundle(bundle)` — scans a FHIR Bundle for CodeSystem/ValueSet entries

**Guarantees:**

- Replacing a registration with the same URL overwrites the previous one
- `validateCode` with unknown `valueSetUrl` returns `{ result: false }`
- `validateCode` with empty system searches across all systems in the ValueSet
- `expandValueSet` returns `{ contains: [] }` for unknown ValueSets
- `lookupCode` returns `{ found: false }` for unknown codes/systems

### 3.2 Binding Strength Validation

**Contract:**

| Strength | Code Not in VS (with provider) | No Provider Available |
|----------|-------------------------------|----------------------|
| `required` | `{ valid: false, severity: 'error' }` | `{ valid: false, severity: 'warning' }` |
| `extensible` | `{ valid: false, severity: 'warning' }` | `{ valid: true, severity: 'information' }` |
| `preferred` | `{ valid: false, severity: 'information' }` | `{ valid: true }` (skip) |
| `example` | skip (always valid) | skip (always valid) |

**Guarantees:**

- `example` bindings never produce validation issues
- `null` / `undefined` values always return valid (nothing to validate)
- CodeableConcept with `required` binding: at least one coding must be valid
- Provider errors produce `{ valid: false, severity: 'warning' }` with error message

### 3.3 ValueSet Membership

**Contract:**

1. Expansion takes precedence over compose when both exist
2. Compose include with explicit concepts → enumeration match only
3. Compose include with filter → filter evaluation against CodeSystem hierarchy
4. Compose include with system only → entire CodeSystem included (verified against registry when available)
5. Compose exclude → removes matched codes from include results

**Supported filter operations:** `=`, `is-a`, `is-not-a`, `in`, `not-in`, `regex`, `exists`

### 3.4 CodeSystem Registry

**Contract:**

- Hierarchical concept lookup: `findConcept` traverses `children` recursively
- `isDescendantOf(system, descendant, ancestor)` checks the hierarchy under `ancestor`
- `allCodes(system)` returns flat list of all codes (depth-first)

---

## 4. Behavioral Guarantees

### 4.1 Backward Compatibility

All v0.4.0 public API symbols remain available and unchanged. No breaking changes.

### 4.2 Determinism

- `InMemoryTerminologyProvider` operations are deterministic given the same registered data
- ValueSet membership evaluation is deterministic
- Binding validation results are deterministic

### 4.3 Dependency Policy

- `terminology` module depends only on `model` and `provider`
- `terminology` does NOT depend on `context`, `profile`, `validator`, `fhirpath`, `pipeline`, or `package`
- Zero runtime dependencies (unchanged)

### 4.4 Separation of Responsibilities

- Remote terminology server calls belong to the server layer, not this module
- Large CodeSystem management (SNOMED, LOINC) should use server-backed providers
- `InMemoryTerminologyProvider` is designed for testing, small/embedded ValueSets, and offline validation

---

## 5. Testing and Quality Assurance

### 5.1 Test Coverage (v0.5)

| Category | Tests |
|----------|-------|
| Binding strength (4 levels × 6) | 24 |
| CodeSystem registry | 13 |
| ValueSet registry | 7 |
| ValueSet membership | 21 |
| Binding validator | 21 |
| InMemoryTerminologyProvider | 30 |
| Integration (end-to-end) | 17 |
| **STAGE-3 subtotal** | **133** |
| v0.4.0 regression | 2,995 |
| **Grand total** | **3,128** |

### 5.2 Fixture Coverage

- 3 CodeSystem fixtures (flat, hierarchical, multi-concept)
- 5 ValueSet fixtures (compose, expansion, enumerated, exclude, whole-system)
- All tests use JSON fixtures loaded at test time

---

## 6. Release Gates (v0.5)

- [x] All STAGE-3 exit criteria met
- [x] `tsc --noEmit` zero errors
- [x] 3,128 tests pass across 75 test files
- [x] All v0.4.0 tests 100% pass (backward compatibility)
- [x] New exports added to `src/index.ts` barrel
- [x] CHANGELOG updated
- [x] Documentation generated

---

## 7. Changes from v0.4

| Area | Change |
|------|--------|
| New module | `src/terminology/` (7 source files) |
| New type exports | 11 types added |
| New value exports | 10 values added |
| Tests added | 133 new tests |
| Test files added | 10 new test files |
| JSON fixtures added | 8 fixture files |
| Out-of-scope updated | Terminology binding moved to in-scope |
| Next milestone | STAGE-4: IG Package & Canonical Resolution (v0.6.0) |
