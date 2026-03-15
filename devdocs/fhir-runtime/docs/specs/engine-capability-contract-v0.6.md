# fhir-runtime — Engine Capability Contract v0.6

> **Status:** Frozen for v0.6.0 Release  
> **FHIR Version:** R4 (4.0.1)  
> **Specification Date:** 2026-03-09  
> **Audience:** Node.js API consumers, CLI consumers, downstream server and persistence layers  
> **Reference Target:** HAPI FHIR R4 for structural equivalence where applicable

---

## 1. Scope

### 1.1 In-Scope (v0.6)

| #   | Capability                                              | Notes                                               |
| --- | ------------------------------------------------------- | --------------------------------------------------- |
| 1   | FHIR R4 JSON parsing and serialization                  | Unchanged from v0.5                                 |
| 2   | StructureDefinition registry and inheritance resolution | Unchanged from v0.5                                 |
| 3   | Snapshot generation                                     | Unchanged from v0.5                                 |
| 4   | Structural validation                                   | Unchanged from v0.5                                 |
| 5   | FHIRPath evaluation and invariant execution             | Unchanged from v0.5                                 |
| 6   | Bundle loading and core definition loading              | Unchanged from v0.5                                 |
| 7   | Provider Abstraction Layer (STAGE-1)                    | Unchanged from v0.5                                 |
| 8   | Default NoOp provider implementations                   | Unchanged from v0.5                                 |
| 9   | OperationOutcomeBuilder support                         | Unchanged from v0.5                                 |
| 10  | Optional validator provider hooks                       | Unchanged from v0.5                                 |
| 11  | Composable Validation Pipeline (STAGE-2)                | Unchanged from v0.5                                 |
| 12  | Built-in validation steps                               | Unchanged from v0.5                                 |
| 13  | Pipeline lifecycle hook system                          | Unchanged from v0.5                                 |
| 14  | Batch validation                                        | Unchanged from v0.5                                 |
| 15  | Enhanced error messages                                 | Unchanged from v0.5                                 |
| 16  | Structured validation reports                           | Unchanged from v0.5                                 |
| 17  | In-memory terminology provider (STAGE-3)                | Unchanged from v0.5                                 |
| 18  | Binding strength validation                             | Unchanged from v0.5                                 |
| 19  | CodeSystem and ValueSet registries                      | Unchanged from v0.5                                 |
| 20  | ValueSet membership evaluation                          | Unchanged from v0.5                                 |
| 21  | Bundle loading for terminology resources                | Unchanged from v0.5                                 |
| 22  | NPM-format IG package loading (STAGE-4)                 | New in v0.6: NpmPackageLoader                       |
| 23  | Package manifest and index parsing                      | New in v0.6: package.json + .index.json             |
| 24  | Package dependency resolution                           | New in v0.6: topological sort, cycle detection      |
| 25  | Cross-package canonical URL resolution                  | New in v0.6: version-aware resolution               |
| 26  | PackageManager for multi-package workflows              | New in v0.6: register, discover, resolve            |

### 1.2 Out-of-Scope (v0.6)

| #   | Excluded Capability                                          | Rationale                        |
| --- | ------------------------------------------------------------ | -------------------------------- |
| 1   | .tgz package download from registry                          | CLI/server-layer concern         |
| 2   | FHIR Package Registry client (remote queries)                | CLI/server-layer concern         |
| 3   | Version range matching in dependencies                       | Exact match sufficient for v0.6  |
| 4   | Browser-native package loading                               | Requires fs abstraction          |
| 5   | Remote terminology server calls                              | Server-layer concern             |
| 6   | SearchParameter indexing                                     | Persistence-layer concern        |
| 7   | REST FHIR server                                             | Server-layer concern             |
| 8   | XML / RDF serialization                                      | JSON-focused runtime             |
| 9   | FHIR R5 / R6 support                                         | Future version target            |

---

## 2. Architecture Overview

### 2.1 Module Dependency Shape (v0.6)

```
model ← parser ← context ← profile ← validator ← fhirpath
                     ↑                    ↑
                  package (NEW)        provider
                                         ↑
                                     terminology
                                         ↑
                                      pipeline
```

### 2.2 Module Count

| Version | Modules | Exports | Tests | Test Files |
|---------|---------|---------|-------|------------|
| v0.3.0  | 7       | 227     | 2,885 | 56         |
| v0.4.0  | 8       | 249     | 2,995 | 65         |
| v0.5.0  | 9       | ~270    | 3,128 | 75         |
| v0.6.0  | 10      | ~296    | 3,266 | 82         |

---

## 3. Package Capability Contract (v0.6)

### 3.1 NpmPackageLoader

**Contract:**

- Implements `StructureDefinitionLoader` for CompositeLoader integration
- `load(url)` returns `StructureDefinition | null` for SD URLs, `null` for non-SD or unknown URLs
- `canLoad(url)` returns `true` only for StructureDefinition entries
- Initialization is lazy — performed on first access
- `.index.json` is used when available and `useIndex !== false`
- When no `.index.json`, falls back to filesystem directory scan
- `resourceTypes` filter restricts which resource types are indexed

**Guarantees:**

- Non-existent package path → graceful `undefined` manifest, 0 resources
- Malformed JSON files → silently skipped, do not throw
- `getSourceType()` always returns `'npm-package'`

### 3.2 PackageManager

**Contract:**

- `registerPackage(path)` throws if no valid `package.json` found
- `createLoader()` throws if no packages registered
- `resolveCanonical(url)` returns first match in loader order
- `discoverPackages(path)` scans subdirectories for package.json files
- `resolveDependencies(name)` builds graph from registered packages only

### 3.3 Dependency Resolution

**Contract:**

- Topological sort guarantees: dependencies before dependents
- `CircularPackageDependencyError` thrown with cycle path on circular dependencies
- Missing dependencies (declared but not registered) are recorded but don't prevent graph construction

### 3.4 Canonical Resolution

**Contract:**

- `url|version` format: pipe separates URL and version
- Resolution priority: exact version match → first match in loader order
- `resolveAllByType()` deduplicates by URL across loaders

---

## 4. Testing and Quality Assurance

### 4.1 Test Coverage (v0.6)

| Category | Tests |
|----------|-------|
| Package manifest parser | 13 |
| Package index parser | 14 |
| NpmPackageLoader | 32 |
| Dependency resolver | 15 |
| Canonical resolver | 22 |
| PackageManager | 17 |
| Integration (mock + US Core) | 25 |
| **STAGE-4 subtotal** | **138** |
| v0.5.0 regression | 3,128 |
| **Grand total** | **3,266** |

### 4.2 Fixture Coverage

- 3 mock IG packages (test-ig with .index.json, dep-ig with dependencies, no-index-ig without index)
- 11 JSON resource fixture files across mock packages
- Real US Core v9.0.0 package (214 files) for integration testing

---

## 5. Release Gates (v0.6)

- [x] All STAGE-4 exit criteria met
- [x] `tsc --noEmit` zero errors
- [x] 3,266 tests pass across 82 test files
- [x] All v0.5.0 tests 100% pass (backward compatibility)
- [x] New exports added to `src/index.ts` barrel
- [x] CHANGELOG updated
- [x] Documentation generated

---

## 6. Changes from v0.5

| Area | Change |
|------|--------|
| New module | `src/package/` (7 source files) |
| New type exports | 10 types added |
| New value exports | 16 values added |
| Tests added | 138 new tests |
| Test files added | 7 new test files |
| JSON fixtures added | 11 resource fixture files + 3 package.json + 2 .index.json |
| Out-of-scope updated | IG package loading moved to in-scope |
| Next milestone | STAGE-5: Integration & API Freeze (v1.0) |
