# API Reference — fhir-definition v0.5.0

Complete API documentation for all exported types, classes, and functions.

---

## Table of Contents

- [Types](#types)
  - [Core Types](#core-types)
  - [Package Registry & Cache (v0.5.0)](#package-registry--cache-v050)
- [Interfaces](#interfaces)
- [Classes](#classes)
  - [Core Classes](#core-classes)
  - [Package Registry & Cache (v0.5.0)](#package-registry--cache-classes-v050)
- [Functions](#functions)
- [Enums & Constants](#enums--constants)

---

## Types

### Core Types

#### FhirDefinitionResourceType

```typescript
type FhirDefinitionResourceType =
  | "StructureDefinition"
  | "ValueSet"
  | "CodeSystem"
  | "SearchParameter";
```

Supported FHIR definition resource types.

---

#### FhirDefinitionResource

```typescript
interface FhirDefinitionResource {
  resourceType: FhirDefinitionResourceType;
  url: string;
  version?: string;
  name?: string;
  [key: string]: unknown;
}
```

Base interface for all FHIR definition resources.

---

### StructureDefinition

```typescript
interface StructureDefinition extends FhirDefinitionResource {
  resourceType: "StructureDefinition";
  type?: string;
  kind?: "primitive-type" | "complex-type" | "resource" | "logical";
  baseDefinition?: string;
  snapshot?: unknown;
  differential?: unknown;
}
```

FHIR StructureDefinition resource (profiles, extensions, resources).

---

### ValueSet

```typescript
interface ValueSet extends FhirDefinitionResource {
  resourceType: "ValueSet";
  status?: string;
  compose?: unknown;
  expansion?: unknown;
}
```

FHIR ValueSet resource. **Note:** `fhir-definition` does not perform expansion.

---

### CodeSystem

```typescript
interface CodeSystem extends FhirDefinitionResource {
  resourceType: "CodeSystem";
  status?: string;
  content?: string;
  concept?: Array<{
    code: string;
    display?: string;
    definition?: string;
    concept?: unknown[];
  }>;
}
```

FHIR CodeSystem resource with hierarchical concept tree.

---

### SearchParameter

```typescript
interface SearchParameter extends FhirDefinitionResource {
  resourceType: "SearchParameter";
  code?: string;
  base?: string[];
  type?: string;
  expression?: string;
  description?: string;
}
```

FHIR SearchParameter resource.

---

### ConceptInfo

```typescript
interface ConceptInfo {
  code: string;
  display?: string;
  definition?: string;
  system: string;
}
```

Result type for `CodeSystemResolver.lookupCode()`.

---

### DefinitionPackage

```typescript
interface DefinitionPackage {
  name: string;
  version: string;
  path: string;
  dependencies: Record<string, string>;
}
```

Parsed package manifest.

---

### LoadedPackage

```typescript
interface LoadedPackage {
  name: string;
  version: string;
  path: string;
  definitionCount: number;
  loadedAt: Date;
}
```

Metadata for a successfully loaded package.

---

### RegistryStatistics

```typescript
interface RegistryStatistics {
  structureDefinitionCount: number;
  valueSetCount: number;
  codeSystemCount: number;
  searchParameterCount: number;
  packageCount: number;
}
```

Registry content statistics.

---

### LoadError

```typescript
interface LoadError {
  code: LoadErrorCode;
  message: string;
  path?: string;
  details?: unknown;
}
```

Error object returned by loaders (no-throw contract).

---

### LoadPackagesOptions

```typescript
interface LoadPackagesOptions {
  scanOptions?: PackageScanOptions;
  resourceTypes?: FhirDefinitionResourceType[];
}
```

Options for `loadDefinitionPackages()` and `PackageManager.loadPackages()`.

---

### LoadPackagesOutput

```typescript
interface LoadPackagesOutput {
  registry: DefinitionRegistry;
  result: LoadPackagesResult;
}
```

Return type for `loadDefinitionPackages()`.

---

## Interfaces

### DefinitionRegistry

Central read/write interface for FHIR definitions.

```typescript
interface DefinitionRegistry {
  // Write
  register(resource: FhirDefinitionResource): void;
  registerPackage(pkg: LoadedPackage): void;

  // StructureDefinition
  getStructureDefinition(url: string): StructureDefinition | undefined;
  getStructureDefinitionByVersion(
    url: string,
    version: string,
  ): StructureDefinition | undefined;
  hasStructureDefinition(url: string): boolean;
  listStructureDefinitions(): string[];

  // ValueSet
  getValueSet(url: string): ValueSet | undefined;
  hasValueSet(url: string): boolean;
  listValueSets(): string[];

  // CodeSystem
  getCodeSystem(url: string): CodeSystem | undefined;
  hasCodeSystem(url: string): boolean;
  listCodeSystems(): string[];

  // SearchParameter
  getSearchParameters(resourceType: string): SearchParameter[];
  getSearchParameter(
    resourceType: string,
    name: string,
  ): SearchParameter | undefined;
  getSearchParameterByUrl(url: string): SearchParameter | undefined;

  // Metadata
  getLoadedPackages(): LoadedPackage[];
  getStatistics(): RegistryStatistics;
}
```

**Implementation:** `InMemoryDefinitionRegistry`

---

### DefinitionProvider

Minimal interface for `fhir-runtime` integration (structural typing).

```typescript
interface DefinitionProvider {
  getStructureDefinition(url: string): StructureDefinition | undefined;
  getValueSet(url: string): ValueSet | undefined;
  getCodeSystem(url: string): CodeSystem | undefined;
  getSearchParameters(resourceType: string): SearchParameter[];
}
```

**Note:** `InMemoryDefinitionRegistry` satisfies this interface without explicit `implements`.

---

## Classes

### InMemoryDefinitionRegistry

In-memory implementation of `DefinitionRegistry`.

```typescript
class InMemoryDefinitionRegistry implements DefinitionRegistry {
  constructor();

  // All DefinitionRegistry methods
  // See interface documentation above
}
```

**Index structures:**

- SD main index: `Map<url, StructureDefinition>`
- SD version index: `Map<url, Map<version, StructureDefinition>>`
- VS index: `Map<url, ValueSet>`
- CS index: `Map<url, CodeSystem>`
- SP dual index: `Map<resourceType, Map<name, SearchParameter>>` + `Map<url, SearchParameter>`

**Performance:** O(1) lookups for all queries.

---

### FileLoader

Loads a single FHIR JSON file.

```typescript
class FileLoader {
  loadFile(filePath: string): LoadFileResult;
}
```

**Returns:** `{ resource?, error? }` (no-throw contract)

---

### DirectoryLoader

Loads all JSON files from a directory.

```typescript
class DirectoryLoader {
  loadDirectory(
    dirPath: string,
    options?: LoadDirectoryOptions,
  ): LoadDirectoryResult;
}
```

**Options:**

- `extensions?: string[]` — File extensions to load (default: `['.json']`)

**Returns:** `{ resources: FhirDefinitionResource[], errors: LoadError[] }`

---

### PackageScanner

Scans directories for FHIR packages.

```typescript
class PackageScanner {
  scan(rootPath: string, options?: PackageScanOptions): PackageScanResult;
}
```

**Options:**

- `recursive?: boolean` — Scan subdirectories (default: `true`)
- `maxDepth?: number` — Maximum recursion depth (default: `Infinity`)

**Returns:** `{ packages: DefinitionPackage[], errors: LoadError[] }`

---

### DependencyResolver

Resolves package dependencies using topological sort (Kahn's algorithm).

```typescript
class DependencyResolver {
  resolve(packages: DefinitionPackage[]): DependencyResolutionResult;
}
```

**Returns:** `{ sortedPackages: DefinitionPackage[], errors: LoadError[], warnings: string[] }`

**Errors:**

- `CIRCULAR_DEPENDENCY` — Cycle detected
- `MISSING_DEPENDENCY` — Warning only (non-fatal)

---

### PackageLoader

Loads definitions from a single package.

```typescript
class PackageLoader {
  loadPackage(
    pkg: DefinitionPackage,
    options?: { resourceTypes?: FhirDefinitionResourceType[] },
  ): PackageLoadResult;
}
```

**Returns:** `{ resources: FhirDefinitionResource[], errors: LoadError[] }`

---

### PackageManager

Orchestrates full package loading pipeline.

```typescript
class PackageManager {
  constructor(registry?: InMemoryDefinitionRegistry);

  loadPackages(
    rootPath: string,
    options?: LoadPackagesOptions,
  ): LoadPackagesOutput;
  getRegistry(): DefinitionRegistry;
  getLoadedPackages(): LoadedPackage[];
}
```

**Pipeline:**

1. Scan packages (`PackageScanner`)
2. Resolve dependencies (`DependencyResolver`)
3. Load each package (`PackageLoader`)
4. Register resources (`registry.register()`)
5. Register package metadata (`registry.registerPackage()`)

---

### StructureDefinitionResolver

High-level query API for StructureDefinitions.

```typescript
class StructureDefinitionResolver {
  constructor(registry: DefinitionRegistry);

  resolve(url: string): StructureDefinition | undefined;
  resolveVersioned(
    url: string,
    version?: string,
  ): StructureDefinition | undefined;
  list(): string[];
}
```

**`resolveVersioned()` supports `url|version` format:**

- `resolveVersioned('http://url|4.0.1')` → version `4.0.1`
- `resolveVersioned('http://url', '4.0.1')` → version `4.0.1`
- Pipe format takes precedence over explicit parameter

---

### ValueSetResolver

High-level query API for ValueSets.

```typescript
class ValueSetResolver {
  constructor(registry: DefinitionRegistry);

  resolve(url: string): ValueSet | undefined;
  list(): string[];
}
```

**Note:** Does not perform expansion. Returns raw ValueSet.

---

### CodeSystemResolver

High-level query API for CodeSystems.

```typescript
class CodeSystemResolver {
  constructor(registry: DefinitionRegistry);

  resolve(url: string): CodeSystem | undefined;
  lookupCode(system: string, code: string): ConceptInfo | undefined;
  list(): string[];
}
```

**`lookupCode()` performs recursive search** through nested concept trees.

---

### SearchParameterResolver

High-level query API for SearchParameters.

```typescript
class SearchParameterResolver {
  constructor(registry: DefinitionRegistry);

  resolveByResourceType(resourceType: string): SearchParameter[];
  resolveByName(
    resourceType: string,
    name: string,
  ): SearchParameter | undefined;
  resolveByUrl(url: string): SearchParameter | undefined;
  getAllResourceTypes(): string[];
  listAll(): SearchParameter[];
}
```

**`listAll()` returns deduplicated** SearchParameters (multi-base SPs appear once).

---

## Functions

### loadFromDirectory

Convenience function to load all definitions from a directory.

```typescript
function loadFromDirectory(
  dirPath: string,
  options?: LoadDirectoryOptions,
): DefinitionRegistry;
```

**Returns:** `InMemoryDefinitionRegistry` with all loaded resources.

**Example:**

```typescript
const registry = loadFromDirectory("./definitions");
```

---

### loadDefinitionPackages

Convenience function to load multi-package structure with dependency resolution.

```typescript
function loadDefinitionPackages(
  rootPath: string,
  options?: LoadPackagesOptions,
): LoadPackagesOutput;
```

**Returns:** `{ registry: DefinitionRegistry, result: LoadPackagesResult }`

**Example:**

```typescript
const { registry, result } = loadDefinitionPackages("./definitions");
console.log(result.loadedPackages); // [{ name: 'r4.core', ... }, ...]
```

---

## Enums & Constants

### LoadErrorCode

```typescript
enum LoadErrorCode {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  INVALID_JSON = "INVALID_JSON",
  NOT_FHIR_RESOURCE = "NOT_FHIR_RESOURCE",
  UNSUPPORTED_RESOURCE_TYPE = "UNSUPPORTED_RESOURCE_TYPE",
  CIRCULAR_DEPENDENCY = "CIRCULAR_DEPENDENCY",
  MISSING_DEPENDENCY = "MISSING_DEPENDENCY",
  INVALID_MANIFEST = "INVALID_MANIFEST",
}
```

Error codes returned by loaders.

---

### SUPPORTED_RESOURCE_TYPES

```typescript
const SUPPORTED_RESOURCE_TYPES: readonly FhirDefinitionResourceType[] = [
  "StructureDefinition",
  "ValueSet",
  "CodeSystem",
  "SearchParameter",
];
```

List of supported FHIR definition resource types.

---

## Usage Patterns

### Pattern 1: Simple Directory Loading

```typescript
import { loadFromDirectory } from "fhir-definition";

const registry = loadFromDirectory("./my-definitions");
const patient = registry.getStructureDefinition(
  "http://hl7.org/fhir/StructureDefinition/Patient",
);
```

### Pattern 2: Multi-Package with Dependencies

```typescript
import { loadDefinitionPackages } from "fhir-definition";

const { registry, result } = loadDefinitionPackages("./definitions");

// Check for errors
if (result.errors.length > 0) {
  console.error("Load errors:", result.errors);
}

// Query loaded packages
console.log(
  "Loaded packages:",
  result.loadedPackages.map((p) => p.name),
);
```

### Pattern 3: Runtime Integration

```typescript
import {
  loadDefinitionPackages,
  type DefinitionProvider,
} from "fhir-definition";

const { registry } = loadDefinitionPackages("./definitions");

// Pass to runtime (structural typing)
const provider: DefinitionProvider = registry;
const runtime = new FhirRuntime({ definitions: provider });
```

### Pattern 4: Advanced Queries with Resolvers

```typescript
import {
  loadFromDirectory,
  StructureDefinitionResolver,
  SearchParameterResolver,
} from "fhir-definition";

const registry = loadFromDirectory("./definitions");
const sdResolver = new StructureDefinitionResolver(registry);
const spResolver = new SearchParameterResolver(registry);

// Version-aware SD resolution
const patientV4 = sdResolver.resolveVersioned(
  "http://hl7.org/fhir/StructureDefinition/Patient|4.0.1",
);
const patientV5 = sdResolver.resolveVersioned(
  "http://hl7.org/fhir/StructureDefinition/Patient|5.0.0",
);

// Get all SPs for a resource type
const patientSPs = spResolver.resolveByResourceType("Patient");

// Get all resource types with SPs
const resourceTypes = spResolver.getAllResourceTypes();
```

---

## Performance Characteristics

| Operation                           | Complexity                 | Typical Time        |
| ----------------------------------- | -------------------------- | ------------------- |
| `register()`                        | O(1)                       | <0.01ms             |
| `getStructureDefinition()`          | O(1)                       | <0.01ms             |
| `getStructureDefinitionByVersion()` | O(1)                       | <0.01ms             |
| `getSearchParameters()`             | O(1)                       | <0.1ms              |
| `lookupCode()`                      | O(n) worst case            | <1ms (small trees)  |
| `loadFromDirectory()`               | O(n) files                 | <100ms (15 files)   |
| `loadDefinitionPackages()`          | O(n) packages + O(e) edges | <200ms (3 packages) |

Where:

- n = number of items
- e = number of dependency edges

---

## Error Handling

All loaders follow a **no-throw contract**:

```typescript
// ✅ Good: Check for errors
const result = loader.loadFile("./file.json");
if (result.error) {
  console.error("Load failed:", result.error.message);
} else {
  registry.register(result.resource!);
}

// ❌ Bad: Loaders never throw
try {
  loader.loadFile("./nonexistent.json"); // Returns { error: ... }, doesn't throw
} catch (e) {
  // This will never execute
}
```

---

## TypeScript Tips

### Narrow Resource Types

```typescript
const resource = registry.getStructureDefinition(url);
if (resource && resource.resourceType === "StructureDefinition") {
  // TypeScript knows resource is StructureDefinition
  console.log(resource.type);
}
```

### Use Type Guards

```typescript
function isStructureDefinition(
  r: FhirDefinitionResource,
): r is StructureDefinition {
  return r.resourceType === "StructureDefinition";
}

const resources = directoryLoader.loadDirectory("./defs").resources;
const sds = resources.filter(isStructureDefinition);
```

---

## Migration Guide

### From v0.3.0 to v0.4.0

**New exports:**

- `DefinitionProvider` interface
- `ConceptInfo` type

**No breaking changes.** All v0.3.0 APIs remain unchanged.

---

## See Also

- [README.md](../README.md) — Quick start guide
- [CHANGELOG.md](../CHANGELOG.md) — Version history
- [ARCHITECTURE.md](../devdocs/ARCHITECTURE.md) — System design
