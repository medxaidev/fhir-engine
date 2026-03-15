# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-03-15

### Fixed

- **`resolvePackages()` — 0 resource types after cache linking** — When the system cache package was installed by third-party tools (e.g. Firely Terminal) that only place `package.json` inside the `package/` subdirectory (not at cache root), `PackageScanner` would discover the package at the wrong depth, causing `PackageLoader` to construct a double-nested `package/package` path → ENOENT → 0 StructureDefinitions loaded → 0 tables created → `no such table: Patient_References`
- **New helper `ensureCacheRootManifest()`** — Copies `package/package.json` to cache root before creating junction/symlink, ensuring consistent structure regardless of which tool populated the cache

### Changed

- **Test suite expanded** — from 95 to 96 tests:
  - New test: verify cache root `package.json` exists after resolve (Firely Terminal scenario)

### Notes

- Resolves `FIX_ZERO_RESOURCE_TYPES.md` — Method A fix applied in `fhir-engine`; optional Method B (fhir-definition scanner hardening) deferred to P1

---

## [0.4.0] - 2026-03-15

### Added

- **`resolvePackages(config, options?)`** — New top-level API that ensures FHIR IG packages are available in the project's `packages.path` directory before engine bootstrap. Resolution order: local → system cache (`~/.fhir/packages`) → FHIR Package Registry download. Returns `ResolvePackagesResult` with per-package status and errors.
- **`config.igs`** — New optional `FhirEngineConfig` field listing IG packages to resolve (e.g. `[{ name: 'hl7.fhir.r4.core', version: '4.0.1' }]`). When set, `createFhirEngine()` automatically calls `resolvePackages()` before loading definitions.
- **`config.packageResolve`** — New optional config field for resolution options (e.g. `{ allowDownload: false }` for offline mode).
- **Type exports** — `ResolvePackagesOptions`, `ResolvedPackage`, `ResolvePackagesResult`
- **New source file** — `src/package-resolver.ts`

### Changed

- **`createFhirEngine()` bootstrap** — Now includes a package resolution step (§1a) before loading definitions, triggered when `config.igs` is present. Backward compatible: omitting `igs` preserves v0.3.0 behavior.
- **Test suite expanded** — from 84 to 95 tests:
  - resolvePackages(): 11 tests covering local detection, cache linking, offline errors, idempotency, option overrides, directory creation, and re-export verification

### Notes

- Resolves `FHIR_ENGINE_RESOLVE_PACKAGES_API.md` — fhir-cli `fhir new` / `fhir ig install` workflows can now use `resolvePackages()` to ensure packages are available before engine startup
- Uses Windows `junction` links (no admin required) and Unix `symlink` for linking cached packages

---

## [0.3.0] - 2026-03-15

### Added

- **`engine.search(resourceType, queryParams, options?)`** — High-level FHIR search method on the engine instance; parses query parameters and executes search in one call, returning `SearchResult` with matched resources, includes, and optional total
- **Re-exported search utilities** — `parseSearchRequest`, `executeSearch` functions and `SearchRequest`, `SearchResult`, `SearchOptions` types from `fhir-persistence`
- **Re-exported FHIRPath functions** — `evalFhirPath`, `evalFhirPathBoolean`, `evalFhirPathString`, `evalFhirPathTyped` from `fhir-runtime`

### Changed

- **Test suite expanded** — from 73 to 84 tests:
  - engine.search(): 6 tests
  - Re-exported API verification: 5 tests (evalFhirPath, evalFhirPathBoolean, evalFhirPathString, parseSearchRequest, executeSearch)

### Notes

- Resolves `FHIR_ENGINE_API_GAP_REQUEST.md` — fhir-cli can now import search and FHIRPath APIs from `fhir-engine` without violating the Layer 1 import restriction

---

## [0.2.0] - 2026-03-15

### Added

- **`engine.status()`** — Returns `FhirEngineStatus` with `fhirVersions`, `loadedPackages`, `resourceTypes`, `databaseType`, `igAction`, `startedAt`, and `plugins` — enables `fhir doctor` and `/metadata` endpoints
- **`FhirEngineStatus`** type export

### Changed

- **Test suite expanded** — from 38 to 73 tests across 3 test files, meeting the 5+ per critical path requirement:
  - Config validation: 6 tests
  - Bootstrap sequence: 7 tests
  - Plugin init() failure: 5 tests
  - Plugin start() failure: 5 tests
  - Plugin stop() reverse order: 5 tests
  - engine.stop() idempotency: 5 tests
  - E2E CRUD: 7 tests
  - engine.status(): 8 tests

---

## [0.1.0] - 2026-03-15

### Added

- **Core Bootstrap** — `createFhirEngine(config?)` assembles fhir-definition, fhir-runtime, and fhir-persistence into a running system from a single configuration object
- **Plugin System** — `FhirEnginePlugin` interface with lifecycle hooks (`init` / `start` / `ready` / `stop`), registration-order execution, reverse-order shutdown, and error isolation
- **Config File Support** — `defineConfig()` type helper, `loadFhirConfig()` auto-discovery (`fhir.config.ts` → `.js` → `.mjs` → `.json`), and environment variable overrides (`FHIR_DATABASE_TYPE`, `FHIR_DATABASE_URL`, `FHIR_PACKAGES_PATH`)
- **Zero-arg bootstrap** — `createFhirEngine()` with no arguments auto-loads config from cwd
- **Adapter Factory** — `createAdapter()` supporting `sqlite` (BetterSqlite3Adapter), `sqlite-wasm` (SQLiteAdapter), with clear error for unsupported `postgres`
- **Logger** — pluggable `Logger` interface with `createConsoleLogger()` default
- **EngineContext** — shared context object (`config`, `definitions`, `runtime`, `adapter`, `persistence`, `logger`) injected into all plugin hooks
- **Type exports** — `FhirEngine`, `FhirEngineConfig`, `FhirEnginePlugin`, `EngineContext`, `DatabaseConfig`, `Logger`, and re-exported upstream types
- **Dual build** — ESM (`.mjs`) + CJS (`.cjs`) with bundled `.d.ts` type declarations

### Known Issues

- **PostgreSQL adapter** — `PostgresAdapter` is not exported from `fhir-persistence@0.1.0`; `database.type = 'postgres'` throws a descriptive error
- **fhir-runtime core JSON** — `fhir-runtime@0.8.x` npm package is missing bundled core definition JSON files; workaround: `preloadCore: false` (applied automatically)
