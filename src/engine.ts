import { loadDefinitionPackages } from 'fhir-definition';
import { createRuntime, extractSearchValues, extractAllSearchValues, extractReferences } from 'fhir-runtime';
import { FhirDefinitionBridge, FhirRuntimeProvider, FhirSystem, parseSearchRequest, executeSearch } from 'fhir-persistence';

import { createAdapter } from './adapter-factory.js';
import { loadFhirConfig } from './config.js';
import { createConsoleLogger } from './logger.js';
import { resolvePackages } from './package-resolver.js';
import type { EngineContext, FhirEngine, FhirEngineConfig, FhirEnginePlugin, FhirEngineStatus } from './types.js';

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
 * Run a lifecycle hook on all plugins in order.
 * Wraps errors with the plugin name for clear diagnostics.
 */
async function runPluginHook(
  plugins: FhirEnginePlugin[],
  hook: 'init' | 'start' | 'ready',
  ctx: EngineContext,
): Promise<void> {
  for (const plugin of plugins) {
    const fn = plugin[hook];
    if (fn) {
      try {
        await fn.call(plugin, ctx);
      } catch (err) {
        throw new Error(
          `fhir-engine: plugin "${plugin.name}" failed during ${hook}: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        );
      }
    }
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
export async function createFhirEngine(config?: FhirEngineConfig): Promise<FhirEngine> {
  // ── 0. Resolve config ────────────────────────────────────────
  if (!config) {
    config = await loadFhirConfig();
  }
  validateConfig(config);

  const logger = config.logger ?? createConsoleLogger();
  const plugins = config.plugins ?? [];
  logger.info('Initializing fhir-engine...');

  // ── 1a. Resolve packages (download/link if config.igs is set) ─
  if (config.igs && config.igs.length > 0) {
    logger.info(`Resolving ${config.igs.length} IG package(s)...`);
    const resolveResult = await resolvePackages(config, { logger });
    for (const pkg of resolveResult.packages) {
      logger.info(`Resolved ${pkg.name}@${pkg.version} (${pkg.source})`);
    }
    if (!resolveResult.success) {
      for (const err of resolveResult.errors) {
        logger.warn(`Failed to resolve package ${err.name}: ${err.error}`);
      }
    }
  }

  // ── 1b. Load FHIR definitions ─────────────────────────────────
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
  const adapter = await createAdapter(config.database, logger);

  // ── 5. Build EngineContext ──────────────────────────────────
  const ctx: { -readonly [K in keyof EngineContext]: EngineContext[K] } = {
    config,
    definitions: registry,
    runtime,
    adapter,
    persistence: undefined,
    logger,
  };

  // ── 6. INIT phase — plugins run before persistence ──────────
  if (plugins.length > 0) {
    logger.info(`Running init for ${plugins.length} plugin(s): ${plugins.map((p) => p.name).join(', ')}`);
    await runPluginHook(plugins, 'init', ctx);
  }

  // ── 7. Initialize FhirSystem ────────────────────────────────
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

  // Fail fast if IG migration had errors (tables not created)
  if (igResult.error) {
    throw new Error(
      `fhir-engine: schema migration failed: ${igResult.error}`,
    );
  }

  logger.info(`Persistence ready — IG action: ${igResult.action}, ${resourceTypes.length} resource type(s)`);

  // ctx.persistence now available
  ctx.persistence = persistence;

  // ── 8. START phase — plugins can access persistence ─────────
  if (plugins.length > 0) {
    logger.info(`Running start for ${plugins.length} plugin(s)...`);
    await runPluginHook(plugins, 'start', ctx);
  }

  // ── 9. READY phase — system fully operational ───────────────
  if (plugins.length > 0) {
    logger.info(`Running ready for ${plugins.length} plugin(s)...`);
    await runPluginHook(plugins, 'ready', ctx);
  }

  // ── 10. Return FhirEngine ───────────────────────────────────
  let stopped = false;
  const startedAt = new Date();
  const loadedPackages = result.packages.map((p) => `${p.name}@${p.version}`);
  const fhirVersions = [...new Set(
    result.packages
      .map((p) => {
        if (p.name.includes('.r4.')) return '4.0';
        if (p.name.includes('.r4b.')) return '4.3';
        if (p.name.includes('.r5.')) return '5.0';
        return undefined;
      })
      .filter(Boolean),
  )] as string[];

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
    context: ctx as EngineContext,

    async search(resourceType, queryParams, options) {
      const request = parseSearchRequest(resourceType, queryParams, spRegistry);
      return executeSearch(adapter, request, spRegistry, options);
    },

    status(): FhirEngineStatus {
      return {
        fhirVersions,
        loadedPackages,
        resourceTypes,
        databaseType: config.database.type,
        igAction: igResult.action,
        startedAt,
        plugins: plugins.map((p) => p.name),
      };
    },

    async stop() {
      if (stopped) return;
      stopped = true;
      logger.info('Stopping fhir-engine...');

      // Stop plugins in reverse registration order
      for (let i = plugins.length - 1; i >= 0; i--) {
        const plugin = plugins[i];
        if (plugin.stop) {
          try {
            await plugin.stop.call(plugin, ctx as EngineContext);
          } catch (err) {
            logger.error(
              `Plugin "${plugin.name}" failed during stop: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      await adapter.close();
      logger.info('fhir-engine stopped.');
    },
  };

  logger.info('fhir-engine ready.');
  return engine;
}
