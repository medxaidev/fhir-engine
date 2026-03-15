# fhir-runtime Integration Specification

**Version:** v0.4.0  
**Date:** 2026-03-12  
**Target:** fhir-runtime development team

This document specifies the integration contract between `fhir-definition` and `fhir-runtime`.

---

## Overview

`fhir-definition` provides a **DefinitionProvider** interface that `fhir-runtime` can consume for FHIR definition queries during validation, profile checking, and terminology binding.

**Key Principle:** Dependency Inversion — `fhir-runtime` depends on the abstract `DefinitionProvider` interface, not on `fhir-definition` concrete implementations.

---

## DefinitionProvider Interface

### TypeScript Definition

```typescript
interface DefinitionProvider {
  getStructureDefinition(url: string): StructureDefinition | undefined;
  getValueSet(url: string): ValueSet | undefined;
  getCodeSystem(url: string): CodeSystem | undefined;
  getSearchParameters(resourceType: string): SearchParameter[];
}
```

**Location in fhir-definition:** `src/contract/definition-provider.ts`

### Method Specifications

#### `getStructureDefinition(url: string)`

**Purpose:** Retrieve a StructureDefinition by canonical URL.

**Parameters:**
- `url: string` — Canonical URL (e.g., `http://hl7.org/fhir/StructureDefinition/Patient`)

**Returns:** `StructureDefinition | undefined`

**Behavior:**
- Returns the **main index** entry (latest version if multiple versions exist)
- Returns `undefined` if URL not found
- **Never throws**

**Example:**
```typescript
const patientSD = provider.getStructureDefinition('http://hl7.org/fhir/StructureDefinition/Patient');
if (patientSD) {
  // Use for validation
  console.log(patientSD.type); // 'Patient'
}
```

**Use Cases in fhir-runtime:**
- Profile validation: `runtime.validate(resource, profileUrl)`
- Element cardinality checking
- Type validation

---

#### `getValueSet(url: string)`

**Purpose:** Retrieve a ValueSet by canonical URL.

**Parameters:**
- `url: string` — Canonical URL (e.g., `http://hl7.org/fhir/ValueSet/administrative-gender`)

**Returns:** `ValueSet | undefined`

**Behavior:**
- Returns raw ValueSet (no expansion performed)
- Returns `undefined` if URL not found
- **Never throws**

**Important:** `fhir-definition` does **NOT** perform ValueSet expansion. If `fhir-runtime` needs expansion, it should:
1. Get the raw ValueSet from `DefinitionProvider`
2. Perform expansion using a separate `TerminologyProvider` (future `fhir-terminology` package)

**Example:**
```typescript
const genderVS = provider.getValueSet('http://hl7.org/fhir/ValueSet/administrative-gender');
if (genderVS) {
  // ValueSet exists, but needs expansion for validation
  const expandedCodes = terminologyProvider.expand(genderVS); // Not in fhir-definition
}
```

**Use Cases in fhir-runtime:**
- Binding validation (after expansion)
- Terminology reference resolution

---

#### `getCodeSystem(url: string)`

**Purpose:** Retrieve a CodeSystem by canonical URL.

**Parameters:**
- `url: string` — Canonical URL (e.g., `http://terminology.hl7.org/CodeSystem/observation-category`)

**Returns:** `CodeSystem | undefined`

**Behavior:**
- Returns CodeSystem with `concept` array (hierarchical tree)
- Returns `undefined` if URL not found
- **Never throws**

**Example:**
```typescript
const obsCategory = provider.getCodeSystem('http://terminology.hl7.org/CodeSystem/observation-category');
if (obsCategory && obsCategory.concept) {
  // Check if code exists
  const hasCode = obsCategory.concept.some(c => c.code === 'vital-signs');
}
```

**Use Cases in fhir-runtime:**
- Code validation against CodeSystem
- Display name lookup
- Terminology binding validation

**Note:** For advanced code lookup (recursive concept tree search), use `CodeSystemResolver.lookupCode()` from `fhir-definition`.

---

#### `getSearchParameters(resourceType: string)`

**Purpose:** Retrieve all SearchParameters for a given resource type.

**Parameters:**
- `resourceType: string` — FHIR resource type (e.g., `'Patient'`, `'Observation'`)

**Returns:** `SearchParameter[]` (empty array if none found)

**Behavior:**
- Returns all SPs where `base` includes the given `resourceType`
- Multi-base SPs (e.g., `clinical-date` with base `[Condition, Observation]`) appear in results for all applicable types
- Returns `[]` if no SPs found for the resource type
- **Never throws**

**Example:**
```typescript
const patientSPs = provider.getSearchParameters('Patient');
for (const sp of patientSPs) {
  console.log(`${sp.code}: ${sp.expression}`);
  // name: Patient.name
  // gender: Patient.gender
}
```

**Use Cases in fhir-runtime:**
- Search parameter validation
- FHIRPath expression extraction for search indexing
- Query parameter validation

---

## Integration Pattern

### Recommended Usage in fhir-runtime

```typescript
import type { DefinitionProvider } from 'fhir-definition';

class FhirRuntime {
  private definitions: DefinitionProvider;

  constructor(options: { definitions: DefinitionProvider }) {
    this.definitions = options.definitions;
  }

  validate(resource: any, profileUrl: string): ValidationResult {
    const profile = this.definitions.getStructureDefinition(profileUrl);
    if (!profile) {
      return { valid: false, errors: [`Profile not found: ${profileUrl}`] };
    }

    // Perform validation using profile
    // ...
  }

  validateBinding(value: string, bindingUrl: string): boolean {
    const valueSet = this.definitions.getValueSet(bindingUrl);
    if (!valueSet) return false;

    // Expand ValueSet (using TerminologyProvider, not shown)
    // Check if value is in expanded codes
    // ...
  }
}
```

### Initialization Example

```typescript
// In application code
import { loadDefinitionPackages } from 'fhir-definition';
import { FhirRuntime } from 'fhir-runtime';

const { registry } = loadDefinitionPackages('./definitions');

// registry satisfies DefinitionProvider via structural typing
const runtime = new FhirRuntime({ definitions: registry });
```

---

## Type Definitions

### StructureDefinition (Minimal)

```typescript
interface StructureDefinition {
  resourceType: 'StructureDefinition';
  url: string;
  version?: string;
  name?: string;
  type?: string;
  kind?: 'primitive-type' | 'complex-type' | 'resource' | 'logical';
  baseDefinition?: string;
  snapshot?: {
    element: Array<{
      id: string;
      path: string;
      min?: number;
      max?: string;
      type?: Array<{ code: string }>;
      // ... other element properties
    }>;
  };
  differential?: {
    element: Array<{
      id: string;
      path: string;
      // ... element properties
    }>;
  };
}
```

**Note:** `fhir-definition` uses minimal type definitions. `snapshot` and `differential` are typed as `unknown` in v0.4.0. `fhir-runtime` should cast to detailed types as needed.

---

### ValueSet (Minimal)

```typescript
interface ValueSet {
  resourceType: 'ValueSet';
  url: string;
  version?: string;
  name?: string;
  status?: string;
  compose?: {
    include?: Array<{
      system?: string;
      concept?: Array<{ code: string; display?: string }>;
      filter?: Array<{ property: string; op: string; value: string }>;
    }>;
  };
  expansion?: {
    contains?: Array<{
      system?: string;
      code: string;
      display?: string;
    }>;
  };
}
```

---

### CodeSystem (Minimal)

```typescript
interface CodeSystem {
  resourceType: 'CodeSystem';
  url: string;
  version?: string;
  name?: string;
  status?: string;
  content?: string;
  concept?: Array<{
    code: string;
    display?: string;
    definition?: string;
    concept?: Array<...>; // Recursive
  }>;
}
```

---

### SearchParameter

```typescript
interface SearchParameter {
  resourceType: 'SearchParameter';
  url: string;
  version?: string;
  name?: string;
  code?: string;
  base?: string[];
  type?: 'number' | 'date' | 'string' | 'token' | 'reference' | 'composite' | 'quantity' | 'uri' | 'special';
  expression?: string;
  description?: string;
}
```

---

## Performance Characteristics

All `DefinitionProvider` methods use **O(1) Map lookups**:

| Method | Complexity | Typical Time |
|--------|-----------|--------------|
| `getStructureDefinition()` | O(1) | <0.01ms |
| `getValueSet()` | O(1) | <0.01ms |
| `getCodeSystem()` | O(1) | <0.01ms |
| `getSearchParameters()` | O(1) | <0.1ms |

**Recommendation:** `fhir-runtime` can call these methods freely without caching.

---

## Advanced Queries (Optional)

If `fhir-runtime` needs more advanced queries, it can import additional classes from `fhir-definition`:

### Version-Aware SD Resolution

```typescript
import { StructureDefinitionResolver } from 'fhir-definition';

const sdResolver = new StructureDefinitionResolver(registry);

// Resolve specific version
const patientV4 = sdResolver.resolveVersioned('http://hl7.org/fhir/StructureDefinition/Patient|4.0.1');
const patientV5 = sdResolver.resolveVersioned('http://hl7.org/fhir/StructureDefinition/Patient|5.0.0');
```

### Code Lookup in CodeSystem

```typescript
import { CodeSystemResolver } from 'fhir-definition';

const csResolver = new CodeSystemResolver(registry);

// Recursive concept tree search
const conceptInfo = csResolver.lookupCode(
  'http://terminology.hl7.org/CodeSystem/observation-category',
  'vital-signs'
);
// Returns: { code: 'vital-signs', display: 'Vital Signs', system: '...', definition: '...' }
```

### SearchParameter Queries

```typescript
import { SearchParameterResolver } from 'fhir-definition';

const spResolver = new SearchParameterResolver(registry);

// Get SP by name
const nameSP = spResolver.resolveByName('Patient', 'name');

// Get SP by canonical URL
const sp = spResolver.resolveByUrl('http://hl7.org/fhir/SearchParameter/Patient-name');

// Get all SPs (deduplicated)
const allSPs = spResolver.listAll();
```

---

## Error Handling

### No-Throw Contract

All `DefinitionProvider` methods **never throw exceptions**:

```typescript
// ✅ Safe: Always returns undefined or empty array
const sd = provider.getStructureDefinition('http://nonexistent');
// sd === undefined

const sps = provider.getSearchParameters('NonExistent');
// sps === []
```

### Validation Pattern

```typescript
function validateResource(resource: any, profileUrl: string): ValidationResult {
  const profile = definitions.getStructureDefinition(profileUrl);
  
  if (!profile) {
    return {
      valid: false,
      errors: [`Profile not found: ${profileUrl}`]
    };
  }

  // Profile exists, proceed with validation
  // ...
}
```

---

## Testing Integration

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { InMemoryDefinitionRegistry } from 'fhir-definition';
import type { DefinitionProvider } from 'fhir-definition';

describe('FhirRuntime with DefinitionProvider', () => {
  it('should accept InMemoryDefinitionRegistry as DefinitionProvider', () => {
    const registry = new InMemoryDefinitionRegistry();
    registry.register({
      resourceType: 'StructureDefinition',
      url: 'http://test/SD/Patient',
      name: 'Patient',
    });

    // Structural typing: registry satisfies DefinitionProvider
    const provider: DefinitionProvider = registry;
    
    const runtime = new FhirRuntime({ definitions: provider });
    expect(runtime).toBeDefined();
  });
});
```

---

## Migration Path

### Current (v0.4.0)

`fhir-runtime` should depend on `fhir-definition` v0.4.x and use `DefinitionProvider` interface.

### Future (v1.0.0+)

When `fhir-definition` reaches v1.0, the `DefinitionProvider` interface will be **frozen** (semver guarantee). Any new methods will be added via new interfaces (e.g., `DefinitionProviderV2`).

---

## FAQ

### Q: Can I use `InMemoryDefinitionRegistry` directly instead of `DefinitionProvider`?

**A:** Yes, but not recommended. Using `DefinitionProvider` interface provides:
- Loose coupling (Dependency Inversion)
- Future-proof (interface won't change)
- Testability (easy to mock)

### Q: Does `fhir-definition` perform ValueSet expansion?

**A:** No. ValueSet expansion is the responsibility of `fhir-terminology` (future package) or `fhir-runtime` itself. `fhir-definition` only stores and retrieves raw ValueSets.

### Q: How do I handle versioned StructureDefinitions?

**A:** Use `StructureDefinitionResolver.resolveVersioned()` or access the version index directly via `DefinitionRegistry.getStructureDefinitionByVersion()`.

### Q: What if a SearchParameter has multiple `base` values?

**A:** `getSearchParameters('Patient')` will return all SPs where `base` includes `'Patient'`. The same SP object may appear in results for multiple resource types.

### Q: Are there any runtime dependencies?

**A:** No. `fhir-definition` has **zero runtime dependencies**. It only requires Node.js ≥18.

---

## Contact

For questions or issues, please file an issue at:  
https://github.com/medxaidev/fhir-definition/issues

---

## Appendix: Complete Example

```typescript
// ========================================
// Application: Load definitions
// ========================================
import { loadDefinitionPackages } from 'fhir-definition';

const { registry } = loadDefinitionPackages('./definitions');

// ========================================
// fhir-runtime: Use DefinitionProvider
// ========================================
import type { DefinitionProvider } from 'fhir-definition';

class FhirRuntime {
  private definitions: DefinitionProvider;

  constructor(options: { definitions: DefinitionProvider }) {
    this.definitions = options.definitions;
  }

  validate(resource: any, profileUrl: string) {
    const profile = this.definitions.getStructureDefinition(profileUrl);
    if (!profile) {
      return { valid: false, errors: [`Profile not found: ${profileUrl}`] };
    }

    // Validate resource against profile
    const errors: string[] = [];
    
    // Example: Check resourceType matches profile.type
    if (resource.resourceType !== profile.type) {
      errors.push(`Expected resourceType ${profile.type}, got ${resource.resourceType}`);
    }

    // Example: Validate bindings
    if (profile.snapshot?.element) {
      for (const element of profile.snapshot.element) {
        // Check binding if present
        const binding = (element as any).binding;
        if (binding?.valueSet) {
          const vs = this.definitions.getValueSet(binding.valueSet);
          if (!vs) {
            errors.push(`ValueSet not found: ${binding.valueSet}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  getSearchParameters(resourceType: string) {
    return this.definitions.getSearchParameters(resourceType);
  }
}

// ========================================
// Application: Initialize runtime
// ========================================
const runtime = new FhirRuntime({ definitions: registry });

// Validate a resource
const patient = {
  resourceType: 'Patient',
  name: [{ family: 'Smith' }],
};

const result = runtime.validate(patient, 'http://hl7.org/fhir/StructureDefinition/Patient');
console.log(result); // { valid: true, errors: [] }

// Get search parameters
const sps = runtime.getSearchParameters('Patient');
console.log(sps.map(sp => sp.code)); // ['name', 'gender', ...]
```
