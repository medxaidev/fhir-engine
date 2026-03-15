# FHIR Application Core Design

## 1. Background

Phase 2 has completed the foundational engine capabilities. The next stage is no longer only about extending `fhir-engine`, but about answering a new class of questions:

- How should upper-layer applications be designed?
- Should development start from `fhir-server`, `fhir-cli`, or another host?
- How can the project remain local-first while still preserving a path toward server deployment?
- If `fhir-engine` already exists and uses a plugin model, will introducing `Application Core` create unnecessary architectural weight?

This document consolidates the current design direction for `Application Core`, clarifies its responsibilities, and proposes a pragmatic next-step approach.

## 2. Core Conclusion

`Application Core` should exist, but it must remain thin.

It should not become a second engine, a second plugin platform, or a new framework layer. Its job is to organize application use cases on top of `fhir-engine` so that multiple hosts can reuse the same behavior without duplicating business flow logic.

In short:

- `fhir-engine` solves capability execution
- plugins solve engine extensibility
- `Application Core` solves application use-case orchestration
- hosts solve delivery and interaction

The design goal is therefore:

**local-first, host-agnostic, server-compatible, and intentionally thin**

## 3. Why `Application Core` Is Needed

Even with a plugin-based `fhir-engine`, the next phase introduces problems that engine plugins do not solve directly:

- multiple application hosts may exist in the future
  - `fhir-cli`
  - local web admin
  - `fhir-server`
  - desktop host
- the same user action may need to orchestrate multiple engine capabilities
- application-level context must be carried consistently
- host-specific concerns should not leak into engine design
- upper-layer product behavior should be reusable across transport styles

Without an application layer, each host would tend to re-implement the same workflows differently.

## 4. What `Application Core` Is

`Application Core` is a thin application orchestration layer located between `fhir-engine` and concrete hosts.

It should be implemented as a TypeScript library that:

- depends on `fhir-engine`
- exposes application use cases
- accepts application context
- coordinates multiple engine calls when necessary
- returns host-neutral results

It is not:

- a UI framework
- an HTTP server
- a CLI framework
- an Electron application
- a replacement for plugins

## 5. What `Application Core` Is Not

To keep the architecture lightweight, `Application Core` must explicitly avoid several responsibilities.

It should not:

- re-implement FHIR primitives already owned by `fhir-engine`
- duplicate plugin registration or lifecycle handling
- mirror every engine API behind a second facade layer
- introduce a second extension platform unless there is a proven need
- absorb transport-specific behavior such as HTTP request/response, CLI argument parsing, or UI state management
- over-design for future distributed complexity too early

If `Application Core` becomes a broad abstraction of everything, it will become heavy. If it stays focused on use cases, it remains valuable and small.

## 6. Responsibility Boundaries

### 6.1 `fhir-engine`

`fhir-engine` should own:

- FHIR execution primitives
- resource operations
- validation
- transformation
- rule execution
- core repository and adapter contracts
- plugin system
- low-level extensibility points

This layer is capability-oriented.

### 6.2 plugins

Plugins should own:

- extension of engine behaviors
- validators
- handlers
- adapters
- hooks
- providers
- operation-specific extensions attached to engine execution points

Plugins are the engine extension mechanism.

### 6.3 `Application Core`

`Application Core` should own:

- application use cases
- orchestration across multiple engine capabilities
- application context propagation
- host-neutral result shaping
- minimal application-level ports
- transaction and workflow coordination only when required by a use case

This layer is use-case-oriented.

### 6.4 hosts

Hosts should own:

- CLI argument parsing and output formatting
- HTTP routing and protocol behavior
- React or web UI state and presentation
- Electron or desktop shell integration
- process startup and deployment concerns

Hosts are delivery mechanisms.

## 7. The Key Distinction: Capabilities vs Use Cases

The most important architectural distinction is:

- `fhir-engine` provides capabilities
- `Application Core` composes capabilities into user actions

For example, a future action such as importing a patient bundle may involve:

- reading input
- parsing bundle contents
- validating resources
- applying duplicate or merge policies
- persisting resources
- updating indexes
- returning an operation summary

Each of these steps may rely on engine capabilities, but the full workflow is an application use case.

That workflow belongs in `Application Core`, not in the host, and not as a catch-all inside the engine.

## 8. Why It Should Not Be Electron-First

`Application Core` should not be tied to Electron.

Electron, if adopted in the future, should only exist as a host shell. The application core must remain independent from:

- browser rendering
- desktop window management
- main/renderer IPC concerns
- installer and packaging concerns

A local-first strategy does not require Electron.

Possible host paths include:

- CLI host
- local HTTP host serving a React admin UI on `localhost`
- future Electron or Tauri shell if desktop packaging becomes necessary
- future remote `fhir-server`

This means web UI and local data are not mutually exclusive.

## 9. Why the Design Should Be `server-compatible`, Not `server-first`

A full `fhir-server` perspective is useful because it forces clarity around:

- request boundaries
- search models
- pagination
- error models
- capability exposure
- transactions
- authentication context

However, implementing a full server too early introduces significant platform complexity:

- PostgreSQL-first assumptions
- deployment and operations concerns
- authentication and authorization
- multi-user and multi-tenant design pressure
- transport and protocol overhead

For a product intended for individuals and small clinics, the better direction is:

**design with server compatibility in mind, but implement local-first hosts first**

## 10. Why `fhir-cli` Should Be the First Host

The recommended first host is `fhir-cli`, not because CLI is the final product, but because it is the lowest-cost executable host for validating the application layer.

`fhir-cli` helps verify:

- application use-case boundaries
- local storage assumptions
- import/export flows
- validation flows
- search and write flows
- engine-to-application integration

It is a proving ground for `Application Core`, not the final user experience.

## 11. Lightweight Design Principles

To avoid unnecessary weight, `Application Core` should follow these principles.

### 11.1 Keep it use-case first

Organize around actions users or systems actually perform:

- initialize workspace
- import bundle
- validate resource
- upsert resource
- search resources
- export resources

Do not start by wrapping all engine APIs.

### 11.2 Keep ports minimal

Only introduce application-level ports that solve real boundary problems.

Examples:

- `StoragePort`
- `ClockPort`
- `IdGeneratorPort`
- minimal transaction support if needed

Do not create broad abstraction sets for hypothetical future scenarios.

### 11.3 Do not create a second plugin system

The existing engine plugin model should remain the main extension mechanism unless a proven, host-independent application extension need emerges later.

### 11.4 Keep hosts thin

Hosts should call `Application Core` rather than re-implement application behavior internally.

### 11.5 Evolve by extraction, not by speculation

Begin with a small in-repo application layer. Extract it into a separate package only after multiple hosts genuinely reuse it.

## 12. Recommended Minimal Scope for the Next Stage

The next stage should not begin with a large, formalized framework. It should begin with a small set of concrete use cases.

Recommended first use cases:

- `initializeWorkspace`
- `importBundle`
- `validateResource`
- `upsertResource`
- `searchResources`

This is enough to validate the layer without overcommitting the architecture.

## 13. Suggested Evolution Path

### Stage 1: Thin in-repo application layer

Start with a lightweight internal structure such as:

- `src/app/use-cases`
- `src/app/context`
- `src/app/ports`

At this stage, the focus is only on proving the shape.

### Stage 2: First host via `fhir-cli`

Use CLI as the first executable host to exercise the use cases end-to-end.

This should validate:

- local-first workflows
- storage assumptions
- operation result models
- integration boundaries

### Stage 3: Local admin host

Introduce a local host for management UI if needed, likely via a local HTTP process exposed on `localhost`.

This allows:

- React-based UI if desired
- local data retention
- no early dependency on a remote deployment model

### Stage 4: `fhir-server`

Once application use cases and host boundaries are validated, expose the same application layer through a server host.

At this point, a PostgreSQL-backed and more complete server implementation can be justified with much clearer boundaries.

## 14. Proposed Packaging Direction

A long-term structure may evolve toward:

- `fhir-engine`
- `fhir-app-core`
- `fhir-cli`
- `fhir-local-host`
- `fhir-server`

However, this should be treated as an evolutionary direction, not an immediate packaging mandate.

Initially, it is safer to keep the application layer close to the current codebase and extract only when reuse is real.

## 15. Decision Summary

The recommended direction is:

- start upper-layer design now
- keep `Application Core` thin
- do not make it a second engine
- do not make it Electron-first
- do not start with a full `fhir-server`
- design in a server-compatible way
- implement through a local-first host first
- use `fhir-cli` as the first proving host

## 16. Final Position

`Application Core` is justified only if it remains a thin orchestration layer for reusable application use cases.

It should exist to reduce duplication across hosts and to preserve a clean separation between engine capabilities and application behavior.

If kept narrow, it will not make the architecture heavy. Instead, it will provide the missing bridge between `fhir-engine` and future products.
