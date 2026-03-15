# fhir-runtime — Engine Capability Contract v0.7

> **Status:** Frozen for v0.7.0 Release  
> **FHIR Version:** R4 (4.0.1)  
> **Specification Date:** 2026-03-10  
> **Audience:** Node.js API consumers, CLI consumers, downstream server and persistence layers  
> **Reference Target:** HAPI FHIR R4 for structural equivalence where applicable

---

## 1. Scope

### 1.1 In-Scope (v0.7)

| #   | Capability                                              | Notes                                               |
| --- | ------------------------------------------------------- | --------------------------------------------------- |
| 1   | FHIR R4 JSON parsing and serialization                  | Unchanged from v0.6                                 |
| 2   | StructureDefinition registry and inheritance resolution | Unchanged from v0.6                                 |
| 3   | Snapshot generation                                     | Unchanged from v0.6                                 |
| 4   | Structural validation                                   | Unchanged from v0.6                                 |
| 5   | FHIRPath evaluation and invariant execution             | Unchanged from v0.6                                 |
| 6   | Bundle loading and core definition loading              | Unchanged from v0.6                                 |
| 7   | Provider Abstraction Layer (STAGE-1)                    | Unchanged from v0.6                                 |
| 8   | Default NoOp provider implementations                   | Unchanged from v0.6                                 |
| 9   | OperationOutcomeBuilder support                         | Unchanged from v0.6                                 |
| 10  | Optional validator provider hooks                       | Unchanged from v0.6                                 |
| 11  | Composable Validation Pipeline (STAGE-2)                | Unchanged from v0.6                                 |
| 12  | Built-in validation steps                               | Unchanged from v0.6                                 |
| 13  | Pipeline lifecycle hook system                          | Unchanged from v0.6                                 |
| 14  | Batch validation                                        | Unchanged from v0.6                                 |
| 15  | Enhanced error messages                                 | Unchanged from v0.6                                 |
| 16  | Structured validation reports                           | Unchanged from v0.6                                 |
| 17  | In-memory terminology provider (STAGE-3)                | Unchanged from v0.6                                 |
| 18  | Binding strength validation                             | Unchanged from v0.6                                 |
| 19  | CodeSystem and ValueSet registries                      | Unchanged from v0.6                                 |
| 20  | ValueSet membership evaluation                          | Unchanged from v0.6                                 |
| 21  | Bundle loading for terminology resources                | Unchanged from v0.6                                 |
| 22  | NPM-format IG package loading (STAGE-4)                 | Unchanged from v0.6                                 |
| 23  | Package manifest and index parsing                      | Unchanged from v0.6                                 |
| 24  | Package dependency resolution                           | Unchanged from v0.6                                 |
| 25  | Cross-package canonical URL resolution                  | Unchanged from v0.6                                 |
| 26  | PackageManager for multi-package workflows              | Unchanged from v0.6                                 |
| 27  | SearchParameter definition parsing (STAGE-5)            | New in v0.7: parseSearchParameter()                 |
| 28  | SearchParameter batch parsing from Bundles              | New in v0.7: parseSearchParametersFromBundle()      |
| 29  | FHIRPath-based search value extraction                  | New in v0.7: extractSearchValues()                  |
| 30  | Reference extraction from resources and Bundles         | New in v0.7: extractReferences()                    |
| 31  | Reference target type validation                        | New in v0.7: validateReferenceTargets()             |
| 32  | CapabilityStatement REST fragment generation            | New in v0.7: buildCapabilityFragment()              |
| 33  | Resource type registry with FHIR R4 catalog             | New in v0.7: ResourceTypeRegistry                   |

### 1.2 Out-of-Scope (v0.7)

| #   | Excluded Capability                                          | Rationale                        |
| --- | ------------------------------------------------------------ | -------------------------------- |
| 1   | SQL generation / search index creation                       | Persistence-layer concern        |
| 2   | SearchParameter query execution                              | Persistence-layer concern        |
| 3   | Full CapabilityStatement resource generation                 | Server-layer concern             |
| 4   | REST routing / endpoint registration                         | Server-layer concern             |
| 5   | Remote terminology server calls                              | Server-layer concern             |
| 6   | .tgz package download from registry                          | CLI/server-layer concern         |
| 7   | Version range matching in dependencies                       | Exact match sufficient           |
| 8   | XML / RDF serialization                                      | JSON-focused runtime             |
| 9   | FHIR R5 / R6 support                                         | Future version target            |

---

## 2. Architecture Overview

### 2.1 Module Dependency Shape (v0.7)

```
model ← parser ← context ← profile ← validator ← fhirpath
                     ↑                    ↑
                  package             provider
                                         ↑
                                     terminology
                                         ↑
                                      pipeline

integration → model, parser, context, fhirpath (NEW in v0.7)
```

### 2.2 Module Count

| Version | Modules | Exports | Tests | Test Files |
|---------|---------|---------|-------|------------|
| v0.3.0  | 7       | 227     | 2,885 | 56         |
| v0.4.0  | 8       | 249     | 2,995 | 65         |
| v0.5.0  | 9       | ~270    | 3,128 | 75         |
| v0.6.0  | 10      | ~296    | 3,266 | 82         |
| v0.7.0  | 11      | ~280+   | 3,376 | 88         |

---

## 3. Integration Module Guarantees (v0.7)

### 3.1 SearchParameter Parsing

- **G-27**: `parseSearchParameter(json)` accepts any `unknown` input and returns `ParseResult<SearchParameter>`
- **G-27a**: All 9 search parameter types are recognized: number, date, string, token, reference, composite, quantity, uri, special
- **G-27b**: Required fields validated: url, name, status, code, base, type
- **G-27c**: Invalid input returns `ParseResult` with `success: false` and descriptive issues

### 3.2 Search Value Extraction

- **G-29**: `extractSearchValues(resource, searchParam)` returns `SearchIndexEntry` with extracted values
- **G-29a**: FHIRPath expressions are evaluated via existing `evalFhirPath()` engine
- **G-29b**: Non-matching resource types (base mismatch) return empty values array
- **G-29c**: Invalid FHIRPath expressions do not throw — return empty values array
- **G-29d**: All 7 extractable types supported: string, token, reference, date, number, quantity, uri

### 3.3 Reference Extraction

- **G-30**: `extractReferences(resource)` walks the entire resource tree and returns all Reference elements
- **G-30a**: Four reference types classified: literal, logical, contained, absolute
- **G-30b**: `targetType` and `targetId` extracted where inferrable from reference value
- **G-30c**: `extractReferencesFromBundle(bundle)` handles null/undefined input gracefully

### 3.4 CapabilityStatement Builder

- **G-32**: `buildCapabilityFragment(profiles, searchParams?, mode?)` generates valid REST fragment
- **G-32a**: Profiles grouped by resource type; constraint profiles listed as `supportedProfile`
- **G-32b**: Search parameters deduplicated by code
- **G-32c**: Resources and search params sorted alphabetically

### 3.5 Resource Type Registry

- **G-33**: `ResourceTypeRegistry` provides O(1) lookup by type name
- **G-33a**: `FHIR_R4_RESOURCE_TYPES` contains all 148 FHIR R4 resource types
- **G-33b**: `getConcreteTypes()` filters out abstract types (Resource, DomainResource)

---

## 4. Backward Compatibility

- All v0.6.0 exports remain available and unchanged
- No existing function signatures modified
- No existing types narrowed or widened
- All 3,266 v0.6.0 tests pass without modification
- Zero runtime dependencies (unchanged)
- Node.js >=18.0.0 (unchanged)

---

## 5. Testing Contract

| Category                   | Count   | Status |
|---------------------------|---------|--------|
| Total tests               | 3,376   | ✅     |
| Total test files          | 88      | ✅     |
| HAPI snapshot fixtures    | 35/35   | ✅     |
| US Core SDs verified      | 70      | ✅     |
| Integration module tests  | 110     | ✅     |
| tsc --noEmit              | 0 errors| ✅     |
| Pass rate                 | 100%    | ✅     |

---

## 6. v1.0 Readiness

All 5 STAGE plans are now complete. The following items remain for v1.0 API freeze:

- [ ] Comprehensive API stability audit
- [ ] Full export inventory review
- [ ] Type signature consistency audit
- [ ] Error contract uniformity review
- [ ] Deprecation assessment
- [ ] v1.0 API reference documentation
- [ ] Migration guide (v0.2 → v1.0)
- [ ] npm publish dry-run
- [ ] v1.0-rc release with ≥1 week testing period
