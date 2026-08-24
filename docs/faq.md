---
title: Frequently asked questions
description: Short answers to the questions most often asked about XState v6.
---

## Is XState v6 stable?

Not yet. v6 is in alpha and is published under the `alpha` dist-tag, so `npm install xstate@alpha` gets the current release. APIs may still change between alpha releases. XState v5 is still supported; use it if you need a stable version today, and see [migrate from v5 to v6](xstate-v5-to-v6.md) when you are ready.

## Where did `assign`, `raise`, `sendTo` and `enqueueActions` go?

They are no longer exported. In v6 every `entry`, `exit` and transition handler is a single function that receives `(args, enq)`. Return a `{ context }` patch instead of `assign(...)`, and use `enq.raise(...)`, `enq.sendTo(...)`, `enq.emit(...)`, `enq.log(...)`, `enq.cancel(...)`, `enq.spawn(...)` and `enq.stop(...)` instead of the action creators. `enqueueActions` has no replacement because every function is already an enqueuing function. See [actions](actions.md) and the [migration guide](xstate-v5-to-v6.md).

## Where are `and`, `or`, `not` and `stateIn`?

Guards are plain JavaScript in v6, so the combinators are gone. Write conditions with `&&`, `||` and `!` inside the transition function, and return `undefined` to reject the event. `stateIn(...)` is replaced by `checkStateIn(self.getSnapshot(), 'some.state')`, which is exported from `xstate`. See [guards](guards.md).

## Does typegen exist in v6?

No. There is no `@xstate/cli`, no `tsTypes`, and no generated type files anywhere in v6. Types come from `schemas` instead: declare `context`, `events`, `input`, `output`, `emitted`, `meta` and `tags` with Zod or any [Standard Schema](https://standardschema.dev) library, or with `types<T>()` when you only want TypeScript inference and no runtime validation. See [TypeScript](typescript.md).

## What happened to `@xstate/immer` and `@xstate/inspect`?

Both packages were removed. Instead of `@xstate/immer`, return an updated `context` patch directly from the transition function; if you want Immer drafts, call Immer's `produce` yourself inside that function. Instead of `@xstate/inspect`, use `actor.subscribe(...)` or the `inspect` option on `createActor(...)`, and use [`@statelyai/inspect`](https://github.com/statelyai/inspect) for a visual inspector. See [inspection](inspection.md) and [inspect actor systems](inspect-actor-systems.md).

## Can I run v5 and v6 side by side?

There is no supported dual-install story, and none is documented. If you want to migrate one machine at a time in a single application, the generic npm alias technique applies: install the second copy under another name, for example `npm install xstate5@npm:xstate@5`, and import from that alias in the modules that still use v5. Treat the two as separate libraries. Actors, snapshots and types are not interchangeable across them, so do not pass a v5 actor into a v6 machine or the reverse.

## Do v5 persisted snapshots work in v6?

No. The internal snapshot shape changed and v5 persisted snapshots are not binary-compatible with v6, so drain or migrate stored state during your rollout. For migrations between your own v6 machine versions, stamp a `version` on the machine and use `machineVersions(...)` with `migrateSnapshot(...)`. See [persistence](persistence.md) and [persist and restore actors](persist-and-restore-actors.md).

## Why is my event ignored?

Either the current state defines no transition for that event type, or the transition function returned `undefined`. Events with no matching transition are ignored, and a transition function that returns `undefined` rejects the event, leaving the state unchanged and running no effects. Check `snapshot.value` and `snapshot.can({ type: 'yourEvent' })`. See [troubleshooting](troubleshooting.md).

## Why didn't my context update?

Transition functions must return the next context; mutating `context` in place does nothing. Return `{ context: { ...context, count: context.count + 1 } }` rather than assigning to `context.count`. Entry and exit functions can return a `context` patch too, but they cannot return a `target`. See [context](context.md) and [troubleshooting](troubleshooting.md).

## Does XState work with React, Vue, Svelte and Solid?

Yes. XState itself is framework-agnostic; an actor is a plain object you can subscribe to. There are official bindings for React, Vue, Svelte and Solid that create or receive an actor, subscribe to its snapshots, and re-render when they change. Install them alongside the alpha core, for example `npm install xstate@alpha @xstate/react@alpha`. See [frameworks](frameworks.md).

## When should I use @xstate/store instead?

Use XState Store when you only need shared state with typed updates and no state-based rules. Use XState when behavior depends on which state you are in: ordered steps, async work with loading, success, failure and retry, events that are only allowed in certain states, parallel or nested behavior, or long-running workflows that must be persisted and resumed. See [choose XState](choose-xstate.md).

## Is XState suitable for the backend?

Yes. A backend workflow restores a persisted snapshot, sends the incoming event, saves the next persisted snapshot and stops the actor. Use one actor per entity or process, and use an idempotency key for external writes, since a resumed workflow may retry a request. See [run backend workflows](backend-workflows.md) and [persistence](persistence.md).

## Does Stately Studio or the VS Code extension support v6?

Visual tooling support for v6 is still in progress, and this documentation makes no claim about which v6 features Stately Studio or the VS Code extension currently handle. Check [stately.ai](https://stately.ai) for the current status. In the meantime, v6 machines can be treated as data with the built-in `serializeMachine(...)`, `machineConfigToJSON(...)` and `createMachineFromConfig(...)` APIs. See [serialization](serialization.md).
