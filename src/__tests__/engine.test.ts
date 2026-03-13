import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { createFhirEngine } from '../engine.js';
import type { FhirEngine, FhirEngineConfig } from '../types.js';

const FIXTURES_PATH = resolve(__dirname, 'fixtures');

function baseConfig(overrides?: Partial<FhirEngineConfig>): FhirEngineConfig {
  return {
    database: { type: 'sqlite', path: ':memory:' },
    packages: { path: FIXTURES_PATH },
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

  // ── Config validation ──────────────────────────────────────────

  it('throws on missing database config', async () => {
    await expect(
      createFhirEngine({ database: undefined as any, packages: { path: FIXTURES_PATH } }),
    ).rejects.toThrow('config.database is required');
  });

  it('throws on missing packages config', async () => {
    await expect(
      createFhirEngine({ database: { type: 'sqlite', path: ':memory:' }, packages: undefined as any }),
    ).rejects.toThrow('config.packages is required');
  });

  it('throws on postgres (not yet supported)', async () => {
    await expect(
      createFhirEngine({ database: { type: 'postgres', url: 'postgresql://localhost/test' }, packages: { path: FIXTURES_PATH } }),
    ).rejects.toThrow('PostgreSQL adapter is not yet available');
  });

  // ── Bootstrap ──────────────────────────────────────────────────

  it('bootstraps with SQLite :memory: and returns FhirEngine', async () => {
    engine = await createFhirEngine(baseConfig());

    // Core interfaces are present
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

  // ── CRUD ───────────────────────────────────────────────────────

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

  // ── Stop ───────────────────────────────────────────────────────

  it('stop() is idempotent', async () => {
    engine = await createFhirEngine(baseConfig());
    await engine.stop();
    await engine.stop(); // second call should not throw
    engine = undefined; // prevent afterEach double-stop
  });

  // ── Custom logger ──────────────────────────────────────────────

  it('accepts a custom logger', async () => {
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
});
