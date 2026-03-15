# fhir-runtime — Engine Capability Contract v0.8

> **Status:** Frozen for v0.8.0 Release  
> **FHIR Version:** R4 (4.0.1)  
> **Specification Date:** 2026-03-12  
> **Audience:** Node.js API consumers, CLI consumers, downstream server and persistence layers  
> **Reference Target:** HAPI FHIR R4 for structural equivalence where applicable

---

## 1. Scope

### 1.1 In-Scope (v0.8)

| #   | Capability                                              | Notes                                               |
| --- | ------------------------------------------------------- | --------------------------------------------------- |
| 1   | FHIR R4 JSON parsing and serialization                  | Unchanged from v0.7                                 |
| 2   | StructureDefinition registry and inheritance resolution | Unchanged from v0.7                                 |
| 3   | Snapshot generation                                     | Unchanged from v0.7                                 |
| 4   | Structural validation                                   | Unchanged from v0.7                                 |
| 5   | FHIRPath evaluation and invariant execution             | Unchanged from v0.7                                 |
| 6   | Bundle loading and core definition loading              | Unchanged from v0.7                                 |
| 7   | Provider Abstraction Layer (STAGE-1)                    | Unchanged from v0.7                                 |
| 8   | Default NoOp provider implementations                   | Unchanged from v0.7                                 |
| 9   | OperationOutcomeBuilder support                         | Unchanged from v0.7                                 |
| 10  | Optional validator provider hooks                       | Unchanged from v0.7                                 |
| 11  | Composable Validation Pipeline (STAGE-2)                | Unchanged from v0.7                                 |
| 12  | Built-in validation steps                               | Unchanged from v0.7                                 |
| 13  | Pipeline lifecycle hook system                          | Unchanged from v0.7                                 |
| 14  | Batch validation                                        | Unchanged from v0.7                                 |
| 15  | Enhanced error messages                                 | Unchanged from v0.7                                 |
| 16  | Structured validation reports                           | Unchanged from v0.7                                 |
| 17  | In-memory terminology provider (STAGE-3)                | Unchanged from v0.7                                 |
| 18  | Binding strength validation                             | Unchanged from v0.7                                 |
| 19  | CodeSystem and ValueSet registries                      | Unchanged from v0.7                                 |
| 20  | ValueSet membership evaluation                          | Unchanged from v0.7                                 |
| 21  | Bundle loading for terminology resources                | Unchanged from v0.7                                 |
| 22  | NPM-format IG package loading (STAGE-4)                 | Unchanged from v0.7                                 |
| 23  | Package manifest and index parsing                      | Unchanged from v0.7                                 |
| 24  | Package dependency resolution                           | Unchanged from v0.7                                 |
| 25  | Cross-package canonical URL resolution                  | Unchanged from v0.7                                 |
| 26  | PackageManager for multi-package workflows              | Unchanged from v0.7                                 |
| 27  | SearchParameter definition parsing (STAGE-5)            | Unchanged from v0.7                                 |
| 28  | SearchParameter batch parsing from Bundles              | Unchanged from v0.7                                 |
| 29  | FHIRPath-based search value extraction                  | Unchanged from v0.7                                 |
| 30  | Reference extraction from resources and Bundles         | Unchanged from v0.7                                 |
| 31  | Reference target type validation                        | Unchanged from v0.7                                 |
| 32  | CapabilityStatement REST fragment generation            | Unchanged from v0.7                                 |
| 33  | Resource type registry with FHIR R4 catalog             | Unchanged from v0.7                                 |
| 34  | DefinitionProvider interface (STAGE-6)                  | New in v0.8: from fhir-definition                   |
| 35  | DefinitionBridge adapter                                | New in v0.8: FhirContext → DefinitionProvider       |
| 36  | NoOpDefinitionProvider                                  | New in v0.8: default no-op implementation           |
| 37  | DefinitionProviderLoader                                | New in v0.8: DefinitionProvider → SD loader         |
| 38  | createRuntime() factory function                        | New in v0.8: one-step runtime creation              |
| 39  | FhirRuntimeInstance unified interface                   | New in v0.8: validate, getSearchParameters, extract |

### 1.2 Out-of-Scope (v0.8)

| #   | Excluded Capability                                          | Rationale                        |
| --- | ------------------------------------------------------------ | -------------------------------- |
| 1   | SQL generation / search index creation                       | Persistence-layer concern        |
| 2   | SearchParameter query execution                              | Persistence-layer concern        |
| 3   | Full CapabilityStatement resource generation                 | Server-layer concern             |
| 4   | REST routing / endpoint registration                         | Server-layer concern             |
| 5   | Remote terminology server calls                              | Server-layer concern             |
| 6   | .tgz package download from registry                          | CLI/server-layer concern         |
| 7   | ValueSet expansion (full)                                    | Future: fhir-terminology module  |
| 8   | Code validation against remote terminology servers           | Future: fhir-terminology module  |
| 9   | XML/RDF serialization                                        | Not planned                      |
| 10  | FHIR R5/R6 support                                           | Not planned for v0.x             |

---

## 2. Behavioral Guarantees

### 2.1 DefinitionProvider Contract (New in v0.8)

**Interface**: `DefinitionProvider` (from fhir-definition)

**Methods**:
- `getStructureDefinition(url: string): StructureDefinition | undefined`
- `getValueSet(url: string): ValueSet | undefined`
- `getCodeSystem(url: string): CodeSystem | undefined`
- `getSearchParameters(resourceType: string): SearchParameter[]`

**Guarantees**:
1. **No-throw contract**: All methods return `undefined` or empty arrays when resource not found. Never throws.
2. **Structural compatibility**: Types from fhir-definition are structurally compatible with fhir-runtime's rich types.
3. **Canonical URL lookup**: All lookups use canonical URLs (with optional `|version` suffix).
4. **Performance**: O(1) lookups for SD/VS/CS, O(n) for SP filtering by resource type.

### 2.2 createRuntime() Factory (New in v0.8)

**Signature**: `async function createRuntime(options?: RuntimeOptions): Promise<FhirRuntimeInstance>`

**Guarantees**:
1. **Three patterns supported**:
   - Pattern 1: With external DefinitionProvider (from fhir-definition)
   - Pattern 2: With FhirContext (legacy/standalone)
   - Pattern 3: Bare minimum (auto-creates everything)
2. **Default preloadCore**: `true` (loads R4 core definitions)
3. **Default providers**: NoOpTerminologyProvider, NoOpReferenceResolver
4. **Async initialization**: Returns Promise (allows async definition loading)

### 2.3 FhirRuntimeInstance Interface (New in v0.8)

**Methods**:
- `validate(resource: Resource, profileUrl: string): Promise<ValidationResult>`
- `getSearchParameters(resourceType: string): SearchParameter[]`
- `extractSearchValues(resource: Resource, searchParam: SearchParameter): SearchIndexEntry`

**Guarantees**:
1. **validate()**: Loads SD, generates snapshot if needed, builds CanonicalProfile, runs structural validation
2. **getSearchParameters()**: Delegates to DefinitionProvider
3. **extractSearchValues()**: Delegates to integration module's extractSearchValues()

---

## 3. Compatibility

### 3.1 Backward Compatibility

**v0.8.0 is fully backward compatible with v0.7.x.**

All existing APIs remain unchanged. New functionality is purely additive.

### 3.2 Dependency Change

- **v0.7.x**: Zero runtime dependencies
- **v0.8.0**: Single dependency: `fhir-definition@0.4.0`

This is an intentional architectural decision.

### 3.3 Migration Path

See [devdocs/migration/UPGRADE-TO-v0.8.0-CHECKLIST.md](../../devdocs/migration/UPGRADE-TO-v0.8.0-CHECKLIST.md)

---

## 4. Testing Requirements

### 4.1 Test Coverage (v0.8)

- **Total tests**: 4,153 (59 new)
- **Test files**: 106 (5 new)
- **New module tests**: 59 tests across 5 files
  - `noop-definition-provider.test.ts`: 7 tests
  - `definition-bridge.test.ts`: 15 tests
  - `definition-provider-loader.test.ts`: 6 tests
  - `create-runtime.test.ts`: 17 tests
  - `integration-e2e.test.ts`: 14 tests

### 4.2 Regression Testing

All 4,094 pre-existing tests pass without modification.

---

## 5. Performance Characteristics

### 5.1 DefinitionProvider Lookups

- **getStructureDefinition()**: O(1) — Map lookup
- **getValueSet()**: O(1) — Map lookup
- **getCodeSystem()**: O(1) — Map lookup
- **getSearchParameters()**: O(n) — filters pre-built index

### 5.2 createRuntime() Initialization

- **Pattern 1** (with DefinitionProvider): ~10ms + definition loading time
- **Pattern 2** (with FhirContext): ~5ms
- **Pattern 3** (bare minimum + preloadCore): ~200-500ms (loads 73 core SDs)

---

## 6. Error Handling

### 6.1 DefinitionProvider

All methods follow no-throw contract:
- Returns `undefined` for not found
- Returns empty array `[]` for no results
- Never throws exceptions

### 6.2 createRuntime()

May throw if:
- Invalid options provided
- FhirContext creation fails
- Core definition loading fails (when preloadCore=true)

### 6.3 FhirRuntimeInstance.validate()

May throw if:
- Profile URL not found
- Snapshot generation fails
- Invalid resource structure

---

## 7. Version History

| Version | Date       | Stage    | Key Additions                                    |
|---------|------------|----------|--------------------------------------------------|
| v0.3.0  | 2025-xx-xx | STAGE-1  | Provider Abstraction Layer                       |
| v0.4.0  | 2025-xx-xx | STAGE-2  | Validation Pipeline                              |
| v0.5.0  | 2025-xx-xx | STAGE-3  | Terminology Binding                              |
| v0.6.0  | 2025-xx-xx | STAGE-4  | IG Package Loading                               |
| v0.7.0  | 2026-03-10 | STAGE-5  | Server/Persistence Integration                   |
| v0.8.0  | 2026-03-12 | STAGE-6  | fhir-definition Integration                      |

---

**Last Updated:** 2026-03-12  
**Status:** Frozen  
**Next Review:** v0.9.0 or v1.0.0
