# fhir-runtime — Engine Capability Contract v0.2

> **Status:** Frozen for v0.2.0 Release  
> **FHIR Version:** R4 (4.0.1)  
> **Specification Date:** 2026-03-04  
> **Audience:** CLI consumers, Node.js API consumers, downstream server/client layers  
> **Reference Implementation:** HAPI FHIR R4 (structural equivalence target)

---

## 1. Scope

### 1.1 In-Scope (v0.2)

| #   | Capability                                                | HAPI Equivalent                                              |
| --- | --------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | FHIR R4 JSON parsing & serialization                      | `FhirContext.newJsonParser()`                                |
| 2   | StructureDefinition registry with inheritance resolution  | `DefaultProfileValidationSupport` + `ValidationSupportChain` |
| 3   | Snapshot generation (HAPI-semantically-equivalent)        | `ProfileUtilities.generateSnapshot()`                        |
| 4   | Structural validation (profile-based)                     | `FhirInstanceValidator.validate()`                           |
| 5   | FHIRPath expression evaluation                            | `FHIRPathEngine.evaluate()`                                  |
| 6   | FHIRPath invariant execution (constraint.expression)      | `FhirInstanceValidator` invariant checks                     |
| 7   | CanonicalProfile semantic model with InnerType extraction | N/A (fhir-runtime-specific optimization)                     |
| 8   | Bundle loading (profiles-resources, profiles-types)       | `DefaultProfileValidationSupport`                            |

### 1.2 Out-of-Scope (v0.2)

| #   | Excluded Capability                         | Rationale                                |
| --- | ------------------------------------------- | ---------------------------------------- |
| 1   | Terminology expansion / ValueSet validation | Requires external terminology service    |
| 2   | Cross-resource reference resolution         | Server-layer concern                     |
| 3   | SearchParameter indexing                    | Persistence-layer concern                |
| 4   | REST FHIR server                            | Server-layer concern                     |
| 5   | FHIR R5 / R6                                | Future version target                    |
| 6   | IG packaging / publishing                   | Build tooling concern                    |
| 7   | XML / RDF serialization                     | JSON-only for v0.2                       |

---

## 2. Architecture Overview

### 2.1 Module Dependency Chain

```
model ← parser ← context ← profile ← validator
                                  ↑
                              fhirpath
```

Each module is a subdirectory under `src/`. The dependency direction is strictly enforced: a module may only import from modules to its left.

### 2.2 Core Object Model

| Object                | Description                                    | Lifecycle                         |
| --------------------- | ---------------------------------------------- | --------------------------------- |
| `Resource`            | Base FHIR R4 resource interface                | Input to all operations           |
| `StructureDefinition` | Raw FHIR R4 SD (as parsed from JSON)           | Loaded → registered → consumed    |
| `CanonicalProfile`    | Internal semantic model (post-snapshot)        | Generated → cached → queried      |
| `ParseResult<T>`      | Discriminated union result of parsing          | Returned from parse operations    |
| `SnapshotResult`      | Result of snapshot generation                  | Returned from snapshot generation |
| `ValidationResult`    | Result of structural validation                | Returned from validation          |
| `TypedValue`          | FHIRPath evaluation atom (`{ type, value }`)   | Returned from FHIRPath evaluation |

### 2.3 HAPI Architecture Mapping

| fhir-runtime                             | HAPI FHIR                                         |
| ---------------------------------------- | ------------------------------------------------- |
| `FhirContextImpl`                        | `FhirContext` + `DefaultProfileValidationSupport` |
| `StructureDefinitionLoader`              | `IValidationSupport`                              |
| `CompositeLoader`                        | `ValidationSupportChain`                          |
| `SnapshotGenerator`                      | `ProfileUtilities.generateSnapshot()`             |
| `StructureValidator`                     | `FhirInstanceValidator`                           |
| `evalFhirPath()` / `evalFhirPathTyped()` | `FHIRPathEngine.evaluate()`                       |
| `CanonicalProfile`                       | N/A (fhir-runtime-specific; HAPI walks SD directly) |
| `buildCanonicalProfile()`                | N/A (fhir-runtime post-processing step)           |

---

## 3. Capability Contracts

Each contract defines the **public API surface**, **behavioral guarantees**, and **error semantics** that are frozen at v0.2.0.

### 3.1 Parsing Contract

**Purpose:** Transform FHIR R4 JSON into typed internal structures.

**Frozen API:**

```typescript
// Entry points
function parseFhirJson(json: string): ParseResult<Resource>;
function parseFhirObject(obj: unknown): ParseResult<Resource>;

// StructureDefinition-specific
function parseStructureDefinition(
  json: string,
): ParseResult<StructureDefinition>;
function parseElementDefinition(
  obj: unknown,
  path?: string,
): ParseResult<ElementDefinition>;

// Serialization (inverse)
function serializeToFhirJson(resource: Resource): string;
function serializeToFhirObject(resource: Resource): Record<string, unknown>;
```

**Behavioral Guarantees:**

| Guarantee                  | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| R4 JSON compliance         | Strict adherence to FHIR R4 JSON representation rules        |
| Primitive `_element` split | Correct merge of `value` + `_value` extension objects        |
| Choice type `[x]` dispatch | Automatic extraction and tagging via `ChoiceValue`           |
| Null alignment             | Array null padding for sparse primitive extensions           |
| Multi-issue collection     | All errors and warnings collected in `ParseResult.issues`    |
| No-throw contract          | Never throws exceptions; all errors via `ParseResult`        |
| Round-trip fidelity        | `serializeToFhirObject(parseFhirJson(json).data)` ≈ original |

**Error Codes (machine-readable):**

`INVALID_JSON` · `MISSING_RESOURCE_TYPE` · `UNKNOWN_RESOURCE_TYPE` · `INVALID_PRIMITIVE` · `INVALID_STRUCTURE` · `INVALID_CHOICE_TYPE` · `MULTIPLE_CHOICE_VALUES` · `ARRAY_MISMATCH` · `UNEXPECTED_NULL` · `UNEXPECTED_PROPERTY`

---

### 3.2 Context & Registry Contract

**Purpose:** StructureDefinition lifecycle management — loading, caching, registration, and inheritance resolution.

**HAPI Equivalent:** `FhirContext` + `IValidationSupport` + `ValidationSupportChain`

**Frozen API:**

```typescript
interface FhirContext {
  // Loading & retrieval
  loadStructureDefinition(url: string): Promise<StructureDefinition>;
  getStructureDefinition(url: string): StructureDefinition | undefined;
  hasStructureDefinition(url: string): boolean;
  registerStructureDefinition(sd: StructureDefinition): void;

  // Inheritance
  resolveInheritanceChain(url: string): Promise<string[]>;

  // Core definitions
  preloadCoreDefinitions(): Promise<void>;

  // InnerType schema (v0.1 addition)
  registerCanonicalProfile(profile: CanonicalProfile): void;
  getInnerType(typeName: string): CanonicalProfile | undefined;
  hasInnerType(typeName: string): boolean;

  // Lifecycle
  getStatistics(): ContextStatistics;
  dispose(): void;
}

// Pluggable loader interface
interface StructureDefinitionLoader {
  load(url: string): Promise<StructureDefinition | null>;
  canLoad(url: string): boolean;
  getSourceType(): string;
}

// Bundle loading
function loadBundleFromFile(
  path: string,
  options?: BundleLoadOptions,
): BundleLoadResult;
function loadBundleFromObject(
  bundle: unknown,
  options?: BundleLoadOptions,
): BundleLoadResult;
function loadBundlesFromFiles(
  paths: string[],
  options?: BundleLoadOptions,
): BundleLoadResult;
```

**Loader Implementations (frozen):**

| Loader             | Source                      | HAPI Equivalent                 |
| ------------------ | --------------------------- | ------------------------------- |
| `MemoryLoader`     | In-memory map               | `PrePopulatedValidationSupport` |
| `FileSystemLoader` | Local JSON files            | `NpmPackageValidationSupport`   |
| `CompositeLoader`  | Chain of loaders (fallback) | `ValidationSupportChain`        |

**Behavioral Guarantees:**

| Guarantee                     | Description                                                              |
| ----------------------------- | ------------------------------------------------------------------------ |
| Versioned URL support         | `url\|version` format correctly parsed and matched                       |
| Circular dependency detection | `CircularDependencyError` thrown on cycles                               |
| Cache-first resolution        | Registry checked before loader delegation                                |
| Core definitions bundled      | 73 FHIR R4 base definitions available via `preloadCoreDefinitions()`     |
| InnerType registration        | `extractInnerTypes()` output registered via `registerCanonicalProfile()` |
| Deterministic statistics      | `ContextStatistics` counters monotonically increase                      |

---

### 3.3 Snapshot Generation Contract

**Purpose:** Generate a complete snapshot for a StructureDefinition by expanding its differential against its base definition chain.

**HAPI Equivalent:** `ProfileUtilities.generateSnapshot()`

**Frozen API:**

```typescript
class SnapshotGenerator {
  constructor(context: FhirContext, options?: SnapshotGeneratorOptions);
  generate(sd: StructureDefinition): Promise<SnapshotResult>;
}

interface SnapshotGeneratorOptions {
  throwOnError?: boolean; // default: false
  maxRecursionDepth?: number; // default: 50
  generateCanonical?: boolean; // default: false
}

interface SnapshotResult {
  structureDefinition: StructureDefinition; // with populated snapshot
  canonical?: CanonicalProfile; // if generateCanonical=true
  issues: readonly SnapshotIssue[];
  success: boolean;
}
```

**Supporting Functions (frozen):**

```typescript
// CanonicalProfile construction
function buildCanonicalProfile(sd: StructureDefinition): CanonicalProfile;
function buildCanonicalElement(ed: ElementDefinition): CanonicalElement;

// InnerType extraction
function extractInnerTypes(
  profile: CanonicalProfile,
): Map<string, CanonicalProfile>;
function buildTypeName(components: string[]): string;

// Path utilities
function pathMatches(path: string, pattern: string): boolean;
function isDirectChild(parent: string, child: string): boolean;
function isDescendant(ancestor: string, path: string): boolean;
function pathDepth(path: string): number;
function parentPath(path: string): string;
// ... (11 path functions total)

// Element processing
function sortDifferential(
  elements: ElementDefinition[],
  base: ElementDefinition[],
): ElementDefinition[];
function mergeSnapshot(context: MergeContext): void;
function mergeConstraints(
  base: CanonicalElement,
  diff: ElementDefinition,
): CanonicalElement;
```

**Behavioral Guarantees:**

| Guarantee                         | Description                                                 |
| --------------------------------- | ----------------------------------------------------------- |
| Base-driven merge                 | Snapshot walks base elements; differential constrains them  |
| Constraint tightening             | Cardinality can only narrow, types can only restrict        |
| Unconsumed differential detection | Warns/errors on differential elements that don't match base |
| Deterministic element ordering    | Output element order matches HAPI's sorted snapshot         |
| Slicing support                   | Extension slicing, type slicing, value slicing              |
| Circular dependency detection     | `SnapshotCircularDependencyError` on recursive profiles     |
| HAPI semantic equivalence         | Validated against HAPI-generated fixtures (35/35 pass)      |

---

### 3.4 Structural Validation Contract

**Purpose:** Validate a FHIR resource instance against a CanonicalProfile (snapshot-driven).

**HAPI Equivalent:** `FhirInstanceValidator.validate()`

**Frozen API:**

```typescript
class StructureValidator {
  constructor(options?: ValidationOptions);
  validate(
    resource: Resource,
    profile: CanonicalProfile,
    options?: ValidationOptions,
  ): ValidationResult;
}

interface ValidationOptions {
  profileUrl?: string;
  validateSlicing?: boolean; // default: true
  validateFixed?: boolean; // default: true
  maxDepth?: number; // default: 50
  failFast?: boolean; // default: false
  skipInvariants?: boolean; // default: false
}

interface ValidationResult {
  valid: boolean;
  resource: Resource;
  profileUrl: string;
  profile: CanonicalProfile;
  issues: readonly ValidationIssue[];
}

interface ValidationIssue {
  severity: "error" | "warning" | "information";
  code: ValidationIssueCode;
  message: string;
  path?: string;
  expression?: string;
  diagnostics?: string;
}
```

**Validation Rules (frozen):**

| Rule                | Function                | Description                                              |
| ------------------- | ----------------------- | -------------------------------------------------------- |
| Cardinality         | `validateCardinality()` | min/max element count enforcement                        |
| Required elements   | `validateRequired()`    | Required-flag enforcement                                |
| Type compatibility  | `validateType()`        | Value type matches allowed types                         |
| Fixed value         | `validateFixed()`       | Exact match against `fixed[x]`                           |
| Pattern value       | `validatePattern()`     | Partial match against `pattern[x]`                       |
| Choice type         | `validateChoiceType()`  | Only one `[x]` variant present                           |
| Reference target    | `validateReference()`   | Target profile metadata check                            |
| Slicing             | `validateSlicing()`     | Slice discriminator matching, closed slicing enforcement |
| FHIRPath invariants | `validateInvariants()`  | `constraint.expression` evaluation                       |

**Behavioral Guarantees:**

| Guarantee                    | Description                                         |
| ---------------------------- | --------------------------------------------------- |
| Snapshot-driven              | Requires CanonicalProfile (not raw SD)              |
| Issue accumulation           | All issues collected unless `failFast=true`         |
| Deterministic ordering       | Issues sorted by path, then severity                |
| No terminology dependency    | Code/ValueSet validation excluded (v0.2)            |
| Invariant errors as warnings | FHIRPath evaluation failures don't block validation |

**Issue Codes (machine-readable):**

`CARDINALITY_MIN_VIOLATION` · `CARDINALITY_MAX_VIOLATION` · `TYPE_MISMATCH` · `FIXED_VALUE_MISMATCH` · `PATTERN_VALUE_MISMATCH` · `CHOICE_TYPE_VIOLATION` · `REFERENCE_TARGET_VIOLATION` · `SLICING_VIOLATION` · `INVARIANT_VIOLATION` · `UNKNOWN_ELEMENT`

---

### 3.5 FHIRPath Contract

**Purpose:** Parse and evaluate FHIRPath expressions against FHIR resources.

**HAPI Equivalent:** `FHIRPathEngine`

**Frozen API:**

```typescript
// Parsing
function parseFhirPath(expression: string): Atom;

// Evaluation
function evalFhirPath(expression: string | Atom, input: unknown): unknown[];
function evalFhirPathTyped(
  expression: string | Atom,
  input: TypedValue[],
  variables?: Record<string, TypedValue>,
): TypedValue[];

// Convenience
function evalFhirPathBoolean(
  expression: string | Atom,
  input: unknown,
  variables?: Record<string, TypedValue>,
): boolean;
function evalFhirPathString(
  expression: string | Atom,
  input: unknown,
  variables?: Record<string, TypedValue>,
): string | undefined;

// Caching
function getExpressionCache(): LRUCache<string, Atom>;
function clearExpressionCache(): void;
```

**Supported FHIRPath Sections (60+ functions):**

| Section         | Functions                                                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §5.1 Existence  | `empty`, `exists`, `all`, `allTrue`, `anyTrue`, `allFalse`, `anyFalse`, `subsetOf`, `supersetOf`, `count`, `distinct`, `isDistinct`                                                                                                             |
| §5.2 Filtering  | `where`, `select`, `repeat`, `ofType`                                                                                                                                                                                                           |
| §5.3 Subsetting | `single`, `first`, `last`, `tail`, `skip`, `take`, `intersect`, `exclude`                                                                                                                                                                       |
| §5.4 Combining  | `union`, `combine`                                                                                                                                                                                                                              |
| §5.5 Conversion | `iif`, `toBoolean`, `convertsToBoolean`, `toInteger`, `convertsToInteger`, `toDecimal`, `convertsToDecimal`, `toQuantity`, `convertsToQuantity`, `toString`, `convertsToString`, `toDateTime`, `convertsToDateTime`, `toTime`, `convertsToTime` |
| §5.6 String     | `indexOf`, `substring`, `startsWith`, `endsWith`, `contains`, `upper`, `lower`, `replace`, `matches`, `replaceMatches`, `length`, `toChars`, `join`                                                                                             |
| §5.7 Math       | `abs`, `ceiling`, `exp`, `floor`, `ln`, `log`, `power`, `round`, `sqrt`, `truncate`                                                                                                                                                             |
| §5.8 Tree       | `children`, `descendants`                                                                                                                                                                                                                       |
| §5.9 Utility    | `trace`, `now`, `timeOfDay`, `today`                                                                                                                                                                                                            |
| §6.3 Types      | `is`, `as`, `type`, `conformsTo`                                                                                                                                                                                                                |
| §6.5 Boolean    | `not`                                                                                                                                                                                                                                           |
| FHIR-specific   | `resolve`, `extension`, `hasValue`, `htmlChecks`, `getResourceKey`, `getReferenceKey`                                                                                                                                                           |

**Operators:**

| Category   | Operators                                  |
| ---------- | ------------------------------------------ |
| Arithmetic | `+`, `-`, `*`, `/`, `div`, `mod`           |
| Comparison | `=`, `!=`, `~`, `!~`, `<`, `>`, `<=`, `>=` |
| Boolean    | `and`, `or`, `xor`, `implies`, `not`       |
| Type       | `is`, `as`                                 |
| Collection | `\|` (union), `in`, `contains`             |
| String     | `&` (concatenation)                        |

**Behavioral Guarantees:**

| Guarantee                | Description                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Pratt parser             | Correct operator precedence per FHIRPath spec                                        |
| AST caching              | LRU cache for parsed expressions (default 128 entries)                               |
| Deterministic evaluation | Same expression + same input = same output                                           |
| No side effects          | Evaluation never mutates input                                                       |
| Variable scoping         | `$this`, `$index`, `$total` correctly scoped in `where()`, `select()`, `aggregate()` |

---

## 4. Error Contract

### 4.1 Structured Results (No-Throw Contract)

All capability entry points return structured result objects instead of throwing exceptions:

| Capability          | Result Type        | Success Field           |
| ------------------- | ------------------ | ----------------------- |
| Parsing             | `ParseResult<T>`   | `.success` (boolean)    |
| Snapshot Generation | `SnapshotResult`   | `.success` (boolean)    |
| Validation          | `ValidationResult` | `.valid` (boolean)      |
| FHIRPath            | Direct return      | Returns `[]` for errors |

**Exception:** System-level errors (e.g., out of memory, corrupted state) may still throw. These are not part of the contract.

### 4.2 Error Class Hierarchy

```
ContextError
  ├── ResourceNotFoundError        (SD not found by URL)
  ├── CircularDependencyError      (inheritance cycle detected)
  ├── LoaderError                  (loader I/O failure)
  └── InvalidStructureDefinitionError  (malformed SD)

ProfileError
  ├── SnapshotCircularDependencyError
  ├── BaseNotFoundError
  ├── ConstraintViolationError
  └── UnconsumedDifferentialError

ValidatorError
  ├── ProfileNotFoundError
  └── ValidationFailedError        (failFast mode)
```

### 4.3 Invariants

- All result objects are **immutable** (`readonly` properties).
- Issue arrays are **never undefined** — empty array if no issues.
- Issue ordering is **deterministic** across invocations.
- No capability depends on `console` or any global side-effect.

---

## 5. Determinism Guarantee

v0.2.0 explicitly guarantees:

| #   | Guarantee                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------- |
| 1   | Same input → same output for all capabilities                                                           |
| 2   | Snapshot element ordering is fixed (base-driven, sorted)                                                |
| 3   | Validation issue ordering is stable (by path, then severity)                                            |
| 4   | FHIRPath evaluation has no random or time-dependent behavior (except `now()`, `today()`, `timeOfDay()`) |
| 5   | Parse result issue ordering matches source document order                                               |

---

## 6. Testing & Quality Assurance (v0.2)

### 6.1 Test Coverage

| Category              | Count                      | Status        |
| --------------------- | -------------------------- | ------------- |
| Total test files      | 45                         | ✅ All passing |
| Total test cases      | 2,400+                     | ✅ All passing |
| HAPI snapshot fixture | 35/35 (100%)               | ✅ All passing |
| Module coverage       | All 6 modules              | ✅ Complete    |

### 6.2 US Core IG Verification

| Verification Item                 | Count/Status | Result     |
| --------------------------------- | ------------ | ---------- |
| US Core StructureDefinitions      | 70           | ✅ Parsed   |
| Resource profiles                 | 55           | ✅ Built    |
| Extension definitions             | 15           | ✅ Built    |
| Official examples validated       | Multiple     | ✅ Passing  |
| FHIRPath evaluation on examples   | Multiple     | ✅ Working  |
| Profile-to-example matching       | All          | ✅ Verified |
| Cross-profile coverage            | All profiles | ✅ Verified |

### 6.3 Stress Testing

| Test Category              | Description                      | Result    |
| -------------------------- | -------------------------------- | --------- |
| Malformed input resilience | Invalid JSON, missing fields     | ✅ Passing |
| Deep nesting stress        | Recursive structures             | ✅ Passing |
| Large payload stress       | Bundle processing                | ✅ Passing |
| FHIRPath complexity        | Complex expressions              | ✅ Passing |
| Memory pressure            | Batch processing                 | ✅ Passing |
| Concurrent safety          | Parallel operations              | ✅ Passing |

---

## 7. Release Gate (v0.2.0)

The following conditions must be met before tagging v0.2.0:

| #   | Gate                                        | Verification                              | Status |
| --- | ------------------------------------------- | ----------------------------------------- | ------ |
| 1   | All structural validation rules implemented | 9/9 rules with unit tests                 | ✅      |
| 2   | Snapshot generation HAPI-equivalent         | 35/35 HAPI fixture tests pass             | ✅      |
| 3   | FHIRPath invariant execution functional     | Invariant fixture tests pass              | ✅      |
| 4   | US Core IG verification complete            | 70 SDs parsed, examples validated         | ✅      |
| 5   | Stress tests passing                        | All 6 stress test categories pass         | ✅      |
| 6   | `tsc --noEmit` clean                        | Zero TypeScript errors                    | ✅      |
| 7   | All tests pass                              | 2,400+ tests green                        | ✅      |
| 8   | API surface documented                      | `docs/api/fhir-runtime-api-v0.2.md` complete | ✅      |
| 9   | Package metadata updated                    | Name, version, license updated            | ✅      |

---

## 8. Versioning & Compatibility Policy

- **v0.2.x** — Bug fixes only. No API additions or removals.
- **v0.3.0** — May add new capabilities (e.g., terminology). No removals.
- **v1.0.0** — Stable API. Breaking changes require major version bump.

All public exports from `fhir-runtime` as of v0.2.0 are considered **frozen**. The complete export inventory is documented in `docs/api/fhir-runtime-api-v0.2.md`.

---

## 9. Changes from v0.1.0

### 9.1 Package Changes

- **Package name:** `@medxai/fhir-core` → `fhir-runtime`
- **License:** Apache-2.0 → MIT
- **Repository:** Updated to reflect new package name
- **Version:** 0.1.0 → 0.2.0

### 9.2 Testing Enhancements

- Added US Core IG verification suite (70 SDs, 55 profiles, 15 extensions)
- Added comprehensive stress testing (6 categories)
- Expanded test coverage to 2,400+ tests across 45 files
- Validated against real-world Implementation Guide

### 9.3 Documentation Updates

- All documentation updated to reflect new package name
- Added comprehensive testing section to overview
- Updated API reference to v0.2
- Updated capability contract to v0.2

### 9.4 API Stability

- **No breaking changes** — All v0.1.0 APIs remain compatible
- **No new APIs** — v0.2.0 is a rename and testing release
- **Frozen API surface** — 211 exports across 6 modules unchanged
