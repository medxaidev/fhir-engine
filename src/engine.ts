import { loadDefinitionPackages } from 'fhir-definition';
import { createRuntime, extractSearchValues, extractAllSearchValues, extractReferences } from 'fhir-runtime';
import { FhirDefinitionBridge, FhirRuntimeProvider, FhirSystem } from 'fhir-persistence';

import { createAdapter } from './adapter-factory.js';
import { createConsoleLogger } from './logger.js';
import type { FhirEngine, FhirEngineConfig } from './types.js';

/**
 * Resolve the SQL dialect from the database config type.
 */
function resolveDialect(type: FhirEngineConfig['database']['type']): 'sqlite' | 'postgres' {
  switch (type) {
    case 'sqlite':
    case 'sqlite-wasm':
      return 'sqlite';
    case 'postgres':
      return 'postgres';
  }
}

/**
 * Validate the engine configuration, throwing on missing required fields.
 */
function validateConfig(config: FhirEngineConfig): void {
  if (!config.database) {
    throw new Error('fhir-engine: config.database is required');
  }
  if (!config.database.type) {
    throw new Error('fhir-engine: config.database.type is required (sqlite | sqlite-wasm | postgres)');
  }
  if (!config.packages) {
    throw new Error('fhir-engine: config.packages is required');
  }
  if (!config.packages.path) {
    throw new Error('fhir-engine: config.packages.path is required');
  }
}

/**
 * Create and bootstrap a fully initialized FHIR engine.
 *
 * This is the single entry point for all FHIR applications.
 * It assembles fhir-definition, fhir-runtime, and fhir-persistence
 * into a running system from a single configuration object.
 *
 * @example
 * ```ts
 * const engine = await createFhirEngine({
 *   database: { type: 'sqlite', path: ':memory:' },
 *   packages: { path: './fhir-packages' },
 * });
 *
 * const patient = await engine.persistence.createResource('Patient', {
 *   resourceType: 'Patient',
 *   name: [{ family: 'Smith', given: ['John'] }],
 * });
 *
 * await engine.stop();
 * ```
 */
export async function createFhirEngine(config: FhirEngineConfig): Promise<FhirEngine> {
  // ── 0. Validate ──────────────────────────────────────────────
  validateConfig(config);

  const logger = config.logger ?? createConsoleLogger();
  logger.info('Initializing fhir-engine...');

  // ── 1. Load FHIR definitions ─────────────────────────────────
  logger.info(`Loading FHIR packages from: ${config.packages.path}`);
  const { registry, result } = loadDefinitionPackages(config.packages.path);
  logger.info(
    `Loaded ${result.packages.length} package(s): ${result.packages.map((p) => `${p.name}@${p.version}`).join(', ')}`,
  );

  // ── 2. Create fhir-runtime ──────────────────────────────────
  logger.info('Creating fhir-runtime instance...');
  const runtime = await createRuntime({ definitions: registry, preloadCore: false });

  // ── 3. Build provider bridges ───────────────────────────────
  const definitionBridge = new FhirDefinitionBridge(registry);
  const runtimeProvider = new FhirRuntimeProvider({
    extractSearchValues,
    extractAllSearchValues,
    extractReferences,
  });

  // ── 4. Create storage adapter ───────────────────────────────
  const adapter = createAdapter(config.database, logger);

  // ── 5. Initialize FhirSystem ────────────────────────────────
  const dialect = resolveDialect(config.database.type);
  const system = new FhirSystem(adapter, {
    dialect,
    runtimeProvider,
    packageName: config.packageName ?? 'fhir-engine.default',
    packageVersion: config.packageVersion ?? '1.0.0',
  });

  logger.info('Initializing persistence system (schema + migration)...');
  const { persistence, sdRegistry, spRegistry, igResult, resourceTypes } =
    await system.initialize(definitionBridge);

  logger.info(`Persistence ready — IG action: ${igResult.action}, ${resourceTypes.length} resource type(s)`);

  // ── 6. Return FhirEngine ────────────────────────────────────
  let stopped = false;

  const engine: FhirEngine = {
    definitions: registry,
    runtime,
    adapter,
    persistence,
    sdRegistry,
    spRegistry,
    igResult,
    resourceTypes,
    logger,

    async stop() {
      if (stopped) return;
      stopped = true;
      logger.info('Stopping fhir-engine...');
      await adapter.close();
      logger.info('fhir-engine stopped.');
    },
  };

  logger.info('fhir-engine ready.');
  return engine;
}
