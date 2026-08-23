---
title: Machine configuration
description: Reference for the top-level state machine configuration.
---

Create state machine logic with `createMachine(...)`.

```ts
const machine = createMachine({
  id: 'request',
  context: { attempts: 0 },
  initial: 'idle',
  states: { idle: {}, loading: {} }
});
```

The root of a machine is a state node. It accepts everything a [state node](#state-node-properties) accepts, plus the machine-level properties below.

## Machine properties

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable identifier for the root state node. Used by `#id` targets and in state node ids. |
| `description` | `string` | Human-readable description. |
| `context` | value or `({ input, spawn, actors, self }) => value` | Initial [context](context.md). Required when the context type is not `never`. |
| `initial` | `string` or `{ target, input }` | Initial child state. The object form passes [state input](state-input.md). |
| `states` | `Record<string, StateNodeConfig>` | Child [state nodes](states.md). |
| `on` | `Record<EventType, TransitionConfigOrTarget>` | [Transitions](transitions.md) available in every child state. |
| `entry` | transition function or named action | Runs when the machine starts. |
| `exit` | transition function or named action | Runs when the machine stops. |
| `invoke` | `InvokeConfig` or `InvokeConfig[]` | [Actor logic](invoke.md) invoked for the machine's lifetime. |
| `always` | transition | Eventless [transition](transitions.md) checked after every microstep. |
| `after` | `Record<delay, transition>` | [Delayed transitions](delays.md). |
| `timeout` | `number`, delay name, or function | Deadline for the machine. See [timeouts](timeouts.md). |
| `onTimeout` | transition | Taken when `timeout` elapses. Required with `timeout`. |
| `onDone` | transition | Taken when a final child state is reached. See [final states](final-states.md). |
| `onError` | transition | Taken on `xstate.error.*` raised below this node. See [errors](lifecycle-and-errors.md). |
| `output` | value or `({ context, event }) => value` | [Output](input-output.md) produced on completion. |
| `schemas` | `{ context, events, internalEvents, emitted, input, output, meta, tags, children, actions, guards }` | Standard Schema definitions. See [TypeScript](typescript.md). |
| `internalEvents` | `readonly EventType[]` | Deprecated compatibility list for events declared in `schemas.events`; use `schemas.internalEvents` instead. See [internal events](internal-events.md). |
| `actions` | `Record<string, (params, args) => void>` | Named action sources. See [setup and provide](setup-and-provide.md). |
| `guards` | `Record<string, (params, args) => boolean>` | Named guard sources. See [guards](guards.md). |
| `actors` | `Record<string, ActorLogic>` | Named actor logic sources. See [invoke](invoke.md). |
| `delays` | `Record<string, number \| (args) => number>` | Named delay sources. See [delays](delays.md). |
| `version` | `string` | The machine's own version, stamped onto persisted snapshots. See [persistence](persistence.md). |
| `migrate` | `(persistedSnapshot, fromVersion) => unknown` | Upgrades a persisted snapshot whose `version` does not match. Restoring a mismatched snapshot without it throws. |
| `meta` | `object` | Metadata for the root state node. Must match `schemas.meta`. |
| `tags` | `string[]` | Tags for the root state node. Must match `schemas.tags`. |
| `options` | `{ maxIterations }` | Microstep limit for infinite-loop detection. Defaults to `Infinity`. |

Named actions take their params as the first argument, so they can be called directly or enqueued:

```ts
const machine = createMachine({
  actions: { notify: (params: { msg: string }) => toast(params.msg) },
  context: { total: 0 },
  initial: 'cart',
  states: {
    cart: {
      on: {
        checkout: ({ context, actions }, enq) => {
          if (!context.total) return;
          enq(actions.notify, { msg: 'Charging' });
          return { target: 'charging' };
        }
      }
    },
    charging: {}
  }
});
```

## State node properties

Every non-root state node accepts the following. All are optional.

| Property | Type | Description |
| --- | --- | --- |
| `initial` | `string` or `{ target, input }` | Initial child state. The object form passes [state input](state-input.md). |
| `states` | `Record<string, StateNodeConfig>` | Child state nodes. |
| `type` | `'atomic' \| 'compound' \| 'parallel' \| 'final' \| 'history'` | Node kind. See [parallel states](parallel-states.md), [final states](final-states.md) and [history states](history-states.md). |
| `history` | `'shallow' \| 'deep' \| boolean` | History kind for a history state node. |
| `target` | `string \| string[]` | Default target of a history state node. |
| `on` | `Record<EventType, TransitionConfigOrTarget>` | Event [transitions](transitions.md). |
| `entry` | transition function or named action | Runs on entering this state. |
| `exit` | transition function or named action | Runs on exiting this state. |
| `invoke` | `InvokeConfig` or `InvokeConfig[]` | [Actors](invoke.md) started on entry and stopped on exit. |
| `after` | `Record<delay, transition>` | [Delayed transitions](delays.md) scheduled on entry. |
| `timeout` / `onTimeout` | see above | State deadline and its transition. See [timeouts](timeouts.md). |
| `always` | transition | Eventless [transition](transitions.md) taken while this state is active. |
| `onDone` | transition | Taken when a final child state is reached. |
| `onError` | transition | Taken on an error raised at or below this state. |
| `output` | value or mapper | [Output](input-output.md) of a final state node. |
| `id` | `string` | Unique id, targetable as `#id`. |
| `route` | `RouteConfig` | Enables `{ type: 'xstate.route', to: '#id' }`. Requires an explicit `id`. See [route states](route-states.md). |
| `meta` | `object` | Metadata read with `snapshot.getMeta()`. See [states](states.md). |
| `tags` | `string[]` | Tags read with `snapshot.hasTag(...)`. |
| `description` | `string` | Human-readable description. |
| `order` | `number` | Document order override. |
| `schemas` | `{ input, ... }` | Per-state schemas, usually declared in `setup({ states })`. |

A [choice state](choice-states.md) is a different shape: it requires `type: 'choice'` and a `choice` function, and accepts only `id`, `tags`, `meta`, `description` and `route`. It cannot have `states`, `on`, `entry`, `exit`, `invoke`, `after`, `always` or `output`.

```ts
const machine = createMachine({
  initial: 'uploading',
  states: {
    uploading: {
      invoke: { src: uploadFile, onDone: { target: 'check' } },
      timeout: 30_000,
      onTimeout: { target: 'failed' },
      tags: ['busy']
    },
    check: {
      type: 'choice',
      choice: ({ context }) => (context.size > 0 ? 'done' : 'failed')
    },
    done: { type: 'final', output: ({ context }) => ({ url: context.url }) },
    failed: {}
  }
});
```

## Sources and implementations

`actions`, `guards`, `actors` and `delays` can be declared on the machine, or on [`setup(...)`](setup-and-provide.md) when several machines share them or when per-state schemas are needed. Use `machine.provide(...)` to replace an implementation without changing the machine structure.

```ts
const testMachine = machine.provide({
  actors: { chargeCard: fakeChargeCard }
});
```

A media player machine may provide browser audio actors in production and fake actors in tests. An order machine may provide different payment actors for development and production.

## TypeScript

`createMachine(...)` infers state keys and literal transition targets from `states`. Use `schemas` when events, context, input, output, meta or tags need explicit types, and [`setup(...)`](setup-and-provide.md) when those types must exist before the machine is written.

## Machine cheatsheet

```ts
const machine = createMachine({
  id: 'workflow',
  version: '1.0.0',
  schemas: { events: { start: z.object({}), stop: z.object({}) } },
  context: { attempts: 0 },
  initial: 'idle',
  states: {
    idle: { on: { start: { target: 'active' } } },
    active: {
      timeout: 10_000,
      onTimeout: { target: 'idle' },
      on: { stop: { target: 'idle' } }
    }
  }
});

const provided = machine.provide({ actors: { chargeCard } });
```
