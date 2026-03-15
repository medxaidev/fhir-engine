# fhir-runtime — API Reference v0.6

> **Package:** `fhir-runtime@0.6.0`  
> **FHIR Version:** R4 (4.0.1)  
> **Release Date:** 2026-03-09  
> **License:** MIT  
> **Node.js:** >=18.0.0  
> **Module Format:** ESM (primary) + CJS (compatibility)  
> **Companion Document:** `docs/specs/engine-capability-contract-v0.6.md`

This document is the public API reference for `fhir-runtime` at `v0.6.0`.

Compared with `v0.5.0`, this release adds the completed **IG Package & Canonical Resolution (STAGE-4)**:

- `NpmPackageLoader` — load FHIR IG packages from extracted NPM directories
- `PackageManager` — multi-package management with dependency resolution
- `parseCanonicalUrl()` / `resolveCanonical()` — version-aware canonical resolution
- `buildDependencyGraph()` — topological dependency sorting with cycle detection
- `parsePackageManifest()` / `parsePackageIndex()` — package metadata parsers

Any symbol not exported from `src/index.ts` remains internal and may change without notice.

---

## Table of Contents

1. [Top-Level Export Surface](#1-top-level-export-surface)
2. [Modules 2–8: Unchanged](#2-8-modules-unchanged)
3. [Module: terminology](#9-module-terminology)
4. [Module: package](#10-module-package)
5. [Module: pipeline](#11-module-pipeline)
6. [v0.6 Additions](#12-v06-additions)
7. [Compatibility Notes](#13-compatibility-notes)

---

## 1. Top-Level Export Surface

### 1.1 Core Runtime Exports

- `model`, `parser`, `context`, `profile`, `validator`, `fhirpath`
- `provider` (STAGE-1: v0.3.0)
- `terminology` (STAGE-3: v0.5.0)
- `package` (STAGE-4: v0.6.0) ← **new**
- `pipeline` (STAGE-2: v0.4.0)

### 1.2 Export Count

| Version | Type Exports | Value Exports | Total |
|---------|-------------|---------------|-------|
| v0.3.0  | 130         | 97            | 227   |
| v0.4.0  | 144         | 105           | 249   |
| v0.5.0  | 155         | 115           | 270   |
| v0.6.0  | 165         | 131           | ~296  |

---

## 2–8. Modules: model, parser, context, profile, validator, fhirpath, provider

See [fhir-runtime-api-v0.5.md](./fhir-runtime-api-v0.5.md) — unchanged from v0.5.

---

## 9. Module: terminology

See [fhir-runtime-api-v0.5.md](./fhir-runtime-api-v0.5.md) — unchanged from v0.5.

---

## 10. Module: package

**Source:** `src/package/`  
**Added in:** v0.6.0 (STAGE-4)  
**Dependency direction:** `package → model, parser, context`

### 10.1 Types

| Type | Description |
|------|-------------|
| `PackageManifest` | Parsed FHIR NPM package `package.json` (name, version, fhirVersions, dependencies, etc.) |
| `PackageIndex` | Parsed `.index.json` (indexVersion, files) |
| `PackageIndexEntry` | Single entry in index (filename, resourceType, id, url, version, kind, type) |
| `NpmPackageLoaderOptions` | Loader options (resourceTypes filter, useIndex, loadSnapshots) |
| `PackageManagerOptions` | Manager options (packageCachePath) |
| `PackageInfo` | Registered package info (name, version, path, manifest, resourceCount) |
| `DependencyGraph` | Dependency graph (root, nodes, topological order) |
| `DependencyNode` | Graph node (name, version, dependencies list) |
| `CanonicalResolution` | Resolution result (url, version, packageName, packageVersion, resourceType, filename) |

### 10.2 Classes

#### `NpmPackageLoader`

Implements `StructureDefinitionLoader`. Loads resources from extracted FHIR IG NPM packages.

```typescript
class NpmPackageLoader implements StructureDefinitionLoader {
  constructor(packagePath: string, options?: NpmPackageLoaderOptions);
  // StructureDefinitionLoader interface
  load(url: string): Promise<StructureDefinition | null>;
  canLoad(url: string): boolean;
  getSourceType(): string; // 'npm-package'
  // Package-specific
  getManifest(): PackageManifest | undefined;
  getIndex(): PackageIndex | undefined;
  getEntries(): PackageIndexEntry[];
  getEntriesByType(resourceType: string): PackageIndexEntry[];
  loadAllStructureDefinitions(): Promise<StructureDefinition[]>;
  loadAllValueSets(): Promise<unknown[]>;
  loadAllCodeSystems(): Promise<unknown[]>;
  loadResource(url: string): Promise<unknown | null>;
  resolveCanonical(url: string): PackageIndexEntry | undefined;
  readonly packagePath: string;
  readonly resourceCount: number;
}
```

#### `PackageManager`

Multi-package management with dependency resolution and canonical URL resolution.

```typescript
class PackageManager {
  constructor(options?: PackageManagerOptions);
  registerPackage(packagePath: string): Promise<PackageInfo>;
  discoverPackages(cachePath?: string): Promise<PackageInfo[]>;
  resolveDependencies(packageName: string): DependencyGraph;
  resolveCanonical(url: string): CanonicalResolution | undefined;
  resolveAllByType(resourceType: string): CanonicalResolution[];
  createLoader(): StructureDefinitionLoader;
  getPackages(): PackageInfo[];
  hasPackage(name: string): boolean;
  getPackageLoader(name: string): NpmPackageLoader | undefined;
  readonly packageCount: number;
  clear(): void;
}
```

### 10.3 Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `parsePackageManifest` | `(raw) → PackageManifest \| undefined` | Parse raw JSON into typed manifest |
| `parsePackageManifestFromString` | `(json) → PackageManifest \| undefined` | Parse JSON string into manifest |
| `parsePackageIndex` | `(raw) → PackageIndex \| undefined` | Parse raw JSON into typed index |
| `parsePackageIndexFromString` | `(json) → PackageIndex \| undefined` | Parse JSON string into index |
| `filterIndexByResourceType` | `(index, types) → PackageIndexEntry[]` | Filter index entries by type |
| `buildDependencyGraph` | `(root, manifests) → DependencyGraph` | Build dependency graph with topo sort |
| `topologicalSort` | `(nodes) → string[]` | Sort nodes in dependency order |
| `findMissingDependencies` | `(graph, available) → string[]` | Find unresolved dependencies |
| `parseCanonicalUrl` | `(canonical) → { url, version? }` | Split `url\|version` format |
| `resolveCanonical` | `(canonical, loaders) → CanonicalResolution?` | Version-aware cross-package resolution |
| `resolveAllByType` | `(type, loaders) → CanonicalResolution[]` | Find all resources of a type |

### 10.4 Constants

| Constant | Type | Description |
|----------|------|-------------|
| `CONFORMANCE_RESOURCE_TYPES` | `readonly string[]` | Default conformance resource types for IG packages |

### 10.5 Error Classes

| Class | Description |
|-------|-------------|
| `CircularPackageDependencyError` | Thrown when circular dependency detected; includes `cycle` path |

---

## 11. Module: pipeline

See [fhir-runtime-api-v0.4.md](./fhir-runtime-api-v0.4.md) — unchanged from v0.4.

---

## 12. v0.6 Additions

### 12.1 New Type Exports (10)

```typescript
export type {
  PackageManifest, PackageIndex, PackageIndexEntry,
  NpmPackageLoaderOptions, PackageManagerOptions,
  PackageInfo, DependencyGraph, DependencyNode, CanonicalResolution,
} from './package/index.js';
```

### 12.2 New Value Exports (16)

```typescript
export {
  CONFORMANCE_RESOURCE_TYPES,
  NpmPackageLoader, PackageManager,
  parsePackageManifest, parsePackageManifestFromString,
  parsePackageIndex, parsePackageIndexFromString, filterIndexByResourceType,
  buildDependencyGraph, topologicalSort, findMissingDependencies,
  CircularPackageDependencyError,
  parseCanonicalUrl, resolveCanonical, resolveAllByType,
} from './package/index.js';
```

---

## 13. Compatibility Notes

- All v0.5.0 exports remain available and unchanged
- `NpmPackageLoader` implements `StructureDefinitionLoader` — drop-in compatible with `CompositeLoader`
- Zero runtime dependencies (unchanged)
- Node.js >=18.0.0 (unchanged)
- ESM primary + CJS compatibility (unchanged)
