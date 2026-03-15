# fhir-runtime — Frozen API Reference v0.2

> **Package:** `fhir-runtime@0.2.0`  
> **FHIR Version:** R4 (4.0.1)  
> **Frozen Date:** 2026-03-04  
> **License:** MIT  
> **Node.js:** >=18.0.0  
> **Module Format:** ESM (primary) + CJS (compatibility)  
> **Companion Document:** `docs/specs/engine-capability-contract-v0.2.md`

This document is the **authoritative inventory** of all public exports from `fhir-runtime` at the v0.2.0 freeze point. Any symbol not listed here is considered internal and subject to change without notice.

---

## Table of Contents

1. [Module: model](#1-module-model)
2. [Module: parser](#2-module-parser)
3. [Module: context](#3-module-context)
4. [Module: profile](#4-module-profile)
5. [Module: validator](#5-module-validator)
6. [Module: fhirpath](#6-module-fhirpath)
7. [Export Summary](#7-export-summary)

---

## 1. Module: model

**Source:** `src/model/`  
**Purpose:** FHIR R4 type definitions — branded primitives, enums, complex types, ElementDefinition, StructureDefinition, CanonicalProfile.

All exports from this module are **type-only** (no runtime code).

### 1.1 Branded Primitive Types

| Export             | TypeScript Mapping | FHIR Type      |
| ------------------ | ------------------ | -------------- |
| `FhirBoolean`      | `boolean`          | `boolean`      |
| `FhirInteger`      | `number`           | `integer`      |
| `FhirString`       | `string`           | `string`       |
| `FhirDecimal`      | `number`           | `decimal`      |
| `FhirUri`          | `string`           | `uri`          |
| `FhirUrl`          | `string`           | `url`          |
| `FhirCanonical`    | `string`           | `canonical`    |
| `FhirBase64Binary` | `string`           | `base64Binary` |
| `FhirInstant`      | `string`           | `instant`      |
| `FhirDate`         | `string`           | `date`         |
| `FhirDateTime`     | `string`           | `dateTime`     |
| `FhirTime`         | `string`           | `time`         |
| `FhirCode`         | `string`           | `code`         |
| `FhirOid`          | `string`           | `oid`          |
| `FhirId`           | `string`           | `id`           |
| `FhirMarkdown`     | `string`           | `markdown`     |
| `FhirUnsignedInt`  | `number`           | `unsignedInt`  |
| `FhirPositiveInt`  | `number`           | `positiveInt`  |
| `FhirUuid`         | `string`           | `uuid`         |
| `FhirXhtml`        | `string`           | `xhtml`        |

### 1.2 Enums

| Export                    | Values                                                                 |
| ------------------------- | ---------------------------------------------------------------------- |
| `PublicationStatus`       | `'draft'` \| `'active'` \| `'retired'` \| `'unknown'`                  |
| `StructureDefinitionKind` | `'primitive-type'` \| `'complex-type'` \| `'resource'` \| `'logical'`  |
| `TypeDerivationRule`      | `'specialization'` \| `'constraint'`                                   |
| `ExtensionContextType`    | `'fhirpath'` \| `'element'` \| `'extension'`                           |
| `FhirVersionCode`         | `'4.0.1'` (and others)                                                 |
| `PropertyRepresentation`  | `'xmlAttr'` \| `'xmlText'` \| `'typeAttr'` \| `'cdaText'` \| `'xhtml'` |
| `SlicingRules`            | `'closed'` \| `'open'` \| `'openAtEnd'`                                |
| `DiscriminatorType`       | `'value'` \| `'exists'` \| `'pattern'` \| `'type'` \| `'profile'`      |
| `AggregationMode`         | `'contained'` \| `'referenced'` \| `'bundled'`                         |
| `ReferenceVersionRules`   | `'either'` \| `'independent'` \| `'specific'`                          |
| `ConstraintSeverity`      | `'error'` \| `'warning'`                                               |
| `BindingStrength`         | `'required'` \| `'extensible'` \| `'preferred'` \| `'example'`         |
| `NarrativeStatus`         | `'generated'` \| `'extensions'` \| `'additional'` \| `'empty'`         |

### 1.3 Base Complex Types

| Export            | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| `Element`         | Base for all FHIR elements                                        |
| `Extension`       | FHIR Extension                                                    |
| `Coding`          | system + code + display                                           |
| `CodeableConcept` | coding[] + text                                                   |
| `Identifier`      | system + value                                                    |
| `Period`          | start + end                                                       |
| `Reference`       | reference + type + display                                        |
| `ContactDetail`   | name + telecom[]                                                  |
| `ContactPoint`    | system + value + use                                              |
| `UsageContext`    | code + value[x]                                                   |
| `Quantity`        | value + unit + system + code                                      |
| `Narrative`       | status + div                                                      |
| `Meta`            | versionId + lastUpdated + profile[] + security[] + tag[]          |
| `Resource`        | Base resource (resourceType + id + meta)                          |
| `DomainResource`  | Resource + text + contained[] + extension[] + modifierExtension[] |
| `BackboneElement` | Element + modifierExtension[]                                     |

### 1.4 ElementDefinition & Sub-Types

| Export                        | Description                                                     |
| ----------------------------- | --------------------------------------------------------------- |
| `ElementDefinition`           | Full ED (37 fields)                                             |
| `ElementDefinitionSlicing`    | Slicing rules (discriminator, rules, ordered, description)      |
| `SlicingDiscriminator`        | type + path                                                     |
| `ElementDefinitionBase`       | path + min + max (from base SD)                                 |
| `ElementDefinitionType`       | code + profile[] + targetProfile[] + aggregation[] + versioning |
| `ElementDefinitionConstraint` | key + severity + human + expression + xpath + source            |
| `ElementDefinitionBinding`    | strength + description + valueSet                               |
| `ElementDefinitionExample`    | label + value[x]                                                |
| `ElementDefinitionMapping`    | identity + language + map + comment                             |

### 1.5 StructureDefinition & Sub-Types

| Export                            | Description                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `StructureDefinition`             | Full SD (url, name, status, kind, type, baseDefinition, snapshot, differential, ...) |
| `StructureDefinitionMapping`      | identity + uri + name + comment                                                      |
| `StructureDefinitionContext`      | type + expression                                                                    |
| `StructureDefinitionSnapshot`     | element[]                                                                            |
| `StructureDefinitionDifferential` | element[]                                                                            |

### 1.6 CanonicalProfile (Internal Semantic Model)

| Export                    | Description                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `CanonicalProfile`        | Resolved profile: url, name, type, kind, derivation, abstract, elements (Map), innerTypes?                                                     |
| `CanonicalElement`        | Resolved element: path, min, max, types[], mustSupport, isModifier, isSummary, binding?, constraints[], fixed?, pattern?, sliceName?, slicing? |
| `TypeConstraint`          | code + profile[] + targetProfile[] + aggregation[] + versioning                                                                                |
| `BindingConstraint`       | strength + valueSet + description                                                                                                              |
| `Invariant`               | key + severity + human + expression                                                                                                            |
| `SlicingDefinition`       | discriminators[] + rules + ordered + description                                                                                               |
| `SlicingDiscriminatorDef` | type + path                                                                                                                                    |

---

## 2. Module: parser

**Source:** `src/parser/`  
**Purpose:** FHIR R4 JSON parsing, serialization, and error reporting.

### 2.1 Types

| Export            | Kind      | Description                                                                                                |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `ParseSeverity`   | type      | `'error'` \| `'warning'`                                                                                   |
| `ParseErrorCode`  | type      | 10 machine-readable error codes                                                                            |
| `ParseIssue`      | interface | `{ severity, code, message, path }`                                                                        |
| `ParseResult<T>`  | type      | Discriminated union: `{ success: true, data: T, issues }` \| `{ success: false, data: undefined, issues }` |
| `ChoiceValue`     | interface | Tagged choice type value: `{ propertyName, typeName, value }`                                              |
| `ChoiceTypeField` | interface | Choice type field metadata                                                                                 |

### 2.2 Functions

#### `parseFhirJson(json: string): ParseResult<Resource>`

Parse a FHIR R4 JSON string into a typed Resource. Supports all FHIR R4 resource types. Dispatches StructureDefinition to the dedicated SD parser.

#### `parseFhirObject(obj: unknown): ParseResult<Resource>`

Parse a plain JavaScript object (already JSON.parsed) into a typed Resource.

#### `parseStructureDefinition(json: string): ParseResult<StructureDefinition>`

Parse a StructureDefinition JSON string with full ElementDefinition support (37 fields, all sub-types).

#### `parseElementDefinition(obj: unknown, path?: string): ParseResult<ElementDefinition>`

Parse a single ElementDefinition object.

#### `serializeToFhirJson(resource: Resource): string`

Serialize a Resource to a pretty-printed FHIR R4 JSON string. Restores choice types, orders properties (`resourceType` first), omits empty values.

#### `serializeToFhirObject(resource: Resource): Record<string, unknown>`

Serialize a Resource to a plain JavaScript object suitable for `JSON.stringify()`.

#### `parseSuccess<T>(data: T, issues?: ParseIssue[]): ParseResult<T>`

Factory: create a successful `ParseResult`.

#### `parseFailure<T>(issues: ParseIssue[]): ParseResult<T>`

Factory: create a failed `ParseResult`. Requires at least one error-severity issue.

#### `createIssue(severity, code, message, path): ParseIssue`

Factory: create a `ParseIssue`.

#### `hasErrors(issues: readonly ParseIssue[]): boolean`

Check whether an issues array contains at least one error.

---

## 3. Module: context

**Source:** `src/context/`  
**Purpose:** StructureDefinition registry, loader abstraction, inheritance resolution, bundle loading, InnerType extraction.

### 3.1 Types

| Export                      | Kind      | Description                                                                           |
| --------------------------- | --------- | ------------------------------------------------------------------------------------- |
| `FhirContext`               | interface | Central registry & lifecycle manager (12 methods)                                     |
| `FhirContextOptions`        | interface | `{ loaders, preloadCore?, specDirectory? }`                                           |
| `StructureDefinitionLoader` | interface | `{ load(), canLoad(), getSourceType() }`                                              |
| `LoaderOptions`             | interface | `{ basePath?, timeout?, retryCount? }`                                                |
| `ContextStatistics`         | interface | `{ totalLoaded, cacheHits, cacheMisses, loaderCalls, chainsResolved, registrations }` |
| `BundleLoadOptions`         | interface | `{ filterKind?, excludeAbstract?, filterTypes? }`                                     |
| `BundleLoadResult`          | interface | `{ profiles[], errors[], stats }`                                                     |
| `BundleLoadError`           | interface | `{ name, url, error, parseIssues? }`                                                  |

### 3.2 Classes

#### `FhirContextImpl`

Concrete implementation of `FhirContext`. Integrates registry + resolver + loaders.

```typescript
class FhirContextImpl implements FhirContext {
  constructor(options: FhirContextOptions);
  loadStructureDefinition(url: string): Promise<StructureDefinition>;
  getStructureDefinition(url: string): StructureDefinition | undefined;
  hasStructureDefinition(url: string): boolean;
  registerStructureDefinition(sd: StructureDefinition): void;
  resolveInheritanceChain(url: string): Promise<string[]>;
  preloadCoreDefinitions(): Promise<void>;
  registerCanonicalProfile(profile: CanonicalProfile): void;
  getInnerType(typeName: string): CanonicalProfile | undefined;
  hasInnerType(typeName: string): boolean;
  getStatistics(): ContextStatistics;
  dispose(): void;
}
```

#### `MemoryLoader`

Loads StructureDefinitions from an in-memory `Map<string, StructureDefinition>`.

#### `FileSystemLoader`

Loads StructureDefinitions from local JSON files by mapping canonical URLs to file paths.

#### `CompositeLoader`

Chains multiple loaders in order (first match wins). Equivalent to HAPI's `ValidationSupportChain`.

### 3.3 Functions

#### `loadBundleFromFile(path: string, options?: BundleLoadOptions): BundleLoadResult`

Load a FHIR Bundle JSON file and extract StructureDefinitions as CanonicalProfiles.

#### `loadBundleFromObject(bundle: unknown, options?: BundleLoadOptions): BundleLoadResult`

Load from an already-parsed Bundle object.

#### `loadBundlesFromFiles(paths: string[], options?: BundleLoadOptions): BundleLoadResult`

Load multiple Bundle files, merging results.

#### `extractInnerTypes(profile: CanonicalProfile): Map<string, CanonicalProfile>`

Extract BackboneElement inner types from a CanonicalProfile. E.g., `Patient.contact` → `PatientContact`.

#### `buildTypeName(components: string[]): string`

Build a PascalCase type name from path segments. `['Patient', 'contact']` → `'PatientContact'`.

#### `isBackboneElementType(element: CanonicalElement): boolean`

Check if an element's type is `BackboneElement` or `Element`.

#### `createEmptyStatistics(): ContextStatistics`

Factory: create a zeroed statistics object.

### 3.4 Error Classes

| Export                            | Base           | Thrown When                   |
| --------------------------------- | -------------- | ----------------------------- |
| `ContextError`                    | `Error`        | Base class for context errors |
| `ResourceNotFoundError`           | `ContextError` | SD not found by URL           |
| `CircularDependencyError`         | `ContextError` | Inheritance cycle detected    |
| `LoaderError`                     | `ContextError` | Loader I/O failure            |
| `InvalidStructureDefinitionError` | `ContextError` | Malformed SD                  |

### 3.5 Core Definition Constants

| Export                 | Type       | Description                                         |
| ---------------------- | ---------- | --------------------------------------------------- |
| `BASE_RESOURCES`       | `string[]` | Base resource type URLs (Resource, DomainResource)  |
| `PRIMITIVE_TYPES`      | `string[]` | Primitive type URLs (string, boolean, integer, ...) |
| `COMPLEX_TYPES`        | `string[]` | Complex type URLs (CodeableConcept, Quantity, ...)  |
| `CORE_RESOURCES`       | `string[]` | Core resource URLs (Patient, Observation, ...)      |
| `ALL_CORE_DEFINITIONS` | `string[]` | All 73 bundled core definition URLs                 |

### 3.6 Core Definition Functions

| Export                   | Signature                                       | Description                                |
| ------------------------ | ----------------------------------------------- | ------------------------------------------ |
| `loadAllCoreDefinitions` | `() → Promise<StructureDefinition[]>`           | Load all 73 bundled core SDs               |
| `loadCoreDefinition`     | `(name: string) → Promise<StructureDefinition>` | Load one core SD by name                   |
| `loadCoreDefinitionSync` | `(name: string) → StructureDefinition`          | Synchronous version                        |
| `getCoreDefinitionsDir`  | `() → string`                                   | Path to bundled core-definitions directory |

---

## 4. Module: profile

**Source:** `src/profile/`  
**Purpose:** Snapshot generation, canonical profile building, element merging, constraint resolution, slicing handling.

### 4.1 Types

| Export                     | Kind      | Description                                                 |
| -------------------------- | --------- | ----------------------------------------------------------- |
| `SnapshotGeneratorOptions` | interface | `{ throwOnError?, maxRecursionDepth?, generateCanonical? }` |
| `SnapshotResult`           | interface | `{ structureDefinition, canonical?, issues[], success }`    |
| `SnapshotIssue`            | interface | `{ severity, code, message, path?, element? }`              |
| `SnapshotIssueCode`        | type      | Machine-readable snapshot issue codes                       |
| `DiffElementTracker`       | interface | Internal differential consumption tracker                   |
| `TraversalScope`           | interface | Cursor-based scope for base-driven traversal                |
| `MergeContext`             | interface | State for element merge operations                          |

### 4.2 Classes

#### `SnapshotGenerator`

Main orchestrator for snapshot generation. HAPI-equivalent to `ProfileUtilities.generateSnapshot()`.

```typescript
class SnapshotGenerator {
  constructor(context: FhirContext, options?: SnapshotGeneratorOptions);
  generate(sd: StructureDefinition): Promise<SnapshotResult>;
}
```

### 4.3 Canonical Builder Functions

| Export                   | Signature                                                    | Description                    |
| ------------------------ | ------------------------------------------------------------ | ------------------------------ |
| `buildCanonicalProfile`  | `(sd: StructureDefinition) → CanonicalProfile`               | Convert SD to CanonicalProfile |
| `buildCanonicalElement`  | `(ed: ElementDefinition) → CanonicalElement`                 | Convert ED to CanonicalElement |
| `buildTypeConstraints`   | `(types: ElementDefinitionType[]) → TypeConstraint[]`        | Extract type constraints       |
| `buildBindingConstraint` | `(binding: ElementDefinitionBinding) → BindingConstraint`    | Extract binding                |
| `buildInvariants`        | `(constraints: ElementDefinitionConstraint[]) → Invariant[]` | Extract invariants             |
| `buildSlicingDefinition` | `(slicing: ElementDefinitionSlicing) → SlicingDefinition`    | Extract slicing def            |

### 4.4 Path Utilities (11 functions)

| Export                  | Signature                    | Description                              |
| ----------------------- | ---------------------------- | ---------------------------------------- |
| `pathMatches`           | `(path, pattern) → boolean`  | Match element path against pattern       |
| `isDirectChild`         | `(parent, child) → boolean`  | Check if child is direct child of parent |
| `isDescendant`          | `(ancestor, path) → boolean` | Check if path descends from ancestor     |
| `pathDepth`             | `(path) → number`            | Count segments in a path                 |
| `parentPath`            | `(path) → string`            | Get parent path                          |
| `tailSegment`           | `(path) → string`            | Get last segment of path                 |
| `isChoiceTypePath`      | `(path) → boolean`           | Check for `[x]` choice type              |
| `matchesChoiceType`     | `(path, basePath) → boolean` | Match concrete choice against base       |
| `extractChoiceTypeName` | `(path) → string`            | Extract type suffix from choice path     |
| `hasSliceName`          | `(path) → boolean`           | Check for `:sliceName`                   |
| `extractSliceName`      | `(path) → string`            | Extract slice name                       |

### 4.5 Element Sorter Functions

| Export                 | Signature                                | Description                  |
| ---------------------- | ---------------------------------------- | ---------------------------- |
| `findBaseIndex`        | `(elements, path, base) → number`        | Find insertion index in base |
| `sortDifferential`     | `(elements, base) → ElementDefinition[]` | Sort differential elements   |
| `validateElementOrder` | `(elements, base) → boolean`             | Validate element ordering    |
| `ensureElementIds`     | `(elements) → void`                      | Ensure all elements have IDs |

### 4.6 Constraint Merger Functions

| Export                | Signature                         | Description                              |
| --------------------- | --------------------------------- | ---------------------------------------- |
| `mergeConstraints`    | `(base, diff) → CanonicalElement` | Merge differential constraints into base |
| `setBaseTraceability` | `(element, base) → void`          | Set base traceability fields             |
| `mergeCardinality`    | `(base, diff) → void`             | Merge min/max cardinality                |
| `mergeTypes`          | `(base, diff) → void`             | Merge type constraints                   |
| `mergeBinding`        | `(base, diff) → void`             | Merge binding constraints                |
| `mergeConstraintList` | `(base, diff) → void`             | Merge constraint (invariant) lists       |
| `isLargerMax`         | `(a, b) → boolean`                | Compare max cardinality values           |

### 4.7 Element Merger Functions

| Export               | Signature                  | Description                            |
| -------------------- | -------------------------- | -------------------------------------- |
| `createMergeContext` | `(options) → MergeContext` | Create merge context                   |
| `processPaths`       | `(context) → void`         | Process all paths in base-driven merge |
| `mergeSnapshot`      | `(context) → void`         | Execute full snapshot merge            |

### 4.8 Slicing Handler Functions

| Export                         | Signature                                | Description                          |
| ------------------------------ | ---------------------------------------- | ------------------------------------ |
| `makeExtensionSlicing`         | `() → SlicingDefinition`                 | Create default extension slicing     |
| `getSliceSiblings`             | `(elements, path) → ElementDefinition[]` | Get sibling slices                   |
| `validateSlicingCompatibility` | `(existing, incoming) → boolean`         | Check slicing compatibility          |
| `diffsConstrainTypes`          | `(elements) → boolean`                   | Check if diffs constrain types       |
| `handleNewSlicing`             | `(context, element) → void`              | Handle new slicing introduction      |
| `handleExistingSlicing`        | `(context, element) → void`              | Handle existing slicing modification |

### 4.9 Error Classes

| Export                            | Base           | Thrown When                      |
| --------------------------------- | -------------- | -------------------------------- |
| `ProfileError`                    | `Error`        | Base class for profile errors    |
| `SnapshotCircularDependencyError` | `ProfileError` | Circular profile dependency      |
| `BaseNotFoundError`               | `ProfileError` | Base SD cannot be loaded         |
| `ConstraintViolationError`        | `ProfileError` | Constraint tightening violation  |
| `UnconsumedDifferentialError`     | `ProfileError` | Unconsumed differential elements |

### 4.10 Helper Functions

| Export                | Signature                                             | Description                 |
| --------------------- | ----------------------------------------------------- | --------------------------- |
| `createSnapshotIssue` | `(severity, code, message, options?) → SnapshotIssue` | Factory for snapshot issues |
| `createDiffTracker`   | `() → DiffElementTracker`                             | Factory for diff tracker    |

---

## 5. Module: validator

**Source:** `src/validator/`  
**Purpose:** Structural validation of FHIR resource instances against CanonicalProfiles.

### 5.1 Types

| Export                       | Kind      | Description                                                                                |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `ValidationOptions`          | interface | `{ profileUrl?, validateSlicing?, validateFixed?, maxDepth?, failFast?, skipInvariants? }` |
| `ValidationResult`           | interface | `{ valid, resource, profileUrl, profile, issues[] }`                                       |
| `ValidationIssue`            | interface | `{ severity, code, message, path?, expression?, diagnostics? }`                            |
| `ValidationIssueCode`        | type      | 16 machine-readable issue codes                                                            |
| `ValidationContext`          | interface | Internal traversal state (profile, issues, options, depth)                                 |
| `InvariantValidationOptions` | interface | Options for invariant validation                                                           |

### 5.2 Classes

#### `StructureValidator`

Main validator class. Orchestrates all validation rules.

```typescript
class StructureValidator {
  constructor(options?: ValidationOptions);
  validate(
    resource: Resource,
    profile: CanonicalProfile,
    options?: ValidationOptions,
  ): ValidationResult;
}
```

### 5.3 Validation Rule Functions

| Export                 | Signature                            | Description                          |
| ---------------------- | ------------------------------------ | ------------------------------------ |
| `validateCardinality`  | `(element, values, issues) → void`   | Min/max cardinality                  |
| `validateRequired`     | `(element, values, issues) → void`   | Required element presence            |
| `validateType`         | `(element, value, issues) → void`    | Type compatibility                   |
| `validateChoiceType`   | `(element, resource, issues) → void` | Choice type `[x]` rules              |
| `inferFhirType`        | `(value) → string`                   | Infer FHIR type from JS value        |
| `deepEqual`            | `(a, b) → boolean`                   | Deep equality comparison             |
| `validateFixed`        | `(element, value, issues) → void`    | Fixed value exact match              |
| `matchesPattern`       | `(value, pattern) → boolean`         | Pattern partial match                |
| `validatePattern`      | `(element, value, issues) → void`    | Pattern value match                  |
| `extractReferenceType` | `(ref) → string`                     | Extract resource type from reference |
| `validateReference`    | `(element, value, issues) → void`    | Reference target profile             |

### 5.4 Path Extractor Functions

| Export                    | Signature                                 | Description                          |
| ------------------------- | ----------------------------------------- | ------------------------------------ |
| `extractValues`           | `(resource, path) → unknown[]`            | Extract values at FHIRPath-like path |
| `pathExists`              | `(resource, path) → boolean`              | Check if path has values             |
| `findChoiceTypeField`     | `(resource, basePath) → { path, value }?` | Find populated choice type           |
| `normalizeChoicePath`     | `(path) → string`                         | Normalize choice type path           |
| `extractChoiceTypeSuffix` | `(path, basePath) → string`               | Extract type suffix                  |

### 5.5 Slicing Validator Functions

| Export                       | Signature                                   | Description                      |
| ---------------------------- | ------------------------------------------- | -------------------------------- |
| `validateSlicing`            | `(element, values, profile, issues) → void` | Full slicing validation          |
| `findMatchingSlice`          | `(value, slices, profile) → string?`        | Find matching slice for value    |
| `matchesDiscriminator`       | `(value, discriminator, slice) → boolean`   | Match single discriminator       |
| `isSliceOrderValid`          | `(values, slices, profile) → boolean`       | Validate ordered slicing         |
| `extractValueAtPath`         | `(value, path) → unknown`                   | Extract nested value             |
| `getSliceDiscriminatorValue` | `(slice, discriminator) → unknown`          | Get discriminator expected value |
| `getSliceTypes`              | `(slice) → string[]`                        | Get allowed types for slice      |

### 5.6 Invariant Validator Functions

| Export                    | Signature                                       | Description                      |
| ------------------------- | ----------------------------------------------- | -------------------------------- |
| `validateInvariants`      | `(element, value, resource, issues) → void`     | Evaluate all FHIRPath invariants |
| `validateSingleInvariant` | `(constraint, value, resource) → boolean`       | Evaluate one invariant           |
| `validateAllInvariants`   | `(constraints, value, resource, issues) → void` | Evaluate constraint list         |

### 5.7 Helper Functions

| Export                     | Signature                                               | Description                     |
| -------------------------- | ------------------------------------------------------- | ------------------------------- |
| `createValidationIssue`    | `(severity, code, message, options?) → ValidationIssue` | Factory                         |
| `createValidationContext`  | `(profile, options?) → ValidationContext`               | Factory (internal)              |
| `resolveValidationOptions` | `(options?) → Required<ValidationOptions>`              | Fill defaults                   |
| `hasValidationErrors`      | `(issues) → boolean`                                    | Check for error-severity issues |
| `filterIssuesBySeverity`   | `(issues, severity) → ValidationIssue[]`                | Filter by severity              |
| `filterIssuesByCode`       | `(issues, code) → ValidationIssue[]`                    | Filter by code                  |

### 5.8 Validation Issue Codes (complete list)

| Code                            | Category      |
| ------------------------------- | ------------- |
| `CARDINALITY_MIN_VIOLATION`     | Cardinality   |
| `CARDINALITY_MAX_VIOLATION`     | Cardinality   |
| `TYPE_MISMATCH`                 | Type          |
| `INVALID_CHOICE_TYPE`           | Type          |
| `REQUIRED_ELEMENT_MISSING`      | Required      |
| `FIXED_VALUE_MISMATCH`          | Fixed/Pattern |
| `PATTERN_VALUE_MISMATCH`        | Fixed/Pattern |
| `SLICING_NO_MATCH`              | Slicing       |
| `SLICING_CARDINALITY_VIOLATION` | Slicing       |
| `SLICING_ORDER_VIOLATION`       | Slicing       |
| `REFERENCE_TARGET_MISMATCH`     | Reference     |
| `PROFILE_NOT_FOUND`             | Profile       |
| `RESOURCE_TYPE_MISMATCH`        | Profile       |
| `UNKNOWN_ELEMENT`               | Unknown       |
| `INVARIANT_NOT_EVALUATED`       | Invariant     |
| `INVARIANT_VIOLATION`           | Invariant     |
| `INVARIANT_EVALUATION_ERROR`    | Invariant     |
| `INTERNAL_ERROR`                | Internal      |

### 5.9 Error Classes

| Export                  | Base             | Thrown When                           |
| ----------------------- | ---------------- | ------------------------------------- |
| `ValidatorError`        | `Error`          | Base class for validator errors       |
| `ProfileNotFoundError`  | `ValidatorError` | Profile not found for validation      |
| `ValidationFailedError` | `ValidatorError` | `failFast=true` and error encountered |

---

## 6. Module: fhirpath

**Source:** `src/fhirpath/`  
**Purpose:** FHIRPath expression parsing, evaluation, and caching. Pratt parser architecture.

> **Note:** The fhirpath module exports are currently available from the module barrel (`fhirpath/index.ts`) but are **not** re-exported from the top-level `fhir-runtime` entry point. They are accessed internally by the validator's invariant engine. Direct consumer access is via the top-level `evalFhirPath*` functions which are re-exported through the validator integration.

### 6.1 Core Types

| Export             | Kind       | Description                                                         |
| ------------------ | ---------- | ------------------------------------------------------------------- |
| `TypedValue`       | interface  | `{ type: string, value: unknown }` — fundamental FHIRPath data unit |
| `AtomContext`      | interface  | Evaluation context: `{ parent?, variables }`                        |
| `Atom`             | interface  | AST node: `{ eval(ctx, input) → TypedValue[] }`                     |
| `PropertyType`     | const enum | FHIR property type identifiers (20 primitives + 12 complex)         |
| `FhirPathFunction` | type       | `(context, input, ...args) → TypedValue[]`                          |

### 6.2 Parser & Evaluator

| Export                      | Signature                                            | Description                         |
| --------------------------- | ---------------------------------------------------- | ----------------------------------- |
| `parseFhirPath`             | `(expression: string) → Atom`                        | Parse FHIRPath expression to AST    |
| `evalFhirPath`              | `(expr: string \| Atom, input: unknown) → unknown[]` | Evaluate, return unwrapped values   |
| `evalFhirPathTyped`         | `(expr, input: TypedValue[], vars?) → TypedValue[]`  | Evaluate with typed input           |
| `evalFhirPathBoolean`       | `(expr, input, vars?) → boolean`                     | Evaluate to boolean (invariant use) |
| `evalFhirPathString`        | `(expr, input, vars?) → string \| undefined`         | Evaluate to first string result     |
| `initFhirPathParserBuilder` | `() → ParserBuilder`                                 | Get configured parser builder       |
| `OperatorPrecedence`        | const object                                         | 19 precedence levels                |

### 6.3 Lexer (Generic Pratt Parser Framework)

| Export             | Kind      | Description                            |
| ------------------ | --------- | -------------------------------------- |
| `Token`            | interface | `{ id, value }`                        |
| `Marker`           | interface | Token position marker                  |
| `TokenizerOptions` | interface | Tokenizer configuration                |
| `Tokenizer`        | class     | Generic tokenizer                      |
| `PrefixParselet`   | interface | Prefix parsing strategy                |
| `InfixParselet`    | interface | Infix parsing strategy                 |
| `ParserBuilder`    | class     | Builder for Pratt parser configuration |
| `Parser`           | class     | Pratt parser instance                  |

### 6.4 FHIRPath Tokenizer

| Export               | Signature                        | Description                  |
| -------------------- | -------------------------------- | ---------------------------- |
| `tokenize`           | `(expression: string) → Token[]` | Tokenize FHIRPath expression |
| `FHIRPATH_KEYWORDS`  | `string[]`                       | Reserved keywords            |
| `FHIRPATH_OPERATORS` | `string[]`                       | Recognized operators         |

### 6.5 Expression Cache

| Export                 | Signature                     | Description                                              |
| ---------------------- | ----------------------------- | -------------------------------------------------------- |
| `LRUCache`             | class                         | Generic LRU cache (`get`, `set`, `has`, `clear`, `size`) |
| `getExpressionCache`   | `() → LRUCache<string, Atom>` | Get global expression cache                              |
| `setExpressionCache`   | `(cache) → void`              | Replace global cache                                     |
| `clearExpressionCache` | `() → void`                   | Clear cached ASTs                                        |
| `DEFAULT_CACHE_SIZE`   | `number`                      | Default: 128                                             |

### 6.6 Atom Classes (AST Nodes)

| Export                     | Type           | Description                                        |
| -------------------------- | -------------- | -------------------------------------------------- |
| `FhirPathAtom`             | class          | Root AST wrapper                                   |
| `LiteralAtom`              | class          | Literal values (string, number, boolean, quantity) |
| `SymbolAtom`               | class          | Named symbols (field access)                       |
| `EmptySetAtom`             | class          | Empty collection `{}`                              |
| `UnaryOperatorAtom`        | class          | Unary operators (`-`, `+`)                         |
| `DotAtom`                  | class          | Dot navigation (`.`)                               |
| `FunctionAtom`             | class          | Function calls                                     |
| `IndexerAtom`              | class          | Array indexing (`[n]`)                             |
| `ArithmeticOperatorAtom`   | class          | `+`, `-`, `*`, `/`, `div`, `mod`                   |
| `ConcatAtom`               | class          | String concatenation (`&`)                         |
| `UnionAtom`                | class          | Collection union (`\|`)                            |
| `EqualsAtom`               | class          | `=`                                                |
| `NotEqualsAtom`            | class          | `!=`                                               |
| `EquivalentAtom`           | class          | `~`                                                |
| `NotEquivalentAtom`        | class          | `!~`                                               |
| `IsAtom`                   | class          | Type check (`is`)                                  |
| `AsAtom`                   | class          | Type cast (`as`)                                   |
| `ContainsAtom`             | class          | Collection `contains`                              |
| `InAtom`                   | class          | Collection `in`                                    |
| `AndAtom`                  | class          | Boolean `and`                                      |
| `OrAtom`                   | class          | Boolean `or`                                       |
| `XorAtom`                  | class          | Boolean `xor`                                      |
| `ImpliesAtom`              | class          | Boolean `implies`                                  |
| `BooleanInfixOperatorAtom` | class          | Comparison operators (`<`, `>`, `<=`, `>=`)        |
| `PrefixOperatorAtom`       | abstract class | Base for prefix operators                          |
| `InfixOperatorAtom`        | abstract class | Base for infix operators                           |

### 6.7 Utility Functions

| Export                    | Signature                                          | Description                |
| ------------------------- | -------------------------------------------------- | -------------------------- |
| `booleanToTypedValue`     | `(b: boolean) → TypedValue`                        | Wrap boolean               |
| `toTypedValue`            | `(value: unknown) → TypedValue`                    | Auto-detect type and wrap  |
| `toJsBoolean`             | `(values: TypedValue[]) → boolean`                 | FHIRPath boolean semantics |
| `singleton`               | `(values: TypedValue[]) → TypedValue \| undefined` | Extract single value       |
| `getTypedPropertyValue`   | `(value: TypedValue, key: string) → TypedValue[]`  | Navigate property          |
| `fhirPathEquals`          | `(a, b) → TypedValue[]`                            | FHIRPath equality          |
| `fhirPathArrayEquals`     | `(a, b) → TypedValue[]`                            | Array equality             |
| `fhirPathArrayNotEquals`  | `(a, b) → TypedValue[]`                            | Array not-equals           |
| `fhirPathEquivalent`      | `(a, b) → TypedValue[]`                            | FHIRPath equivalence       |
| `fhirPathArrayEquivalent` | `(a, b) → TypedValue[]`                            | Array equivalence          |
| `fhirPathNot`             | `(values) → TypedValue[]`                          | Boolean negation           |
| `removeDuplicates`        | `(values) → TypedValue[]`                          | Deduplicate collection     |
| `fhirPathIs`              | `(value, typeName) → boolean`                      | Type check                 |
| `isQuantity`              | `(value) → boolean`                                | Check if Quantity          |
| `isResource`              | `(value) → boolean`                                | Check if Resource          |
| `isResourceType`          | `(value, type) → boolean`                          | Check resource type        |
| `parseDateString`         | `(s: string) → Date`                               | Parse FHIR date string     |

### 6.8 Functions Registry

| Export      | Type                               | Description                           |
| ----------- | ---------------------------------- | ------------------------------------- |
| `functions` | `Record<string, FhirPathFunction>` | All 60+ registered FHIRPath functions |

---

## 7. Export Summary

### 7.1 Counts by Module

| Module    | Types  | Functions | Classes | Error Classes | Constants | Total   |
| --------- | ------ | --------- | ------- | ------------- | --------- | ------- |
| model     | 36     | 0         | 0       | 0             | 0         | **36**  |
| parser    | 6      | 10        | 0       | 0             | 0         | **16**  |
| context   | 8      | 10        | 4       | 5             | 4         | **31**  |
| profile   | 7      | 26        | 1       | 5             | 0         | **39**  |
| validator | 6      | 19        | 1       | 3             | 0         | **29**  |
| fhirpath  | 5      | 25        | 27      | 0             | 3         | **60**  |
| **Total** | **68** | **90**    | **33**  | **13**        | **7**     | **211** |

### 7.2 Top-Level Entry Point Exports

The following symbols are re-exported from `fhir-runtime` (the package entry point `src/index.ts`):

**From parser (16):**
`ParseSeverity` · `ParseErrorCode` · `ParseIssue` · `ParseResult` · `ChoiceValue` · `ChoiceTypeField` · `parseFhirJson` · `parseFhirObject` · `parseStructureDefinition` · `parseElementDefinition` · `serializeToFhirJson` · `serializeToFhirObject` · `parseSuccess` · `parseFailure` · `createIssue` · `hasErrors`

**From model (36):**
All 20 branded primitives · 13 enums · 16 base complex types · 9 ElementDefinition types · 5 StructureDefinition types · 7 CanonicalProfile types

**From context (31):**
`FhirContext` · `FhirContextOptions` · `StructureDefinitionLoader` · `LoaderOptions` · `ContextStatistics` · `BundleLoadOptions` · `BundleLoadResult` · `BundleLoadError` · `FhirContextImpl` · `MemoryLoader` · `FileSystemLoader` · `CompositeLoader` · 5 error classes · `loadBundleFromObject` · `loadBundleFromFile` · `loadBundlesFromFiles` · `extractInnerTypes` · `buildTypeName` · `isBackboneElementType` · `createEmptyStatistics` · 4 constants · 4 core-definition functions

**From profile (39):**
`SnapshotGeneratorOptions` · `SnapshotResult` · `SnapshotIssue` · `SnapshotIssueCode` · `DiffElementTracker` · `TraversalScope` · `MergeContext` · `SnapshotGenerator` · 6 canonical-builder functions · 5 error classes · 2 type helpers · 11 path utilities · 4 element-sorter functions · 7 constraint-merger functions · 3 element-merger functions · 6 slicing-handler functions

**From validator (13):**
`ValidationOptions` · `ValidationResult` · `ValidationIssue` · `ValidationIssueCode` · `StructureValidator` · `createValidationIssue` · `resolveValidationOptions` · `hasValidationErrors` · `extractValues` · `ProfileNotFoundError` · `ValidationFailedError`

### 7.3 Stability Classification

| Classification      | Meaning                               | Modules                                    |
| ------------------- | ------------------------------------- | ------------------------------------------ |
| **Frozen**          | No changes in v0.2.x                  | model, parser, context, profile, validator |
| **Stable-Internal** | Used by validator; may refine in v0.3 | fhirpath                                   |
| **Type-Only**       | No runtime impact; safe to extend     | model (all type exports)                   |

---

## 8. Version History

### v0.2.0 (2026-03-04)

- Renamed from `@medxai/fhir-core` to `fhir-runtime`
- Changed license from Apache-2.0 to MIT
- Extensive testing added: US Core IG verification, stress tests, comprehensive pipeline tests
- Updated package metadata and repository information
- All API surface remains compatible with v0.1.0

### v0.1.0 (Initial Release)

- Initial release as `@medxai/fhir-core`
- Complete FHIR R4 parsing, validation, snapshot generation, and FHIRPath support
