# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
