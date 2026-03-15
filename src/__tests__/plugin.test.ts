import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { createFhirEngine } from '../engine.js';
import type { FhirEngine, FhirEngineConfig, FhirEnginePlugin, EngineContext } from '../types.js';

const FIXTURES_PATH = resolve(__dirname, 'fixtures');

function baseConfig(overrides?: Partial<FhirEngineConfig>): FhirEngineConfig {
  return {
    database: { type: 'sqlite', path: ':memory:' },
    packages: { path: FIXTURES_PATH },
    ...overrides,
  };
}

/** Silent logger to avoid console noise in tests. */
const silent = {
  debug: () => { },
  info: () => { },
  warn: () => { },
  error: () => { },
};

describe('Plugin System', () => {
  let engine: FhirEngine | undefined;

  afterEach(async () => {
    if (engine) {
      await engine.stop();
      engine = undefined;
    }
  });

  // ── Lifecycle ordering ─────────────────────────────────────────

  it('calls init → start → ready in registration order', async () => {
    const calls: string[] = [];

    const pluginA: FhirEnginePlugin = {
      name: 'a',
      async init() { calls.push('a:init'); },
      async start() { calls.push('a:start'); },
      async ready() { calls.push('a:ready'); },
    };
    const pluginB: FhirEnginePlugin = {
      name: 'b',
      async init() { calls.push('b:init'); },
      async start() { calls.push('b:start'); },
      async ready() { calls.push('b:ready'); },
    };

    engine = await createFhirEngine(baseConfig({ plugins: [pluginA, pluginB], logger: silent }));

    expect(calls).toEqual([
      'a:init', 'b:init',
      'a:start', 'b:start',
      'a:ready', 'b:ready',
    ]);
  });

  it('calls stop in reverse registration order', async () => {
    const calls: string[] = [];

    const pluginA: FhirEnginePlugin = {
      name: 'a',
      async stop() { calls.push('a:stop'); },
    };
    const pluginB: FhirEnginePlugin = {
      name: 'b',
      async stop() { calls.push('b:stop'); },
    };
    const pluginC: FhirEnginePlugin = {
      name: 'c',
      async stop() { calls.push('c:stop'); },
    };

    engine = await createFhirEngine(baseConfig({ plugins: [pluginA, pluginB, pluginC], logger: silent }));
    await engine.stop();
    engine = undefined; // prevent afterEach double-stop

    expect(calls).toEqual(['c:stop', 'b:stop', 'a:stop']);
  });

  // ── Context availability ───────────────────────────────────────

  it('ctx.persistence is undefined during init()', async () => {
    let persistenceInInit: unknown = 'sentinel';

    const plugin: FhirEnginePlugin = {
      name: 'check-init',
      async init(ctx: EngineContext) {
        persistenceInInit = ctx.persistence;
      },
    };

    engine = await createFhirEngine(baseConfig({ plugins: [plugin], logger: silent }));

    expect(persistenceInInit).toBeUndefined();
  });

  it('ctx.persistence is available during start()', async () => {
    let persistenceInStart: unknown;

    const plugin: FhirEnginePlugin = {
      name: 'check-start',
      async start(ctx: EngineContext) {
        persistenceInStart = ctx.persistence;
      },
    };

    engine = await createFhirEngine(baseConfig({ plugins: [plugin], logger: silent }));

    expect(persistenceInStart).toBeDefined();
  });

  it('ctx.persistence is available during ready()', async () => {
    let persistenceInReady: unknown;

    const plugin: FhirEnginePlugin = {
      name: 'check-ready',
      async ready(ctx: EngineContext) {
        persistenceInReady = ctx.persistence;
      },
    };

    engine = await createFhirEngine(baseConfig({ plugins: [plugin], logger: silent }));

    expect(persistenceInReady).toBeDefined();
  });

  it('engine.context is accessible and has persistence', async () => {
    engine = await createFhirEngine(baseConfig({ logger: silent }));

    expect(engine.context).toBeDefined();
    expect(engine.context.persistence).toBeDefined();
    expect(engine.context.definitions).toBeDefined();
    expect(engine.context.runtime).toBeDefined();
    expect(engine.context.adapter).toBeDefined();
    expect(engine.context.logger).toBeDefined();
    expect(engine.context.config).toBeDefined();
  });

  // ── Error handling ─────────────────────────────────────────────

  it('plugin throwing in init() aborts engine startup', async () => {
    const plugin: FhirEnginePlugin = {
      name: 'bad-init',
      async init() {
        throw new Error('init failed');
      },
    };

    await expect(
      createFhirEngine(baseConfig({ plugins: [plugin], logger: silent })),
    ).rejects.toThrow('plugin "bad-init" failed during init: init failed');
  });

  it('plugin throwing in start() aborts engine startup', async () => {
    const plugin: FhirEnginePlugin = {
      name: 'bad-start',
      async start() {
        throw new Error('start failed');
      },
    };

    await expect(
      createFhirEngine(baseConfig({ plugins: [plugin], logger: silent })),
    ).rejects.toThrow('plugin "bad-start" failed during start: start failed');
  });

  it('plugin throwing in ready() aborts engine startup', async () => {
    const plugin: FhirEnginePlugin = {
      name: 'bad-ready',
      async ready() {
        throw new Error('ready failed');
      },
    };

    await expect(
      createFhirEngine(baseConfig({ plugins: [plugin], logger: silent })),
    ).rejects.toThrow('plugin "bad-ready" failed during ready: ready failed');
  });

  it('plugin throwing in stop() logs error but does not prevent other plugins from stopping', async () => {
    const calls: string[] = [];
    const errors: string[] = [];

    const pluginA: FhirEnginePlugin = {
      name: 'a-stop-ok',
      async stop() { calls.push('a:stop'); },
    };
    const pluginB: FhirEnginePlugin = {
      name: 'b-stop-fail',
      async stop() {
        calls.push('b:stop');
        throw new Error('stop exploded');
      },
    };
    const pluginC: FhirEnginePlugin = {
      name: 'c-stop-ok',
      async stop() { calls.push('c:stop'); },
    };

    const errorLogger = {
      ...silent,
      error: (msg: string) => errors.push(msg),
    };

    engine = await createFhirEngine(baseConfig({
      plugins: [pluginA, pluginB, pluginC],
      logger: errorLogger,
    }));

    await engine.stop();
    engine = undefined;

    // All three plugins' stop() called (reverse order)
    expect(calls).toEqual(['c:stop', 'b:stop', 'a:stop']);
    // Error from pluginB was logged
    expect(errors.some((e) => e.includes('b-stop-fail') && e.includes('stop exploded'))).toBe(true);
  });

  // ── Partial hooks ──────────────────────────────────────────────

  it('plugins with only some hooks work correctly', async () => {
    const calls: string[] = [];

    const initOnly: FhirEnginePlugin = {
      name: 'init-only',
      async init() { calls.push('init-only:init'); },
    };
    const startOnly: FhirEnginePlugin = {
      name: 'start-only',
      async start() { calls.push('start-only:start'); },
    };
    const stopOnly: FhirEnginePlugin = {
      name: 'stop-only',
      async stop() { calls.push('stop-only:stop'); },
    };

    engine = await createFhirEngine(baseConfig({
      plugins: [initOnly, startOnly, stopOnly],
      logger: silent,
    }));

    expect(calls).toEqual(['init-only:init', 'start-only:start']);

    await engine.stop();
    engine = undefined;

    expect(calls).toEqual(['init-only:init', 'start-only:start', 'stop-only:stop']);
  });

  // ── No plugins = backward compatible ───────────────────────────

  it('no plugins config works (Phase 1 backward compatibility)', async () => {
    engine = await createFhirEngine(baseConfig({ logger: silent }));

    expect(engine.definitions).toBeDefined();
    expect(engine.persistence).toBeDefined();
    expect(engine.context).toBeDefined();
  });

  it('empty plugins array works', async () => {
    engine = await createFhirEngine(baseConfig({ plugins: [], logger: silent }));

    expect(engine.persistence).toBeDefined();
  });

  // ── Plugin interaction with persistence ────────────────────────

  it('plugin can use persistence in start() to seed data', async () => {
    let seededId: string | undefined;

    const plugin: FhirEnginePlugin = {
      name: 'seeder',
      async start(ctx: EngineContext) {
        const created = await ctx.persistence!.createResource('Patient', {
          resourceType: 'Patient',
          name: [{ family: 'Seeded' }],
        });
        seededId = created.id;
      },
    };

    engine = await createFhirEngine(baseConfig({ plugins: [plugin], logger: silent }));

    // Verify the seeded resource exists
    expect(seededId).toBeDefined();
    const read = await engine.persistence.readResource('Patient', seededId!);
    expect((read as any).name[0].family).toBe('Seeded');
  });
});
