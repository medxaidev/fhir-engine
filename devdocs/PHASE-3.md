# Phase 3 — Config File Support

Version: v0.3.0
Date: 2026-03-15
Status: ✅ Complete

---

## Goal

Support `fhir.config.ts` / `.js` / `.json` config files with environment variable overrides, enabling zero-arg `createFhirEngine()`.

---

## Design

### `defineConfig(config)` — Type Helper

Zero-overhead identity function that enables TypeScript autocompletion in config files:

```ts
// fhir.config.ts
import { defineConfig } from "fhir-engine";

export default defineConfig({
  database: { type: "sqlite", path: "./data/fhir.db" },
  packages: { path: "./fhir-packages" },
});
```

### `loadFhirConfig(path?)` — Config Discovery

Auto-discovers config file from cwd (or explicit path):

1. `fhir.config.ts` → loaded via `tsx` / dynamic import
2. `fhir.config.js` → loaded via dynamic import
3. `fhir.config.json` → loaded via `fs.readFileSync` + `JSON.parse`

If path is provided explicitly, loads only that file.

### Environment Variable Overrides

Applied on top of the loaded config, overriding matching fields:

| Env Variable         | Overrides                        | Example                             |
| -------------------- | -------------------------------- | ----------------------------------- |
| `FHIR_DATABASE_TYPE` | `config.database.type`           | `sqlite` / `postgres`               |
| `FHIR_DATABASE_URL`  | `config.database.path` or `.url` | `:memory:` / `postgresql://...`     |
| `FHIR_PACKAGES_PATH` | `config.packages.path`           | `./fhir-packages`                   |
| `FHIR_LOG_LEVEL`     | Logger filter level              | `debug` / `info` / `warn` / `error` |

### `createFhirEngine()` — Zero-Arg Overload

When called with no arguments, auto-loads config from cwd:

```ts
const engine = await createFhirEngine(); // discovers fhir.config.ts from cwd
```

---

## Implementation Plan

### New Files

| File                           | Purpose                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| `src/config.ts`                | `defineConfig()`, `loadFhirConfig()`, `applyEnvOverrides()` |
| `src/__tests__/config.test.ts` | Config loading and env override tests                       |

### Modified Files

| File            | Change                                                               |
| --------------- | -------------------------------------------------------------------- |
| `src/engine.ts` | Accept optional config param, call `loadFhirConfig()` when undefined |
| `src/index.ts`  | Export `defineConfig`, `loadFhirConfig`                              |

---

## Acceptance Criteria

| #   | Criterion                                                                                |
| --- | ---------------------------------------------------------------------------------------- |
| 1   | `defineConfig(config)` returns the config unchanged (identity function with type safety) |
| 2   | `loadFhirConfig()` discovers `fhir.config.json` from cwd                                 |
| 3   | `loadFhirConfig('./path/to/config.json')` loads explicit path                            |
| 4   | `FHIR_DATABASE_URL` overrides `database.path` / `database.url`                           |
| 5   | `FHIR_DATABASE_TYPE` overrides `database.type`                                           |
| 6   | `FHIR_PACKAGES_PATH` overrides `packages.path`                                           |
| 7   | Missing config file throws clear error                                                   |
| 8   | Invalid config (missing database) throws with existing validation message                |
| 9   | `createFhirEngine()` with no args calls `loadFhirConfig()` internally                    |
