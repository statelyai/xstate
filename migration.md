# Migrating from XState v5 to v6

XState v6 is a major release that simplifies the authoring experience and unifies actions, guards, and transitions under a single **inline function** model. Most v5 concepts still exist - they are expressed differently.

This guide is organized by area. Skim the **Quick reference** below, then jump to the sections relevant to your codebase.

---

## Quick reference

| v5                                                      | v6                                                                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `assign({ count: 1 })`                                  | inline fn returning a shallow `{ context: { count: 1 } }` patch                                                                     |
| `raise({ type: 'NEXT' })`                               | `enq.raise({ type: 'NEXT' })`                                                                                                       |
| `sendTo(ref, ev)` / `sendParent(ev)` / `forwardTo(ref)` | `enq.sendTo(ref, ev)`                                                                                                               |
| `emit({ type: 'x' })`                                   | `enq.emit({ type: 'x' })`                                                                                                           |
| `log(...)`                                              | `enq.log(...)`                                                                                                                      |
| `cancel(id)`                                            | `enq.cancel(id)`                                                                                                                    |
| `spawnChild(logic, opts)`                               | `enq.spawn(logic, opts)`                                                                                                            |
| `stopChild(idOrRef)`                                    | `enq.stop(ref)`                                                                                                                     |
| `enqueueActions(({ enqueue }) => {...})`                | regular inline `(args, enq) => { ... }` function                                                                                    |
| `and([...])`, `or([...])`, `not(...)`                   | plain JS `&&`, `\|\|`, `!` inside the guard/inline fn                                                                               |
| `stateIn('foo')`                                        | `checkStateIn(self.getSnapshot(), 'foo')`                                                                                           |
| `interpret(machine)`, `Interpreter`                     | `createActor(machine)` (already in v5; legacy alias gone)                                                                           |
| `fromPromise(async ({ input }) => ...)`                 | `createAsyncLogic({ run: async ({ input }, enq) => ... })`                                                                          |
| `fromCallback(cb)`                                      | `createCallbackLogic(cb)` (same signature, renamed)                                                                                 |
| `fromObservable(fn)`                                    | `createObservableLogic(fn)` (same signature, renamed)                                                                               |
| `fromEventObservable(fn)`                               | `createEventObservableLogic(fn)` (same signature, renamed)                                                                          |
| `fromTransition(reducer, initial)`                      | `createLogic({ context: initial, run: ({ context, event }) => ({ context: reducer(context, event) }) })`                            |
| `types: {} as { context: ..., events: ...}`             | `schemas: { context, events, ... }` (Zod / Standard Schema, or `types<T>()` for type-only)                                          |
| `actor.send({ type: 'INC' })`                           | `actor.send(...)` keeps working; new typed `actor.trigger.INC()`                                                                    |
| `@xstate/immer`                                         | removed - return updated `context` patches directly                                                                                 |
| `@xstate/inspect`                                       | removed - use `inspect` option on `createActor`, `actor.subscribe`, or [`@statelyai/inspect`](https://github.com/statelyai/inspect) |

---

## What's new in v6

Beyond simplifying the action/guard surface, v6 introduces a number of features with no v5 equivalent. Each links to its detailed section below.

| Feature                                                                           | What it gives you                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Inline function transitions](#1-inline-functions-replace-action-creators)        | Transitions and actions are plain functions; `enq` queues side effects.                                                                                                                                           |
| [Standard Schema runtime types](#3-createmachine-schemas-replace-types)           | `schemas.context`/`events`/`input`/`output`/`emitted`/`meta`/`tags` accept Zod (or any [Standard Schema](https://standardschema.dev)) - single source of truth for runtime validation _and_ TypeScript inference. |
| [State input](#5-state-input)                                                     | State nodes may declare a typed `input` payload that callers must provide on transition.                                                                                                                          |
| [`actor.trigger.X()`](#6-typed-actortrigger)                                      | Type-safe event dispatcher generated from `schemas.events` - no event-object boilerplate.                                                                                                                         |
| [`createAsyncLogic`](#7-async-actors-frompromise--createasynclogic)               | `fromPromise` rebuilt with `id`, `timeout`, `AbortSignal`, durable `enq.step()`, and event emission.                                                                                                              |
| [`createLogic`](#8-createlogic-stateful-actor-logic)                              | New stateful actor logic creator - like a small state machine defined as a single transition function with `enq`.                                                                                                 |
| [`enq.listen` / `enq.subscribeTo`](#9-enqlisten-and-enqsubscribeto)               | Declaratively wire child-actor emitted events or snapshot streams back to the parent.                                                                                                                             |
| [Internal events](#12-internal-events)                                            | `internalEvents: ['tick', 'change.*']` - events that can be raised inside the machine but rejected when sent from outside.                                                                                        |
| [Choice states](#13-choice-states)                                                | First-class `type: 'choice'` for declarative branch routing (replaces transient `always` chains).                                                                                                                 |
| [State timeouts](#14-state-and-async-timeouts)                                    | `timeout` + `onTimeout` per state - independent of `after`; auto-cancelled on exit.                                                                                                                               |
| [Duration strings](#14-state-and-async-timeouts)                                  | `'250ms'`, `'5s'` / `'1.5s'`, and ISO 8601 (`'PT1M30S'`, `'P1DT12H'`) accepted by state timeouts and async-logic timeouts.                                                                                        |
| [`actor.select`](#22-actorselect)                                                 | Derive a subscribable, memoized selection from an actor's snapshot - `actor.select(s => s.context.x)`.                                                                                                            |
| [Route states](#23-route-states)                                                  | A state with `route` can be navigated to directly via `actor.send({ type: 'xstate.route', to: '#id' })`, gated by an inline route guard/resolver.                                                                 |
| [Actor registry](#24-actor-registry)                                              | `actor.system.get(registryKey)` / `system.get(registryKey)` look up actors by `registryKey` without passing refs. The root actor can be named via `system.createActor(machine, { registryKey })`.                 |
| [Snapshot versioning](#20-persistence--rehydration)                               | `version` on the machine is stamped onto persisted snapshots and checked on restore.                                                                                                                              |
| [Serialization](#21-machine-as-data-serialization-json-configs-scxml)             | `serializeMachine` / `machineConfigToJSON` / `createMachineFromConfig` are now public - round-trip a machine to/from a plain JSON config.                                                                         |
| [`createMachineFromConfig`](#21-machine-as-data-serialization-json-configs-scxml) | Build a machine from a plain JSON config with serialized actions - useful for SCXML round-trip, persistence, or storing machines as data.                                                                         |
| [`initial: { target, input }`](#5-state-input)                                    | Object form for `initial` lets you provide state input on initialization.                                                                                                                                         |

---

## 1. Inline functions replace action creators

This is the largest change. Action creators (`assign`, `raise`, `sendTo`, `emit`, `log`, `cancel`, `enqueueActions`, `spawnChild`, `stopChild`, `forwardTo`, `sendParent`) are **no longer exported**.

In v6, every `entry`, `exit`, and transition handler is a **single function** that receives `(args, enq)` where `enq` is a queue of side effects. The function can also **return** an object that the engine applies after it runs:

- **Transition handlers** (`on`, `always`, `after`, `onTimeout`, `onDone`, `onError`) - may return a target, a new `context`, `reenter`, or `meta`.
- **Entry / exit actions** - may return a new `context` (or `children`). They **cannot** return a `target`; entry/exit cannot transition.

Returned `context` values are shallow patches. Omitted top-level keys are preserved when the current context is compatible with the next state. If a transition targets a state with narrower `schemas.context`, include the keys needed to satisfy that target state's context.

### Entry / exit actions

```ts
// v5
import { createMachine, assign } from 'xstate';

const machine = createMachine({
  context: { count: 0 },
  entry: assign({ count: 1 }),
  exit: () => console.log('bye')
});
```

```ts
// v6
import { createMachine } from 'xstate';

const machine = createMachine({
  context: { count: 0 },
  entry: () => ({ context: { count: 1 } }),
  exit: (_, enq) => {
    enq(() => console.log('bye'));
  }
});
```

### Inline-function arguments

The first argument is an object. The keys differ slightly between **transition handlers** (`on`, `always`, `after`, `onTimeout`, `onDone`, `onError`) and **entry/exit actions**:

| Key            | Transition handler | Entry/exit action | Description                                                          |
| -------------- | :----------------: | :---------------: | -------------------------------------------------------------------- |
| `context`      |         ✓          |         ✓         | Current context                                                      |
| `event`        |         ✓          |         ✓         | The event that triggered this transition / state entry / state exit  |
| `self`         |         ✓          |         ✓         | This actor's `ActorRef` - call `self.getSnapshot()` for the snapshot |
| `parent`       |         ✓          |         ✓         | Parent actor's `ActorRef`, or `undefined` for the root               |
| `children`     |         ✓          |         ✓         | Record of currently-spawned/invoked child refs                       |
| `actions`      |         ✓          |         ✓         | Named-action map from `createMachine`/`provide` (for referencing)    |
| `actorSources` |         ✓          |         ✓         | Named actor source map                                               |
| `guards`       |         ✓          |         ✓         | Named-guard map                                                      |
| `delays`       |         ✓          |         ✓         | Named-delay map                                                      |
| `value`        |         ✓          |         -         | Current `StateValue`                                                 |
| `system`       |         ✓          |         ✓         | The actor system                                                     |
| `params`       |         -          |         ✓         | Parameterized-action params (when invoked as `{ type, params }`)     |

### Transitions

```ts
// v5
on: {
  INC: {
    actions: assign(({ context }) => ({ count: context.count + 1 }))
  },
  TOGGLE: {
    target: 'inactive',
    actions: () => console.log('toggling')
  }
}
```

```ts
// v6
on: {
  INC: ({ context }) => ({
    context: { count: context.count + 1 }
  }),
  TOGGLE: (_, enq) => {
    enq(() => console.log('toggling'));
    return { target: 'inactive' };
  }
}
```

### The `enq` enqueuer

The second argument is the action queue. It buffers side effects so the transition function stays pure.

<!-- members of EnqueueObject in packages/core/src/types.ts -->

| Method                          | Purpose                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `enq(fn, ...args)`              | Enqueue a plain side-effect function (replaces ad-hoc inline `() => ...` actions)  |
| `enq.raise(event, opts?)`       | Raise an internal event (`opts.delay`, `opts.id`)                                  |
| `enq.cancel(id)`                | Cancel a previously raised/sent event by its `id` (replaces v5 `cancel`)           |
| `enq.emit(event)`               | Emit an event observable via `actor.on(...)`                                       |
| `enq.log(...args)`              | Log via the configured logger (replaces v5 `log`)                                  |
| `enq.sendTo(ref, event, opts?)` | Send an event to another actor (replaces v5 `sendTo` / `sendParent` / `forwardTo`) |
| `enq.spawn(logic, opts?)`       | Spawn a child actor; `opts.registryKey` registers it in a typed system registry    |
| `enq.stop(ref?)`                | Stop a spawned child or listener (replaces v5 `stopChild`)                         |
| `enq.listen(ref, type, mapper)` | Subscribe to a child's emitted events; remap → parent (returns a stoppable ref)    |
| `enq.subscribeTo(ref, mappers)` | Subscribe to a child's snapshot stream (returns a stoppable ref)                   |

```ts
// v6
on: {
  CLICK: (_, enq) => {
    enq.raise({ type: 'TICK' });
    enq.emit({ type: 'clicked' });
    enq.raise({ type: 'LATE' }, { delay: 500, id: 'lateId' });
  };
}
```

### What inline functions return

A **transition handler** may return:

| Field     | Meaning                                                          |
| --------- | ---------------------------------------------------------------- |
| `target`  | next state (`string` or `string[]`)                              |
| `context` | shallow context patch (treat as immutable - return a new object) |
| `reenter` | force re-entry even if `target` resolves to the current state    |
| `meta`    | per-transition meta info                                         |

An **entry / exit action** may return:

| Field      | Meaning                     |
| ---------- | --------------------------- |
| `context`  | shallow context patch       |
| `children` | replacement children record |

Returning nothing (`undefined`) means "no changes". For transition handlers specifically, returning nothing also means **the event is treated as unhandled at this state** - useful for inline guarding:

```ts
// v6 - guard inline by returning undefined
on: {
  toggle: ({ context }) => {
    if (context.count > 0) return { target: 'inactive' };
    // no return ⇒ event unhandled, machine stays in current state
  };
}
```

### `enqueueActions` is gone

`enqueueActions(({ enqueue }) => ...)` was a way to mix imperative side effects with conditional logic. v6 absorbs this into the regular inline function:

```ts
// v5
actions: enqueueActions(({ context, enqueue }) => {
  if (context.x) {
    enqueue.assign({ y: 1 });
    enqueue.raise({ type: 'GO' });
  }
});
```

```ts
// v6
on: {
  EV: ({ context }, enq) => {
    if (context.x) {
      enq.raise({ type: 'GO' });
      return { context: { y: 1 } };
    }
  };
}
```

---

## 2. Guards

The combinators `and`, `or`, `not`, plus `stateIn`, and the types `GuardPredicate` and `GuardArgs`, are no longer exported.

```ts
// v5
import { and, not, stateIn } from 'xstate';
on: {
  EV: {
    target: 'next',
    guard: and([
      ({ context }) => context.isAdmin,
      not(stateIn('blocked'))
    ])
  }
}
```

```ts
// v6
import { checkStateIn } from 'xstate';
on: {
  EV: ({ context, self }) => {
    if (context.isAdmin && !checkStateIn(self.getSnapshot(), 'blocked')) {
      return { target: 'next' };
    }
  };
}
```

`checkStateIn(snapshot, stateValue)` accepts an `AnyMachineSnapshot` plus either a state-id string (e.g. `'#blocked'`), a state-path string (e.g. `'parent.child'`), or a nested state-value object.

Named `guards` on `setup` or `createMachine` are available as typed functions
in transition (and `choice`) function args:

```ts
// v6
choice: ({ context, guards }) => {
  if (guards.isVip(context)) {
    return { target: 'vipFlow' };
  }
  return { target: 'defaultFlow' };
},
guards: {
  isVip: ({ isVip }) => isVip
}
```

---

## 3. `createMachine`: schemas replace `types`

The `types: {} as { context: ..., events: ... }` shim is replaced by **Standard Schema**-compatible runtime schemas. Zod is the canonical choice.

If you want types without a runtime schema library (the closest equivalent to v5's type-only `types`), use `types<T>()`:

```ts
import { createMachine, types } from 'xstate';

createMachine({
  schemas: {
    context: types<{ count: number }>(),
    events: { inc: types<{ by: number }>() }
  },
  context: { count: 0 }
  // ...
});
```

```ts
// v5
const m = createMachine({
  types: {} as {
    context: { count: number };
    events: { type: 'INC'; by: number };
  },
  context: { count: 0 },
  on: {
    INC: {
      actions: assign(({ context, event }) => ({
        count: context.count + event.by
      }))
    }
  }
});
```

```ts
// v6
import { z } from 'zod';

const m = createMachine({
  schemas: {
    context: z.object({ count: z.number() }),
    events: {
      INC: z.object({ by: z.number() })
    }
  },
  context: { count: 0 },
  on: {
    INC: ({ context, event }) => ({
      context: { count: context.count + event.by }
    })
  }
});
```

### Full schema surface

<!-- keys of SetupSchemas in packages/core/src/setup.ts / MachineSchemas in types.v6.ts -->

```ts
schemas: {
  context:  ZodSchema,
  events:   { [eventType: string]: ZodSchema },        // map, not union
  emitted:  { [eventType: string]: ZodSchema },
  input:    ZodSchema,                                  // machine input
  output:   ZodSchema,                                  // machine output
  meta:     ZodSchema,                                  // per-state meta
  tags:     z.enum([...]),                              // tag values
  children: { [childId: string]: ZodSchema }            // invoked/spawned child schemas
}
```

`events` and `emitted` are now **maps keyed by event type**, not unions. Each value is the schema for the event payload (excluding `type`).

> **Note:** `schemas` drive **TypeScript inference only**. Runtime validation
> of context/events/input against the schemas is **not** performed in this
> release - do not rely on `schemas` to reject malformed events at runtime
> (use `internalEvents` for inbound-event restriction, or validate at your
> boundary).

### Machine input

In v5, machine input was typed via `types: {} as { input: ... }`. In v6 it moves to `schemas.input`:

```ts
// v5
createMachine({
  types: {} as { input: { id: string } },
  context: ({ input }) => ({ id: input.id })
});

// v6
createMachine({
  schemas: {
    input: z.object({ id: z.string() })
  },
  context: ({ input }) => ({ id: input.id })
});
```

### Inferred context (no schema)

If you omit `schemas.context`, the context type is inferred from the literal `context` value or from the `({ input }) => ...` factory.

---

## 4. `setup()` and providing implementations

`setup()` still exists in v6 and still accepts `actions`, `guards`, `actorSources`, and `delays` (merged into every machine created from it). What changed: `types` is replaced by `schemas`, v5 `actors` is renamed to `actorSources`, and `setup()` gains a `states` key for declaring **state-level input schemas** so `createMachine` and `createStateConfig` are typed for the `initial: { target, input }` form and for transitions targeting those states.

```ts
// v6 - setup with root schemas and state-level input schemas
import { setup } from 'xstate';
import { z } from 'zod';

const s = setup({
  schemas: {
    events: {
      LOAD: z.object({})
    }
  },
  states: {
    loading: {
      schemas: { input: z.object({ userId: z.string() }) }
    }
  }
});

const loading = s.createStateConfig({});

const machine = s.createMachine({
  initial: { target: 'loading', input: { userId: 'u1' } },
  states: { loading },
  on: {
    LOAD: '.loading'
  }
});
```

`actions`, `guards`, `actorSources`, and `delays` may be declared on `setup()` **or** directly on the `createMachine` config:

```ts
// v6
import { createMachine, createAsyncLogic } from 'xstate';

const machine = createMachine({
  context: { ready: false },
  actions: {
    log: (_, params: { msg: string }) => console.log(params.msg)
  },
  guards: {
    isReady: ({ context }) => context.ready === true
  },
  actorSources: {
    fetchUser: createAsyncLogic({ run: ({ input }) => fetch(`/u/${input.id}`) })
  },
  delays: {
    short: 250
  }
  // ... initial / states
});
```

Or attached after the fact via `machine.provide({ actions, guards, actorSources })`:

```ts
const provided = machine.provide({
  actions: { log: (_, p) => myLogger(p) }
});
```

`provide()` is typed to accept `actions`, `guards`, `actorSources`, and `delays`.

---

## 5. State input

**New in v6**, with no v5 equivalent. Each state node can declare an input schema in `setup()`. Transitions targeting that state pass `input` alongside `target`; the target state's entry/exit actions read it from args. Unrelated to v5's `params` (which existed only on parameterized **action/guard** objects, not state nodes - that mechanism remains in v6 unchanged for parameterized actions).

```ts
// v6
import { setup, createActor } from 'xstate';
import { z } from 'zod';

const s = setup({
  states: {
    loading: {
      schemas: { input: z.object({ userId: z.string() }) }
    }
  }
});

const machine = s.createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        LOAD: {
          target: 'loading',
          input: { userId: 'u1' } // typed against schemas.input
        }
      }
    },
    loading: {
      entry: ({ input }) => {
        console.log(input.userId); // input typed as { userId: string }
      }
    }
  }
});
```

The `initial` field accepts an **object form** `{ target, input? }` so the initial state can also receive input. Plain string `initial: 'idle'` is still supported when no input is needed:

```ts
s.createMachine({
  initial: { target: 'loading', input: { userId: 'u1' } },
  states: { loading: { entry: ({ input }) => /* ... */ } }
});
```

No migration is required if you didn't use this feature.

---

## 6. Typed `actor.trigger`

**New in v6.** Actors expose a `trigger` namespace - a typed dispatcher generated from `schemas.events` - alongside the existing `actor.send(...)`:

```ts
const actor = createActor(machine).start();

actor.trigger.INC({ by: 5 }); // type-checked: must be { by: number }
actor.trigger.RESET(); // payload-less event - no args
```

`actor.send(...)` keeps working unchanged.

---

## 7. Async actors: `fromPromise` → `createAsyncLogic`

`fromPromise` was renamed to `createAsyncLogic` and now supports `id`, `timeout`, an `AbortSignal`, an event emitter, and **durable steps** via `enq.step(key, exec)`.

```ts
// v5
import { fromPromise } from 'xstate';

const fetchUser = fromPromise(async ({ input }: { input: { id: string } }) => {
  const r = await fetch(`/users/${input.id}`);
  return r.json();
});
```

```ts
// v6
import { createAsyncLogic } from 'xstate';

const fetchUser = createAsyncLogic({
  id: 'fetchUser',
  timeout: '10s', // ms or ISO8601 duration
  run: async ({ input, signal, self }, enq) => {
    const user = await enq.step('fetch', () =>
      fetch(`/users/${input.id}`, { signal }).then((r) => r.json())
    );
    enq.emit({ type: 'userLoaded', user });
    return user;
  }
});
```

`enq.step(key, exec)` records each step's outcome on the snapshot under `effects[key]`, so on rehydration the step is **not re-executed** - the previous result is replayed. This makes async logic durable across restarts.

When `timeout` elapses, the logic aborts and rejects with `TimeoutError` (also exported):

```ts
import { TimeoutError } from 'xstate';
```

### Other logic helpers

<!-- actor logic creators exported from packages/core/src/actors/index.ts -->

```ts
import {
  createLogic, // stateful, transition-style logic with enq (see §8)
  createAsyncLogic, // promise / async with timeout + signal + step
  createCallbackLogic, // typed callback factory
  createObservableLogic,
  createEventObservableLogic,
  createListenerLogic, // listen to streams; map to events
  createSubscriptionLogic // store subscription helpers
} from 'xstate';
```

---

## 8. `createLogic`: stateful actor logic

**New in v6.** A lightweight alternative to a full state machine when you want an actor with custom context, events, and effects but no hierarchical states or transitions. The `run` function is invoked for every received event and returns either nothing or a partial snapshot update.

```ts
import { createLogic, createActor } from 'xstate';

const counterLogic = createLogic({
  id: 'counter',
  context: { count: 0 },
  run: ({ context, event }, enq) => {
    if (event.type !== 'inc') return;

    enq.emit({ type: 'counted' });
    return { context: { count: context.count + 1 } };
  }
});

const actor = createActor(counterLogic).start();
actor.send({ type: 'inc' });
actor.getSnapshot().context.count; // 1
```

`context` may be a value or a factory `({ input }) => TContext`.
`createLogic` accepts type-only `schemas.input` and `schemas.output` to type `input`, returned `output`, `InputFrom`, and `OutputFrom`.

`enq` for `createLogic` (different from `createAsyncLogic`'s) exposes:

| Method                  | Purpose                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enq.emit(event)`       | Emit an event observable via `actor.on(...)`                                                                                                              |
| `enq.raise(event)`      | Raise an internal event for this logic's own `run`                                                                                                        |
| `enq.sendBack(event)`   | Send an event back to the parent actor                                                                                                                    |
| `enq.effect(exec)`      | Run a one-shot side effect; the optional return is a cleanup function                                                                                     |
| `enq.effect(key, exec)` | **Keyed effect** - started once and tracked on the snapshot under `effects[key]`; not re-run on subsequent transitions; cleanup runs when the actor stops |

Keyed effects are how durable subscriptions are wired up - `createListenerLogic` and `createSubscriptionLogic` build on this pattern.

The return value (if provided) is a partial update to the snapshot:

```ts
type LogicPatch<TContext, TOutput, TInput> = Partial<{
  context: TContext;
  input: TInput | undefined;
  status: 'active' | 'done' | 'error' | 'stopped';
  output: TOutput;
  error: unknown;
  effects: Record<string, LogicEffectState>;
}>;
```

---

## 9. `enq.listen` and `enq.subscribeTo`

Two new spawn-companion APIs make wiring up child-to-parent communication declarative.

`enq.listen(ref, eventType, mapper)` subscribes to **emitted events** from a spawned actor, with optional wildcard support, and dispatches a derived event back to the parent:

```ts
entry: (_, enq) => {
  const child = enq.spawn(childLogic, { id: 'child' });

  enq.listen(child, 'data.*', (ev) => ({
    type: 'CHILD_DATA',
    payload: (ev as any).value
  }));
};
```

`enq.subscribeTo(ref, mappers)` subscribes to the child's **snapshot stream** (or to `done`/`error`/`snapshot` lifecycle events):

```ts
entry: (_, enq) => {
  const child = enq.spawn(asyncLogic, { id: 'fetch' });

  enq.subscribeTo(child, {
    done: (output) => ({ type: 'FETCH_DONE', output }),
    error: (err) => ({ type: 'FETCH_ERROR', err })
  });
};
```

Both return an `ActorRef` that can be stopped via `enq.stop(ref)`.

---

## 10. `interpret` and `Interpreter` removed

```ts
// v5
import { interpret, Interpreter } from 'xstate';
const service = interpret(machine).start();

// v6
import { createActor } from 'xstate';
const actor = createActor(machine).start();
```

`createActor` already existed in v5; v6 removes the legacy alias.

---

## 11. `invoke.src` resolves actor logic directly

In v5 you typically referenced an actor by string and registered it via `setup({ actors: { ... } })` or the second arg to `createMachine`. In v6 the named source map is `actorSources`, and you may pass the logic object directly to `invoke.src`:

```ts
// v5
invoke: {
  src: 'fetchUser',
  input: ({ event }) => ({ id: event.userId })
}

// v6
invoke: {
  src: fetchUserLogic,            // direct reference
  input: ({ event }) => ({ id: event.userId })
}
```

String IDs still work when the actor is registered on `createMachine({ actorSources: { ... } })` directly or supplied via `machine.provide({ actorSources: { ... } })`. Prefer string IDs for any child you intend to **persist** - children spawned/invoked from inline logic objects cannot be rehydrated from a registry and `getPersistedSnapshot()` throws for them in development.

`invoke.src` may also be a **function** resolving to logic or to a registered name: `src: ({ actorSources, context, event, self }) => actorSources.fetchUser`.

An `invoke` may declare its own `timeout` / `onTimeout` (independent of state-level `timeout`): when the timeout elapses before the invoked actor completes, the `onTimeout` transition is taken and the invocation is cancelled.

### Sending to the parent

The old `sendParent` action creator is gone. The parent ref is available on `args`:

```ts
// v5
on: {
  FORWARD_DEC: {
    actions: [sendParent({ type: 'DEC' })];
  }
}
```

```ts
// v6
on: {
  FORWARD_DEC: ({ parent }, enq) => {
    enq.sendTo(parent, { type: 'DEC' });
  };
}
```

### Spawning children

```ts
// v5
entry: spawnChild('childMachine', { id: 'child', input: { x: 1 } });

// v6
entry: (_, enq) => {
  const ref = enq.spawn(childMachine, { id: 'child', input: { x: 1 } });
};
```

Access children inside transitions via `({ children })`:

```ts
on: {
  PING_CHILD: ({ children }, enq) => {
    enq.sendTo(children.child, { type: 'PING' });
  };
}
```

---

## 12. Internal events

Events listed in `internalEvents` can be **raised** internally but are **rejected** when sent from outside the actor. Wildcard patterns are supported.

```ts
const machine = createMachine({
  schemas: {
    events: {
      START: z.object({}),
      tick: z.object({}),
      'change.value': z.object({ value: z.string() })
    }
  },
  internalEvents: ['tick', 'change.*'] as const,
  initial: 'idle',
  states: {
    idle: {
      on: {
        START: (_, enq) => {
          enq.raise({ type: 'tick' });
        },
        tick: 'done'
      }
    },
    done: {}
  }
});

const actor = createActor(machine).start();
actor.send({ type: 'tick' }); // throws: Internal event "tick" cannot be sent to actor "…" from outside.
```

---

## 13. Choice states

A new state `type: 'choice'` provides branch routing - equivalent to a transient `always` block but more explicit. A choice state declares a single `choice` function that resolves to a target:

```ts
// v6
states: {
  routing: {
    type: 'choice',
    choice: ({ context }) => {
      if (context.isVip)      return { target: 'vipFlow' };
      if (context.overBudget) return { target: 'review' };
      return { target: 'standardFlow' };
    }
  },
  vipFlow: {},
  review: {},
  standardFlow: {}
}
```

The function must resolve to a target - returning `undefined` throws "must resolve to a target".

Choice states are entered automatically by routing **into** them. They cannot themselves declare `invoke`, `after`, `on`, or `entry`/`exit` (machine creation rejects these).

---

## 14. State and async timeouts

State nodes accept a `timeout` and an `onTimeout` transition. Unlike `after`, the timer is cancelled if the state is exited by any other means, and the two coexist as independent timers.

```ts
states: {
  waiting: {
    timeout: 5000,                  // or any accepted duration string
    onTimeout: { target: 'escalated' },
    on: { APPROVE: { target: 'approved' } }
  },
  approved: {},
  escalated: {}
}
```

`createAsyncLogic` accepts `timeout` with the same units, and aborts the run on expiry.

### Accepted duration formats

State `timeout` and `createAsyncLogic({ timeout })` accept `number` (ms) or `string` in one of these forms:

| Form              | Example                                                        | Notes                           |
| ----------------- | -------------------------------------------------------------- | ------------------------------- |
| Milliseconds      | `'250ms'`                                                      | integer + `ms` suffix           |
| Seconds           | `'5s'`, `'1.5s'`                                               | integer or decimal + `s` suffix |
| ISO 8601 duration | `'PT5S'`, `'PT1M30S'`, `'PT2H'`, `'P1D'`, `'P1W'`, `'P1DT12H'` | always starts with `P`          |

Plain `'5m'`, `'1h'`, `'1d'`, `'1w'` (without the `P`/`PT` prefix) are **not** accepted - use the ISO 8601 form for anything beyond seconds and milliseconds.

---

## 15. Always (eventless transitions): function form

`always` accepts the same inline-function shape as event transitions:

```ts
// v5
always: [
  { target: 'morning', guard: ({ context }) => context.hour < 12 },
  { target: 'afternoon', guard: ({ context }) => context.hour < 18 },
  { target: 'evening' }
];
```

```ts
// v6
always: ({ context }) => {
  if (context.hour < 12) return { target: 'morning' };
  if (context.hour < 18) return { target: 'afternoon' };
  return { target: 'evening' };
};
```

Array form still works.

---

## 16. Removed top-level exports

<!-- exports removed from and added to packages/core/src/index.ts on the v6 branch (relative to main / v5) -->

These exports have been **removed** from `xstate`:

- Action creators (entire `actions.ts` module): `assign`, `raise`, `sendTo`, `sendParent`, `forwardTo`, `emit`, `log`, `cancel`, `enqueueActions`, `spawnChild`, `stopChild`, `stop`, plus their `*Action`/`*Params` types
- Guard combinators and helpers: `and`, `or`, `not`, `stateIn`
- Guard types: `GuardPredicate`, `GuardArgs`
- Service helpers: `interpret`, `Interpreter`, and the `InterpreterFrom` type
- `SetupReturn` (no longer re-exported)
- Promise actor logic surface: `fromPromise`, `PromiseActorLogic`, `PromiseActorRef`, `PromiseSnapshot`
- Transition actor logic surface: `fromTransition`, `TransitionActorLogic`, `TransitionActorRef`, `TransitionSnapshot`
- Inspection-event subtypes: `InspectedActionEvent`, `InspectedActorEvent`, `InspectedEventEvent`, `InspectedMicrostepEvent`, `InspectedSnapshotEvent` are gone. The remaining `InspectionEvent` type was reshaped: its `type` is now only `'@xstate.actor' | '@xstate.transition'` (a discriminated union of `ActorInspectionEvent` and `TransitionInspectionEvent`, both also exported).
- The `devTools` actor option and the `xstate/dev`, `xstate/actions`, and `xstate/guards` subpath exports
- v5 definition/config types: `AnyState`, `StateMachineDefinition`, `StateNodeDefinition`, `StatesConfig`, `MachineOptions`, `ExecutableActionsFrom`, and related internals. The config types `MachineConfig`, `StateNodeConfig`, `InvokeConfig`, and `TransitionConfigOrTarget` are re-exported with their **v6 shapes** - same names, different structure.
- `transition()` / `initialTransition()` now return `ExecutableActionObject[]` for effects; hand-written actor logic `transition` and `initialTransition` return `[snapshot, effects]` tuples.

`SpecialTargets` (the `Parent`/`Internal` enum) is still exported from `'xstate'` via `types.ts` and continues to work.

These exports have been **added**:

- `setup` (reshaped - see §4) and `createSystem(...).setup(...)` for typed system registries
- `createStateConfig`
- `checkStateIn`
- `createLogic`, `createAsyncLogic`, `createCallbackLogic`, `createObservableLogic`, `createListenerLogic`, `createSubscriptionLogic`
- `TimeoutError`
- Serialization surface (see §21): `createMachineFromConfig`, `machineConfigToJSON`, and the `MachineJSON`/`StateNodeJSON`/`TransitionJSON`/`ActionJSON`/`GuardJSON`/`InvokeJSON`/`UnserializableMarker` types; machines serialize via `serializeMachine(machine)`
- Config types (v6 shapes): `MachineConfig`, `StateNodeConfig`, `InvokeConfig`, `TransitionConfigOrTarget`, `Implementations`, `InferEvents`, `WidenLiterals`
- `isBuiltInExecutableAction`
- Executable effect types: `BaseExecutableActionObject`, `CustomExecutableActionObject`, `ExecutableActionObject`, `ExecutableActionObjectFromLogic`, `BuiltInExecutableActionObject`, `SpecialExecutableAction`, `StartExecutableActionObject`, `RaiseExecutableActionObject`, `SendToExecutableActionObject`, `CancelExecutableActionObject`, `StopExecutableActionObject`
- `actor.select(selector)` - derived, subscribable views

---

## 17. Removed packages

### `@xstate/immer` - removed

The `immer` action creator no longer exists. Update context immutably from your inline function:

```ts
// v5
import { immerAssign } from '@xstate/immer';
on: {
  ADD: {
    actions: immerAssign((ctx, ev) => {
      ctx.todos.push(ev.todo);
    });
  }
}
```

```ts
// v6
on: {
  ADD: ({ context, event }) => ({
    context: { todos: [...context.todos, event.todo] }
  });
}
```

If you want Immer-style drafts, call Immer's `produce` yourself inside the inline function.

### `@xstate/inspect` - removed

The standalone inspector package and its `inspect()` entry point are gone. Inspection now flows through:

- `actor.subscribe(observer)` - the snapshot stream
- the `inspect` option on `createActor` - supplied at the system root and called for all transitions and microsteps in the actor tree

```ts
import { createActor } from 'xstate';
import type { InspectionEvent } from 'xstate';

createActor(machine, {
  inspect: (ev: InspectionEvent) => {
    // ev.type is '@xstate.actor' or '@xstate.transition' in v6
    // ev.actorRef is always set; ev.event, ev.snapshot, ev.sourceRef, ev.targetRef are on '@xstate.transition'
  }
}).start();
```

The granular v5 inspection-event subtypes (`@xstate.event`, `@xstate.snapshot`, `@xstate.action`, `@xstate.microstep`) are gone. v6 emits two kinds: `@xstate.actor` (actor topology: identity and parent) and `@xstate.transition` (every transition facet: event, snapshot, source, target, and the microsteps array). Microsteps are carried on the `@xstate.transition` event rather than emitted as a separate event.

---

## 18. Framework bindings

### React (`@xstate/react`)

`useActor` no longer rehydrates from a stopped root via the removed `stopRootWithRehydration` helper - it now creates a fresh actor when the previous one has stopped:

```ts
// API surface unchanged
const [snapshot, send, actor] = useActor(machine, options);
```

The hook signatures remained stable. Most application-level changes you make will be in the **machine** itself, not the hook.

### Vue / Svelte / Solid

Bindings updated to track the new `Snapshot` shape and `createActor` return type. No new hook signatures, but consuming components that referenced removed `xstate` exports (like `assign`) need to be migrated.

---

## 19. `assertEvent`

Still exported, still type-narrows. Schemas-typed events from `createMachine` work seamlessly:

```ts
on: {
  greet: ({ event }, enq) => {
    enq(() => {
      assertEvent(event, 'greet');
      console.log(event.message); // typed as string
    });
  };
}
```

---

## 20. Persistence / rehydration

Persisted snapshots round-trip through `JSON.stringify` and rehydrate via `createActor(machine, { snapshot })`. The internal shape changed, so v5 persisted snapshots are **not** binary-compatible with v6 - drain or migrate stored state during your rollout.

```ts
const snapshot = actor.getPersistedSnapshot();
const json = JSON.stringify(snapshot);

// later
const restored = JSON.parse(json);
const actor2 = createActor(machine, { snapshot: restored }).start();
```

Child actors, async logic with effects, and listener-resume semantics are all part of the rehydrated surface.

### Snapshot versioning

A machine may declare a `version`. When set, it is stamped onto every persisted
snapshot (and survives `JSON.stringify`), so a rollout can detect and migrate
older snapshots instead of feeding them to an incompatible machine:

```ts
const machine = createMachine({
  version: '1',
  initial: 'a',
  states: { a: {} }
});

const persisted = actor.getPersistedSnapshot();
(persisted as any).version; // '1'
```

Machines without a `version` produce snapshots with no `version` key.

### Durable timers

Pending `after` / delayed-raise timers are persisted on the snapshot (under
`_pendingEffects`) with the remaining-delay info needed to resume them. A
rehydrated actor re-arms its timers rather than losing them.

---

## 21. Machine-as-data: serialization, JSON configs, SCXML

v6 treats the machine definition as **data** with an explicit boundary around
runtime implementations:

### Machine → JSON

`serializeMachine(machine)` - a dedicated, tree-shakeable function - returns
the JSON-serializable definition. Values that cannot be
represented as data - inline functions, actor logic objects, runtime schemas -
appear as `{ "$unserializable": "function" | "actor" | "schema" | "value" }`
markers instead of being silently dropped. A definition is fully portable iff
it contains no markers; named `actions`/`guards`/`actorSources` keys are preserved
(as the contract a revived machine must fulfill via `provide()`).

```ts
const json = JSON.stringify(serializeMachine(machine)); // never throws
```

The format is described by a JSON Schema shipped with the package.

### JSON → machine

`createMachineFromConfig(config)` - **exported from `'xstate'`** - builds a
machine from a plain JSON config using serialized action objects
(`{ type: '@xstate.raise', event: ... }`, `{ type: '@xstate.assign', ... }`,
`{ type: '@xstate.emit', ... }`, custom `{ type, params }` actions) and
`{ type, params }` guard references. Machines built this way round-trip
losslessly: `createMachineFromConfig(JSON.parse(JSON.stringify(serializeMachine(machine))))`.

```ts
import { createMachineFromConfig, type MachineJSON } from 'xstate';

const def: MachineJSON = {
  initial: 'idle',
  states: {
    idle: { on: { START: { target: 'running' } } },
    running: { entry: [{ type: '@xstate.raise', event: { type: 'go' } }] }
  }
};
const machine = createMachineFromConfig(def);
```

Note: serialized-action vocabulary does not yet cover every v6 feature -
state `input`, `enq.listen`/`subscribeTo`, and `choice` functions have
no JSON representation.

### SCXML

- `toMachineJSON(scxml)` - parse SCXML XML to a plain JSON machine config
- `toMachine(scxml)` - parse SCXML XML directly to a `StateMachine`

These remain **repo-internal** and are not exported from `xstate` (they pull in
an XML parser).

---

## 22. `actor.select`

**New in v6.** `actor.select(selector, equalityFn?)` returns a subscribable,
memoized `Readable<T>` (`{ get, subscribe }`) that only notifies when the
selected value changes (default comparison `Object.is`).

Use `actor.getSnapshot()` to read the full current snapshot directly.

```ts
const count = actor.select((snapshot) => snapshot.context.count);

count.get(); // current selection
const sub = count.subscribe((c) => console.log(c)); // only fires on change
```

A `noop` event that doesn't change the selected value produces no notification.

---

## 23. Route states

**New in v6.** A state node with an explicit `id` may declare a `route`,
marking it as directly navigable. Sending `{ type: 'xstate.route', to: '#id' }`
transitions straight to that state - without an event-to-target transition
wired up at the source.

```ts
const machine = createMachine({
  id: 'flow',
  initial: 'a',
  states: {
    a: {},
    b: { id: 'b', route: {} }, // always navigable
    c: { id: 'c', route: () => false }, // currently blocked
    d: { id: 'd', route: ({ context }) => context.ready } // conditional
  }
});

const actor = createActor(machine).start();
actor.send({ type: 'xstate.route', to: '#b' }); // -> 'b'
```

The `route` value is either a **config object** or a **transition-style
function** acting as guard _and_ resolver: returning `undefined`/`false` blocks
the route; returning `true` or a config object (optionally with `context`,
`input`, `reenter`, `meta`) allows it. A state without `route` cannot be routed
to.

---

## 24. Actor registry

**New in v6 (public).** Actors can be looked up by `registryKey` from
the shared system, so distant actors can find each other without threading refs
through the tree:

```ts
const system = createSystem({
  registry: {
    receiver: childLogic
  }
});

const machine = system.setup().createMachine({
  invoke: { src: childLogic, registryKey: 'receiver' }
});

const actor = system.createActor(machine, { registryKey: 'root' }).start();

actor.system.get('receiver'); // the invoked child's ActorRef (or undefined)
actor.system.get('root'); // the root actor itself
actor.system.getAll(); // Partial map of all registered actors
```

`registryKey` is assigned via `invoke.src`'s `registryKey`, `spawn`'s
`registryKey` option, or `system.createActor(machine, { registryKey })` for the
root. Entries are removed when their actor stops. With
`createSystem({ registry })`, `registryKey` is checked against the registry and
registered actor logic. Transition functions receive the same typed `system`,
so `system.get('receiver')` is available without casts.

---

## Migration checklist

- [ ] Replace every `assign({...})` with an inline function returning a shallow `{ context: {...} }` patch
- [ ] Replace every `raise`, `sendTo`, `sendParent`, `forwardTo`, `emit`, `log`, `cancel`, `spawnChild`, `stopChild` with the corresponding `enq.*` call
- [ ] Replace `enqueueActions(...)` with a regular inline `(args, enq) => { ... }` function
- [ ] Replace `and`/`or`/`not` guard combinators with plain JS inside the guard or inline transition function
- [ ] Replace `stateIn(...)` with `checkStateIn(self.getSnapshot(), ...)`
- [ ] Replace `interpret(machine)` with `createActor(machine)`; remove `Interpreter` type imports
- [ ] Replace `fromPromise(...)` with `createAsyncLogic({ run: ... })`
- [ ] Replace `types: {} as { ... }` with `schemas: { ... }` (Zod / Standard Schema)
- [ ] If you used `events` as a **union**, restructure to a **map keyed by type**
- [ ] Move `actions`/`guards`/`actorSources`/`delays` off of `setup({ ... })` and onto `createMachine({ ... })` (or `machine.provide({ ... })`)
- [ ] Audit `invoke.src` references - `src` may be a logic object, a registered name, or a resolver function
- [ ] Drop dependencies on `@xstate/immer` and `@xstate/inspect`; update inspection to `actor.subscribe`, the `inspect` option, or `@statelyai/inspect`
- [ ] Remove imports of `SetupReturn`, `GuardArgs`, `GuardPredicate`, `Inspected*Event`, `PromiseActorLogic`, and `fromPromise` (use `createAsyncLogic`)
- [ ] Drain/migrate any v5 persisted snapshots - the v6 snapshot shape is not binary-compatible
- [ ] Run `pnpm typecheck` and `pnpm test` to surface remaining issues

---

## Worked example: a small machine

```ts
// v5
import { createMachine, createActor, assign, raise } from 'xstate';

const machine = createMachine({
  types: {} as {
    context: { count: number };
    events: { type: 'INC' } | { type: 'RESET' } | { type: 'DONE' };
  },
  context: { count: 0 },
  initial: 'idle',
  states: {
    idle: {
      on: {
        INC: {
          actions: assign(({ context }) => ({ count: context.count + 1 })),
          target: 'idle'
        },
        RESET: {
          actions: [assign({ count: 0 }), raise({ type: 'DONE' })]
        },
        DONE: 'finished'
      }
    },
    finished: { type: 'final' }
  }
});
```

```ts
// v6
import { z } from 'zod';
import { createMachine, createActor } from 'xstate';

const machine = createMachine({
  schemas: {
    context: z.object({ count: z.number() }),
    events: {
      INC: z.object({}),
      RESET: z.object({}),
      DONE: z.object({})
    }
  },
  context: { count: 0 },
  initial: 'idle',
  states: {
    idle: {
      on: {
        INC: ({ context }) => ({
          context: { count: context.count + 1 }
        }),
        RESET: ({ context }, enq) => {
          enq.raise({ type: 'DONE' });
          return { context: { count: 0 } };
        },
        DONE: 'finished'
      }
    },
    finished: { type: 'final' }
  }
});

const actor = createActor(machine).start();
actor.trigger.INC();
actor.trigger.RESET();
```
