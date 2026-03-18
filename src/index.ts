// fhir-engine — public API

export { createFhirEngine } from './engine.js';
export { defineConfig, loadFhirConfig } from './config.js';
export { createConsoleLogger } from './logger.js';
export { createAdapter } from './adapter-factory.js';
export { resolvePackages } from './package-resolver.js';

export type {
  FhirEngine,
  FhirEngineConfig,
  FhirEnginePlugin,
  FhirEngineStatus,
  EngineContext,
  DatabaseConfig,
  SqliteDatabaseConfig,
  SqliteWasmDatabaseConfig,
  PostgresDatabaseConfig,
  PackagesConfig,
  Logger,
  ResolvePackagesOptions,
  ResolvedPackage,
  ResolvePackagesResult,
} from './types.js';

// Re-export key upstream types for convenience
export type { DefinitionRegistry, DefinitionProvider } from 'fhir-definition';
export type { FhirRuntimeInstance } from 'fhir-runtime';
export type { FhirPersistence, StorageAdapter } from 'fhir-persistence';

// ---------------------------------------------------------------------------
// Search utilities (from fhir-persistence)
// ---------------------------------------------------------------------------

export { parseSearchRequest, executeSearch } from 'fhir-persistence';
export type { SearchRequest, SearchResult, SearchOptions } from 'fhir-persistence';

// ---------------------------------------------------------------------------
// Reindex utilities (from fhir-persistence v0.6.0)
// ---------------------------------------------------------------------------

export { reindexResourceTypeV2, reindexAllV2 } from 'fhir-persistence';

// ---------------------------------------------------------------------------
// FHIRPath evaluation (from fhir-runtime)
// ---------------------------------------------------------------------------

export { evalFhirPath, evalFhirPathBoolean, evalFhirPathString, evalFhirPathTyped } from 'fhir-runtime';

// ---------------------------------------------------------------------------
// Batch validation (from fhir-runtime v0.9.0)
// ---------------------------------------------------------------------------

export type { BatchValidationOptions, BatchValidationResult } from 'fhir-runtime';

// ---------------------------------------------------------------------------
// Profile Slicing utilities (from fhir-runtime v0.10.0)
// ---------------------------------------------------------------------------

export { buildSlicingDefinition, makeExtensionSlicing, hasSliceName, extractSliceName, getSliceSiblings, validateSlicingCompatibility } from 'fhir-runtime';
export type { SlicingDefinition, SlicingDiscriminatorDef, SlicingRules } from 'fhir-runtime';

// ---------------------------------------------------------------------------
// Choice Type utilities (from fhir-runtime v0.10.0)
// ---------------------------------------------------------------------------

export { isChoiceTypePath, matchesChoiceType, extractChoiceTypeName } from 'fhir-runtime';
export type { ChoiceTypeField, ChoiceValue } from 'fhir-runtime';

// ---------------------------------------------------------------------------
// BackboneElement utilities (from fhir-runtime v0.10.0)
// ---------------------------------------------------------------------------

export { isBackboneElementType } from 'fhir-runtime';

// ---------------------------------------------------------------------------
// IG Extraction utilities (from fhir-runtime v0.11.0)
// ---------------------------------------------------------------------------

export { extractSDDependencies, extractElementIndexRows, flattenConceptHierarchy } from 'fhir-runtime';
export type { ElementIndexRow, ConceptRow } from 'fhir-runtime';

// ---------------------------------------------------------------------------
// Conformance module (from fhir-persistence v0.7.0)
// ---------------------------------------------------------------------------

export { IGResourceMapRepo, SDIndexRepo, ElementIndexRepo, ExpansionCacheRepo, ConceptHierarchyRepo, SearchParamIndexRepo, IGImportOrchestrator } from 'fhir-persistence';
export type { IGResourceMapEntry, IGIndex, SDIndexEntry, ElementIndexEntry, CachedExpansion, ConceptHierarchyEntry, IGImportResult } from 'fhir-persistence';
