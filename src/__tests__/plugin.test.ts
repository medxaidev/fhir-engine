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

  // ── Plugin init() failure (5 tests) ──────────────────────────────

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

  it('init() error message includes plugin name', async () => {
    const plugin: FhirEnginePlugin = {
      name: 'my-failing-plugin',
      async init() { throw new Error('oops'); },
    };

    await expect(
      createFhirEngine(baseConfig({ plugins: [plugin], logger: silent })),
    ).rejects.toThrow('my-failing-plugin');
  });

  it('init() error preserves original cause', async () => {
    const originalError = new Error('root cause');
    const plugin: FhirEnginePlugin = {
      name: 'cause-plugin',
      async init() { throw originalError; },
    };

    try {
      await createFhirEngine(baseConfig({ plugins: [plugin], logger: silent }));
    } catch (err: any) {
      expect(err.cause).toBe(originalError);
    }
  });

  it('first plugin init() failure prevents second plugin from running', async () => {
    const calls: string[] = [];
    const pluginA: FhirEnginePlugin = {
      name: 'a-fail',
      async init() { calls.push('a:init'); throw new Error('fail'); },
    };
    const pluginB: FhirEnginePlugin = {
      name: 'b-ok',
      async init() { calls.push('b:init'); },
    };

    await expect(
      createFhirEngine(baseConfig({ plugins: [pluginA, pluginB], logger: silent })),
    ).rejects.toThrow();

    expect(calls).toEqual(['a:init']); // b never ran
  });

  it('init() failure with non-Error value is stringified', async () => {
    const plugin: FhirEnginePlugin = {
      name: 'string-throw',
      async init() { throw 'raw string error'; },
    };

    await expect(
      createFhirEngine(baseConfig({ plugins: [plugin], logger: silent })),
    ).rejects.toThrow('raw string error');
  });

  // ── Plugin start() failure (5 tests) ────────────────────────────

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

  it('start() error includes plugin name and phase', async () => {
    const plugin: FhirEnginePlugin = {
      name: 'start-err',
      async start() { throw new Error('db unavailable'); },
    };

    await expect(
      createFhirEngine(baseConfig({ plugins: [plugin], logger: silent })),
    ).rejects.toThrow(/start-err.*start/);
  });

  it('start() failure preserves original cause', async () => {
    const cause = new Error('original');
    const plugin: FhirEnginePlugin = {
      name: 'start-cause',
      async start() { throw cause; },
    };

    try {
      await createFhirEngine(baseConfig({ plugins: [plugin], logger: silent }));
    } catch (err: any) {
      expect(err.cause).toBe(cause);
    }
  });

  it('first plugin start() failure prevents second plugin start()', async () => {
    const calls: string[] = [];
    const pluginA: FhirEnginePlugin = {
      name: 'a-start-fail',
      async start() { calls.push('a:start'); throw new Error('fail'); },
    };
    const pluginB: FhirEnginePlugin = {
      name: 'b-start-ok',
      async start() { calls.push('b:start'); },
    };

    await expect(
      createFhirEngine(baseConfig({ plugins: [pluginA, pluginB], logger: silent })),
    ).rejects.toThrow();

    expect(calls).toEqual(['a:start']);
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

  // ── Plugin stop() reverse order & error isolation (5 tests) ─────

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

    expect(calls).toEqual(['c:stop', 'b:stop', 'a:stop']);
    expect(errors.some((e) => e.includes('b-stop-fail') && e.includes('stop exploded'))).toBe(true);
  });

  it('stop() with 4 plugins calls all in reverse order', async () => {
    const calls: string[] = [];
    const plugins: FhirEnginePlugin[] = ['w', 'x', 'y', 'z'].map((n) => ({
      name: n,
      async stop() { calls.push(`${n}:stop`); },
    }));

    engine = await createFhirEngine(baseConfig({ plugins, logger: silent }));
    await engine.stop();
    engine = undefined;

    expect(calls).toEqual(['z:stop', 'y:stop', 'x:stop', 'w:stop']);
  });

  it('multiple stop() errors are each logged independently', async () => {
    const errors: string[] = [];

    const pluginA: FhirEnginePlugin = {
      name: 'fail-1',
      async stop() { throw new Error('err-1'); },
    };
    const pluginB: FhirEnginePlugin = {
      name: 'fail-2',
      async stop() { throw new Error('err-2'); },
    };

    const errorLogger = { ...silent, error: (msg: string) => errors.push(msg) };

    engine = await createFhirEngine(baseConfig({
      plugins: [pluginA, pluginB],
      logger: errorLogger,
    }));
    await engine.stop();
    engine = undefined;

    expect(errors.some((e) => e.includes('fail-1'))).toBe(true);
    expect(errors.some((e) => e.includes('fail-2'))).toBe(true);
  });

  it('single plugin stop() is called in reverse order (trivially)', async () => {
    const calls: string[] = [];

    engine = await createFhirEngine(baseConfig({
      plugins: [{ name: 'solo', async stop() { calls.push('solo:stop'); } }],
      logger: silent,
    }));
    await engine.stop();
    engine = undefined;

    expect(calls).toEqual(['solo:stop']);
  });

  it('stop() without any plugins succeeds', async () => {
    engine = await createFhirEngine(baseConfig({ plugins: [], logger: silent }));
    await engine.stop();
    engine = undefined;
    expect(true).toBe(true);
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
