# compact-fsm

## What it teaches

`xstate/fsm`, the compact pure finite state machine runtime: a flat transition table with typed events, typed context and per-state context schemas, driven by calling `machine.transition(state, event)` yourself. It also shows what the entry point deliberately leaves out, so you can tell when to reach for `xstate` instead.

## XState features used

- `createFSM` from `xstate/fsm` — a bare transition table
- `setup({ schemas })` from `xstate/fsm` with `types<T>()` for typed context and event payloads
- `setup({ states })` per-state `schemas.context`, which makes the snapshot a discriminated union on `snapshot.value`
- transitions as a state name, as `{ target, context }`, and as a `({ context, event }) => …` function returning `undefined` for "no transition"
- shallow context patches and reference-stable snapshots for unhandled events
- commented `@ts-expect-error` probes that `pnpm typecheck` verifies

## Run it

```bash
pnpm install
pnpm start
```

The demo drives three machines: a toggle with no context, a PIN keypad with typed events and a lockout counter, and a request machine whose per-state context schemas narrow `snapshot.context` per state. The last section prints the entry point's exports.

## When to use it, and what is missing

`xstate/fsm` is a pure function of `(state, event)`. It has no actor: nothing is started, nothing is scheduled, nothing subscribes. Per the source (`packages/core/src/fsm.ts`), the entry point exports only `createFSM`, `setup` and `types`, and the config surface is `{ id?, initial, context?, states: { [name]: { on? } } }` — nothing else. That means there are no:

- actions, `assign`, `raise`, `emit` or `enqueue`
- entry/exit actions
- guards (branch inside a transition function instead)
- delays, `after`, timeouts, or any clock
- actors, `invoke`, `spawn`, or child machines
- hierarchical, parallel, history, final or choice states
- eventless (`always`) transitions
- persistence, rehydration or versioning
- inspection

Reach for it when a `switch` statement would do but you want a declarative, serializable transition table and typed events; the config is plain JSON-shaped data, so it can be diffed, stored or visualized. Move to `createMachine`/`createActor` from `xstate` the moment the machine needs side effects, timers, child actors or nesting — the `setup({ schemas, states })` shape is the same, so the definition ports over.

Two runtime details worth knowing: an event with no matching transition returns the _same_ snapshot object, and `context` in a transition result is a shallow patch that is only applied if it actually changes a value.

## Inspect it

There is nothing to inspect. `xstate/fsm` never creates an actor, so there is no snapshot stream for [Stately Inspector](https://stately.ai/docs/inspector) to subscribe to and `@statelyai/sdk` is not a dependency of this example. To inspect a machine like this, build it with `createMachine` from `xstate`, run it with `createActor`, and pass `inspect` — see [machine-input-output](../machine-input-output) for that wiring.
