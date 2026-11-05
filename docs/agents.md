---
title: Agent guide
description: Author, inspect and test XState with the installed version's contracts.
---

Read this page from the installed package, usually `node_modules/xstate/docs/agents.md`.
`docs/index.md` identifies the exact version. `docs/api-stability.json` classifies
exports from that source tree. Prefer these files over examples for another major
version. Install framework and integration packages from the same release family.

## Author v6 machines

- Declare contracts under `schemas`, using `types<T>()` for TypeScript-only
  inference or Standard Schema for runtime schemas. Inference alone does not
  validate input. See [runtime validation](typescript.md#runtime-validation).
- Use `{ target: 'next' }` for a static transition. Use one synchronous function
  for a conditional transition; return `undefined` before any enqueue call to
  refuse the event. String transitions and transition arrays are not v6 authoring
  syntax. See [transitions](transitions.md).
- Return a shallow `{ context: { field: value } }` patch. Keep I/O, time reads,
  randomness and external mutation outside transition calculation. Queue effects
  with `enq`, or invoke actor logic for asynchronous work.
- Put transient data in [state input](state-input.md) when it belongs to the
  active state. Use [typestates](typestates.md) to refine root context. State input
  is removed on exit; root context survives state changes.
- Invoke for work owned by a state's lifetime; spawn for actors with an explicit
  longer lifetime. Stop, cancellation and service failure need tests.
- Keep target literals visible when visual inspection matters. A graph is not
  complete when `analysis.transitionTargetsComplete` is false. Read its
  diagnostics rather than guessing the missing destinations.
- Before exporting code-authored definitions, inspect
  `getMachineSerializationDiagnostics(machine)`. Serialization can omit inline
  actors and runtime schemas. Code expressions need explicit evaluators and
  dependencies; JSON conversion does not preserve arbitrary closures.

Use `machineToJSON`, `machineConfigToJSON` and `machineFromJSON` for definitions.
Use `getPersistedSnapshot` and the [persistence guide](persistence.md) for running
state. A definition and a checkpoint are different artifacts. Do not restore old
snapshots without checking their version and migration requirements.

## Local JSON operations

The core CLI's agent commands return one JSON object with `schemaVersion`,
`xstateVersion`, `command`, `ok` and either `result` or `error`. Failures exit with
status 1. `--json` is accepted; JSON is also the default for these commands.
No command installs packages, imports application modules, executes code
expressions or runs external effects. `migrate` remains a separate source
transformation command that delegates to the codemod package.

| Command | Contract |
| --- | --- |
| `xstate docs` | Locate installed documentation and read export stability. |
| `xstate inspect machine.json` | Inspect a data-only definition and static graph completeness. |
| `xstate validate machine.json` | Check definition structure. This does not validate runtime event payloads. |
| `xstate simulate machine.json events.json` | Calculate stable snapshots and describe effects without executing them. |
| `xstate test machine.json checks.json` | Explore supplied event representatives and check stable-state safety and reachability assertions. |
| `xstate replay machine.json fixture.json` | Replay a counterexample against the same definition and XState version. |
| `xstate diff before.json after.json` | Report structural JSON changes. Compatibility is explicitly `notChecked`. |

These commands accept JSON definitions, not TypeScript source files. Definitions
with `@code` expressions return `EVALUATOR_REQUIRED` and their JSON Pointer paths.
Definitions requiring custom runtime implementations must use the library with
explicit sources instead. The CLI never fills missing implementations with stubs.

For example, save this as `machine.json`:

```json
{
  "id": "review",
  "initial": "pending",
  "states": {
    "pending": {
      "on": {
        "APPROVE": { "target": "approved" },
        "REJECT": { "target": "rejected" }
      }
    },
    "approved": { "type": "final" },
    "rejected": { "type": "final" }
  }
}
```

An events file is an array such as `[{ "type": "APPROVE" }]`, or an object
`{ "events": [...], "input": ... }` when startup input is required.

A checks file supplies event representatives and at least one assertion:

```json
{
  "events": [{ "type": "APPROVE" }],
  "never": ["#review.rejected"],
  "reachable": ["#review.approved"],
  "limit": 1000
}
```

`never` and `reachable` use existing state IDs prefixed with `#`. Coverage is
relative to the supplied event representatives and stable macrostep snapshots.
The example's event array excludes `REJECT`; it makes no assertion about runs
that send it. An event map instead augments the machine's default cases,
including unconfigured payload-free events and synthetic actor/timer events;
see [event cases](model-based-testing.md).
The default traversal limit is 10,000. Exceeding a bound fails instead of reporting
success. A reachability failure means no supplied representative witnessed the
state, not that the state is proven unreachable.

A forbidden-state failure contains `error.details.fixture`. Save that object and
pass it to `replay`. Its definition hash and XState version prevent accidental
replay against another model. Replay reports a property violation again while the
same assertion still fails. These CLI fixtures are separate from `@xstate/test`
fixtures. Use [model-based testing](model-based-testing.md) for PBT, payload
shrinking, service outcomes, concurrency testing and comparison with an actual
system under test.

## Repair and verify

Preserve the failing event sequence before editing. Reproduce it, make the
smallest behavior change, then replay it and run relevant tests. Check forbidden
behavior and resource cleanup as well as successful outcomes. A corrected type
error must also compile without suppressions or broad casts.

For a running agent, expose public event schemas and descriptions through a
host adapter. Type-only schemas do not describe runtime parameters. Recheck state
revision and host authorization when accepting a command. `snapshot.can(event)`
is advisory, and sending an event does not establish durable commit or completion.
Actor completion capability is distinct from idleness or waiting for input.

Keep sampled tests, bounded exploration and proof distinct. State the event
representatives, state abstraction, time and schedule assumptions, and limits
with the result. Experimental APIs may still change independently of the public
beta surface.
