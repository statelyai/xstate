---
title: XState v6 release status
description: What alpha, beta, and stable mean for XState v6, which APIs are frozen, and which may still change.
---

XState v6 is published under the `alpha` tag: `npm install xstate@alpha`. This page states what each release stage promises and lists the stability of every part of the package.

## Release stages

| Stage | npm tag | What can change |
| --- | --- | --- |
| Alpha | `alpha` | Any API. Persisted snapshots from one alpha may not restore in the next. |
| Beta | `beta` | Only APIs tagged `@experimental`. Frozen APIs receive additive changes and bug fixes. Persisted snapshots restore across betas. |
| Stable | `latest` | Semantic versioning. Experimental APIs may still change in minor releases until they are promoted. |

Beta starts when every export carries a stability tag, the CI gates in this repository (bundle size, packed-package type check, export stability) pass, and the persisted snapshot envelope is versioned.

## Stability tags

Every exported symbol carries one JSDoc tag. A CI check fails on an untagged export.

| Tag | Meaning |
| --- | --- |
| `@public` | Frozen at beta. Breaking changes wait for the next major. |
| `@experimental` | May change in any 6.x release. Changes are listed in the changelog. |
| `@internal` | Not part of the API even when reachable. |
| `@deprecated` | Removed at the next major. Always paired with `@public`. |

## Frozen at beta

- Machine authoring: `createMachine`, `setup`, `schemas`, state and transition configuration, the transition-function contract `(args, enq) => result`.
- Actors: `createActor`, `Actor`, `ActorRef`, `ActorLogic`, `createSystem`, `waitFor`, `toPromise`, `SimulatedClock`.
- Pure API: `transition`, `initialTransition`, `executeEffects`. An unhandled event returns the same snapshot reference and an empty effect list.
- Actor logic factories in `xstate/actors`.
- `xstate/graph`.
- `xstate/fsm` (`createFSM`).
- Machine-definition serialization: `serializeMachine`, `machineConfigToJSON`, `createMachineFromConfig`, and the `MachineJSON` shape. The contract is the serialization conformance test suite in `packages/core/test`. `createMachineFromConfig` revives a runnable machine and does not recreate static type inference.
- The persisted snapshot envelope: `status`, `value`, `context`, `output`, `error`, `historyValue`, `stateInputs`, `children`, `timers`. Fields starting with `_` are private. See [persistence](persistence.md).

## Experimental through 6.0

- `xstate/durable` and the runtime helpers it needs: `deliverEvent`, `runStep`, `stopActor`, `terminateActor`, effect descriptors, `ActorSystemRuntime`, remote actor references, and `enq.step`.
- `xstate/validation`, including `ActorValidationReason`.
- `xstate/scxml`. This entry moves to a separate `@xstate/scxml` package before beta.
- The inspection event protocol. Use `createInspector()` from `@statelyai/sdk` to inspect v6 actors; `@statelyai/inspect` supports v5 only.

## Framework packages

`@xstate/react`, `@xstate/vue`, `@xstate/svelte`, and `@xstate/solid` publish v6-compatible alphas and follow the same stages as `xstate`. `@xstate/store` versions independently.

## Migration tooling

`xstate migrate` (the `@xstate/codemod` package) rewrites imports, wraps string targets in `{ target }`, converts `types` to `schemas`, and reports APIs that need manual migration. Rewrites for `assign`, `raise`, `sendTo`, and other removed action creators are manual. See [Migrate from XState v5 to v6](xstate-v5-to-v6.md).

## Not in 6.0

- Parallel invocation of a list of actors from one `invoke` (fan-out).
- A boolean settled flag on snapshots. A `pending` list describing outstanding work is planned for a 6.x release.
- Codecs for non-JSON values in persisted payloads. Hosts serialize payloads; development builds warn on functions, symbols, `BigInt`, and cycles.
