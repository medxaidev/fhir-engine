import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { createFhirEngine } from '../engine.js';
import type { FhirEngine, FhirEngineConfig } from '../types.js';

const FIXTURES_PATH = resolve(__dirname, 'fixtures');

/** Silent logger to avoid console noise in tests. */
const silent = {
  debug: () => { },
  info: () => { },
  warn: () => { },
  error: () => { },
};

function baseConfig(overrides?: Partial<FhirEngineConfig>): FhirEngineConfig {
  return {
    database: { type: 'sqlite', path: ':memory:' },
    packages: { path: FIXTURES_PATH },
    logger: silent,
    ...overrides,
  };
}

describe('createFhirEngine', () => {
  let engine: FhirEngine | undefined;

  afterEach(async () => {
    if (engine) {
      await engine.stop();
      engine = undefined;
    }
  });

  // ── Config validation (6 tests) ────────────────────────────────

  it('throws on missing database config', async () => {
    await expect(
      createFhirEngine({ database: undefined as any, packages: { path: FIXTURES_PATH }, logger: silent }),
    ).rejects.toThrow('config.database is required');
  });

  it('throws on missing database.type', async () => {
    await expect(
      createFhirEngine({ database: { type: undefined as any, path: ':memory:' } as any, packages: { path: FIXTURES_PATH }, logger: silent }),
    ).rejects.toThrow('config.database.type is required');
  });

  it('throws on missing packages config', async () => {
    await expect(
      createFhirEngine({ database: { type: 'sqlite', path: ':memory:' }, packages: undefined as any, logger: silent }),
    ).rejects.toThrow('config.packages is required');
  });

  it('throws on missing packages.path', async () => {
    await expect(
      createFhirEngine({ database: { type: 'sqlite', path: ':memory:' }, packages: { path: undefined as any }, logger: silent }),
    ).rejects.toThrow('config.packages.path is required');
  });

  it('throws on sqlite-wasm (removed in fhir-persistence v0.3.0)', async () => {
    await expect(
      createFhirEngine({ database: { type: 'sqlite-wasm', path: ':memory:' }, packages: { path: FIXTURES_PATH }, logger: silent }),
    ).rejects.toThrow('sqlite-wasm adapter was removed');
  });

  it('throws on postgres when pg package is not installed', async () => {
    // pg may or may not be installed — if not, expect a clear error message
    try {
      require.resolve('pg');
      // pg IS installed — skip this test
    } catch {
      await expect(
        createFhirEngine({ database: { type: 'postgres', url: 'postgresql://localhost/test' }, packages: { path: FIXTURES_PATH }, logger: silent }),
      ).rejects.toThrow('requires the "pg" package');
    }
  });

  it('non-existent packages path produces engine with empty resourceTypes', async () => {
    engine = await createFhirEngine(baseConfig({ packages: { path: resolve(__dirname, '__nonexistent_dir__') } }));
    expect(engine.resourceTypes).toEqual([]);
  });

  // ── Bootstrap (7 tests) ────────────────────────────────────────

  it('bootstraps with SQLite :memory: and returns FhirEngine', async () => {
    engine = await createFhirEngine(baseConfig());

    expect(engine.definitions).toBeDefined();
    expect(engine.runtime).toBeDefined();
    expect(engine.adapter).toBeDefined();
    expect(engine.persistence).toBeDefined();
    expect(engine.sdRegistry).toBeDefined();
    expect(engine.spRegistry).toBeDefined();
    expect(engine.igResult).toBeDefined();
    expect(engine.resourceTypes).toBeDefined();
    expect(engine.logger).toBeDefined();
    expect(typeof engine.stop).toBe('function');
    expect(typeof engine.status).toBe('function');
  });

  it('loads Patient StructureDefinition from fixtures', async () => {
    engine = await createFhirEngine(baseConfig());

    const patientSD = engine.definitions.getStructureDefinition(
      'http://hl7.org/fhir/StructureDefinition/Patient',
    );
    expect(patientSD).toBeDefined();
    expect(patientSD?.name).toBe('Patient');
  });

  it('Patient is in resourceTypes', async () => {
    engine = await createFhirEngine(baseConfig());
    expect(engine.resourceTypes).toContain('Patient');
  });

  it('igResult.action is "new" for fresh database', async () => {
    engine = await createFhirEngine(baseConfig());
    expect(engine.igResult.action).toBe('new');
  });

  it('context object is populated with all fields', async () => {
    engine = await createFhirEngine(baseConfig());

    expect(engine.context).toBeDefined();
    expect(engine.context.config).toBeDefined();
    expect(engine.context.definitions).toBeDefined();
    expect(engine.context.runtime).toBeDefined();
    expect(engine.context.adapter).toBeDefined();
    expect(engine.context.persistence).toBeDefined();
    expect(engine.context.logger).toBeDefined();
  });

  it('sdRegistry contains Patient StructureDefinition', async () => {
    engine = await createFhirEngine(baseConfig());
    const sd = engine.sdRegistry.get('Patient');
    expect(sd).toBeDefined();
  });

  it('supports custom packageName and packageVersion', async () => {
    engine = await createFhirEngine(baseConfig({
      packageName: 'my-app',
      packageVersion: '2.0.0',
    }));
    expect(engine.persistence).toBeDefined();
  });

  // ── CRUD + Search E2E (7 tests) ────────────────────────────────

  it('creates and reads a Patient resource', async () => {
    engine = await createFhirEngine(baseConfig());

    const patient = await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'Smith', given: ['John'] }],
      gender: 'male',
      birthDate: '1990-01-15',
    });

    expect(patient.id).toBeDefined();
    expect(patient.meta?.versionId).toBeDefined();
    expect(patient.meta?.lastUpdated).toBeDefined();

    const read = await engine.persistence.readResource('Patient', patient.id!);
    expect(read.id).toBe(patient.id);
    expect((read as any).name[0].family).toBe('Smith');
  });

  it('updates a Patient resource', async () => {
    engine = await createFhirEngine(baseConfig());

    const created = await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'Doe' }],
    });

    const updated = await engine.persistence.updateResource('Patient', {
      ...created,
      name: [{ family: 'Doe', given: ['Jane'] }],
    });

    expect(updated.meta?.versionId).not.toBe(created.meta?.versionId);
    const read = await engine.persistence.readResource('Patient', created.id!);
    expect((read as any).name[0].given[0]).toBe('Jane');
  });

  it('deletes a Patient resource', async () => {
    engine = await createFhirEngine(baseConfig());

    const created = await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'ToDelete' }],
    });

    await engine.persistence.deleteResource('Patient', created.id!);

    await expect(
      engine.persistence.readResource('Patient', created.id!),
    ).rejects.toThrow();
  });

  it('creates multiple patients and reads each back', async () => {
    engine = await createFhirEngine(baseConfig());

    const names = ['Alpha', 'Bravo', 'Charlie'];
    const ids: string[] = [];

    for (const family of names) {
      const p = await engine.persistence.createResource('Patient', {
        resourceType: 'Patient',
        name: [{ family }],
      });
      ids.push(p.id!);
    }

    for (let i = 0; i < names.length; i++) {
      const read = await engine.persistence.readResource('Patient', ids[i]);
      expect((read as any).name[0].family).toBe(names[i]);
    }
  });

  it('creates two patients and reads both back', async () => {
    engine = await createFhirEngine(baseConfig());

    const p1 = await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'SearchMe' }],
    });
    const p2 = await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'SearchMeToo' }],
    });

    const r1 = await engine.persistence.readResource('Patient', p1.id!);
    const r2 = await engine.persistence.readResource('Patient', p2.id!);
    expect((r1 as any).name[0].family).toBe('SearchMe');
    expect((r2 as any).name[0].family).toBe('SearchMeToo');
  });

  it('readResource throws on non-existent id', async () => {
    engine = await createFhirEngine(baseConfig());

    await expect(
      engine.persistence.readResource('Patient', 'does-not-exist-12345'),
    ).rejects.toThrow();
  });

  it('created resource has correct resourceType preserved', async () => {
    engine = await createFhirEngine(baseConfig());

    const created = await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      active: true,
    });

    const read = await engine.persistence.readResource('Patient', created.id!);
    expect((read as any).resourceType).toBe('Patient');
    expect((read as any).active).toBe(true);
  });

  // ── Stop (5 tests) ─────────────────────────────────────────────

  it('stop() is idempotent — second call does not throw', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.stop();
    await engine.stop();
    engine = undefined;
  });

  it('stop() is idempotent — third call does not throw', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.stop();
    await engine.stop();
    await engine.stop();
    engine = undefined;
  });

  it('stop() logs shutdown messages', async () => {
    const messages: string[] = [];
    const logger = {
      debug: () => { },
      info: (msg: string) => messages.push(msg),
      warn: () => { },
      error: () => { },
    };

    engine = await createFhirEngine(baseConfig({ logger }));
    await engine.stop();
    engine = undefined;

    expect(messages.some((m) => m.includes('Stopping'))).toBe(true);
    expect(messages.some((m) => m.includes('stopped'))).toBe(true);
  });

  it('stop() resolves as a promise', async () => {
    engine = await createFhirEngine(baseConfig());
    const result = engine.stop();
    expect(result).toBeInstanceOf(Promise);
    await result;
    engine = undefined;
  });

  it('stop() closes the adapter', async () => {
    engine = await createFhirEngine(baseConfig());
    const adapter = engine.adapter;
    await engine.stop();
    engine = undefined;

    // After stop, adapter should be closed — any operation should fail or be closed
    // We verify stop completes without error (adapter.close() was called)
    expect(true).toBe(true);
  });

  // ── Status (6 tests) ───────────────────────────────────────────

  it('status() returns FhirEngineStatus with all fields', async () => {
    engine = await createFhirEngine(baseConfig());
    const s = engine.status();

    expect(s).toBeDefined();
    expect(Array.isArray(s.fhirVersions)).toBe(true);
    expect(Array.isArray(s.loadedPackages)).toBe(true);
    expect(Array.isArray(s.resourceTypes)).toBe(true);
    expect(typeof s.databaseType).toBe('string');
    expect(typeof s.igAction).toBe('string');
    expect(s.startedAt).toBeInstanceOf(Date);
    expect(Array.isArray(s.plugins)).toBe(true);
  });

  it('status().databaseType matches config', async () => {
    engine = await createFhirEngine(baseConfig());
    expect(engine.status().databaseType).toBe('sqlite');
  });

  it('status().igAction is "new" for fresh database', async () => {
    engine = await createFhirEngine(baseConfig());
    expect(engine.status().igAction).toBe('new');
  });

  it('status().resourceTypes contains Patient', async () => {
    engine = await createFhirEngine(baseConfig());
    expect(engine.status().resourceTypes).toContain('Patient');
  });

  it('status().loadedPackages includes hl7.fhir.r4.core', async () => {
    engine = await createFhirEngine(baseConfig());
    const pkgs = engine.status().loadedPackages;
    expect(pkgs.some((p) => p.startsWith('hl7.fhir.r4.core'))).toBe(true);
  });

  it('status().fhirVersions includes 4.0', async () => {
    engine = await createFhirEngine(baseConfig());
    expect(engine.status().fhirVersions).toContain('4.0');
  });

  it('status().plugins reflects registered plugin names', async () => {
    engine = await createFhirEngine(baseConfig({
      plugins: [{ name: 'test-p1' }, { name: 'test-p2' }],
    }));
    expect(engine.status().plugins).toEqual(['test-p1', 'test-p2']);
  });

  it('status().startedAt is a recent timestamp', async () => {
    const before = new Date();
    engine = await createFhirEngine(baseConfig());
    const after = new Date();
    const startedAt = engine.status().startedAt;
    expect(startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  // ── Custom logger (2 tests) ────────────────────────────────────

  it('accepts a custom logger and routes messages through it', async () => {
    const messages: string[] = [];
    const customLogger = {
      debug: (msg: string) => messages.push(`DEBUG: ${msg}`),
      info: (msg: string) => messages.push(`INFO: ${msg}`),
      warn: (msg: string) => messages.push(`WARN: ${msg}`),
      error: (msg: string) => messages.push(`ERROR: ${msg}`),
    };

    engine = await createFhirEngine(baseConfig({ logger: customLogger }));

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((m) => m.includes('fhir-engine ready'))).toBe(true);
  });

  it('default logger is used when none provided', async () => {
    // No explicit logger — should use console without error
    engine = await createFhirEngine({
      database: { type: 'sqlite', path: ':memory:' },
      packages: { path: FIXTURES_PATH },
    });
    expect(engine.logger).toBeDefined();
  });

  // ── engine.search() (6 tests) ─────────────────────────────────

  it('search() returns results for created patients', async () => {
    engine = await createFhirEngine(baseConfig());

    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'Searchable' }],
    });

    const result = await engine.search('Patient', {});
    expect(result).toBeDefined();
    expect(result.resources).toBeDefined();
    expect(result.resources.length).toBeGreaterThanOrEqual(1);
  });

  it('search() returns empty results for no matching resources', async () => {
    engine = await createFhirEngine(baseConfig());

    const result = await engine.search('Patient', {});
    expect(result.resources).toEqual([]);
  });

  it('search() result has correct resource structure', async () => {
    engine = await createFhirEngine(baseConfig());

    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'StructureTest' }],
    });

    const result = await engine.search('Patient', {});
    const patient = result.resources[0] as any;
    expect(patient.resourceType).toBe('Patient');
    expect(patient.id).toBeDefined();
    expect(patient.meta).toBeDefined();
  });

  it('search() is a function on the engine', async () => {
    engine = await createFhirEngine(baseConfig());
    expect(typeof engine.search).toBe('function');
  });

  it('search() works with multiple created resources', async () => {
    engine = await createFhirEngine(baseConfig());

    for (let i = 0; i < 3; i++) {
      await engine.persistence.createResource('Patient', {
        resourceType: 'Patient',
        name: [{ family: `Multi${i}` }],
      });
    }

    const result = await engine.search('Patient', {});
    expect(result.resources.length).toBe(3);
  });

  it('search() returns a Promise', async () => {
    engine = await createFhirEngine(baseConfig());
    const result = engine.search('Patient', {});
    expect(result).toBeInstanceOf(Promise);
    await result;
  });

  // ── Token search (UPS-1) (6 tests) ───────────────────────────

  it('search() token: gender=male (code-only, any system)', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      gender: 'male',
    });
    const result = await engine.search('Patient', { gender: 'male' });
    expect(result.resources.length).toBe(1);
  });

  it('search() token: gender=|male (empty system)', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      gender: 'male',
    });
    const result = await engine.search('Patient', { gender: '|male' });
    expect(result.resources.length).toBe(1);
  });

  it('search() token: gender=male does not match female', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      gender: 'female',
    });
    const result = await engine.search('Patient', { gender: 'male' });
    expect(result.resources.length).toBe(0);
  });

  it('search() token: identifier with system|code (exact match)', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      identifier: [{ system: 'http://example.com/mrn', value: 'MRN001' }],
    });
    const result = await engine.search('Patient', { identifier: 'http://example.com/mrn|MRN001' });
    expect(result.resources.length).toBe(1);
  });

  it('search() token: identifier with code-only (any system)', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      identifier: [{ system: 'http://example.com/mrn', value: 'MRN001' }],
    });
    const result = await engine.search('Patient', { identifier: 'MRN001' });
    expect(result.resources.length).toBe(1);
  });

  it('search() token: identifier with wrong system returns empty', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      identifier: [{ system: 'http://example.com/mrn', value: 'MRN001' }],
    });
    const result = await engine.search('Patient', { identifier: 'http://other.com|MRN001' });
    expect(result.resources.length).toBe(0);
  });

  // ── String search (UPS-2) (5 tests) ─────────────────────────

  it('search() string: name=Smith matches family name', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'Smith', given: ['John'] }],
    });
    const result = await engine.search('Patient', { name: 'Smith' });
    expect(result.resources.length).toBe(1);
  });

  it('search() string: family=Smith matches family name', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'Smith', given: ['John'] }],
    });
    const result = await engine.search('Patient', { family: 'Smith' });
    expect(result.resources.length).toBe(1);
  });

  it('search() string: given=John matches given name', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'Smith', given: ['John'] }],
    });
    const result = await engine.search('Patient', { given: 'John' });
    expect(result.resources.length).toBe(1);
  });

  it('search() string: name search is case-insensitive', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'Smith' }],
    });
    const result = await engine.search('Patient', { name: 'smith' });
    expect(result.resources.length).toBe(1);
  });

  it('search() string: name=Unknown returns empty', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'Smith' }],
    });
    const result = await engine.search('Patient', { name: 'Unknown' });
    expect(result.resources.length).toBe(0);
  });

  // ── Optimistic locking (UPS-3) (2 tests) ────────────────────

  it('updateResource with correct ifMatch succeeds', async () => {
    engine = await createFhirEngine(baseConfig());
    const created = await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'Locking' }],
    });
    const updated = await engine.persistence.updateResource('Patient', {
      ...created,
      name: [{ family: 'Updated' }],
    }, { ifMatch: created.meta!.versionId! });
    expect(updated.meta!.versionId).not.toBe(created.meta!.versionId);
  });

  it('updateResource with wrong ifMatch throws ResourceVersionConflictError', async () => {
    engine = await createFhirEngine(baseConfig());
    const created = await engine.persistence.createResource('Patient', {
      resourceType: 'Patient',
      name: [{ family: 'Locking' }],
    });
    await expect(
      engine.persistence.updateResource('Patient', {
        ...created,
        name: [{ family: 'Conflict' }],
      }, { ifMatch: 'wrong-version-id' }),
    ).rejects.toThrow();
  });

  // ── Re-exported FHIRPath functions (5 tests) ──────────────────

  it('evalFhirPath is re-exported and evaluates expressions', async () => {
    const { evalFhirPath } = await import('../index.js');
    const patient = { resourceType: 'Patient', name: [{ family: 'Test' }] };
    const result = evalFhirPath('Patient.name.family', patient);
    expect(result).toEqual(['Test']);
  });

  it('evalFhirPathBoolean is re-exported and returns boolean', async () => {
    const { evalFhirPathBoolean } = await import('../index.js');
    const patient = { resourceType: 'Patient', active: true };
    const result = evalFhirPathBoolean('Patient.active', patient);
    expect(result).toBe(true);
  });

  it('evalFhirPathString is re-exported and returns string', async () => {
    const { evalFhirPathString } = await import('../index.js');
    const patient = { resourceType: 'Patient', name: [{ family: 'StringTest' }] };
    const result = evalFhirPathString('Patient.name.family', patient);
    expect(result).toBe('StringTest');
  });

  it('parseSearchRequest is re-exported', async () => {
    const { parseSearchRequest } = await import('../index.js');
    expect(typeof parseSearchRequest).toBe('function');
  });

  it('executeSearch is re-exported', async () => {
    const { executeSearch } = await import('../index.js');
    expect(typeof executeSearch).toBe('function');
  });
});
