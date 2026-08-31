---
title: Setup and provide
description: Declare typed sources with setup(...) and swap implementations with provide(...).
---

`setup(...)` declares the schemas and named sources a machine is built from, and returns a factory for fully typed machines and state configs.

```ts
const orderSetup = setup({
  schemas: {
    context: z.object({ total: z.number() }),
    events: { submit: z.object({}) },
    internalEvents: { recalculate: z.object({}) }
  },
  actions: {
    logTotal: (params: { total: number }) => console.log(params.total)
  },
  guards: { hasStock: ({ context }) => context.total > 0 },
  actors: { chargeCard },
  delays: { retryDelay: 1_000 }
});

const orderMachine = orderSetup.createMachine({
  context: { total: 0 },
  initial: 'idle',
  states: { idle: {}, charging: {} }
});
```

`setup(...)` also accepts `states`, where each state declares its own schemas. That is what types the `initial: { target, input }` form and transitions carrying [state input](state-input.md).

State contracts can also declare structural metadata: `type`, `initial`,
`history`, `target`, and `id` (plus `route: true` for a routable state).
`createMachine(...)` may omit those defaults, and the resulting state value and
state-node metadata retain their types. Declaring a state `type` also checks
its compatible machine shape: compound states need an `initial`, parallel
states do not accept one, history states need a non-empty `target`, and final
or choice states cannot define child-state behavior. Setups that only declare
`schemas` remain permissive for compatibility with existing machine configs.
When a structural contract declares child states, `createMachine(...)` still
provides those child configs; setup supplies their contracts and defaults, not
their runtime behavior.

When setup is extended, repeated state names merge recursively. Extension
fields and schemas win conflicts, while descendants declared only by the base
or extension are preserved.

Input requirements follow entry semantics. A transition that targets a
composite state supplies that state's input, while the composite state's
`initial` supplies input for its newly entered child. A parallel state follows
the same rule independently for each region, so every region with an
input-bearing initial child needs an object-form `initial` transition. The
path overload of `createStateConfig(...)` resolves relative targets such as
`.child` and `.foo.grandchild` against the setup tree and types their input.

History defaults do not have an input field. Therefore a setup history state
cannot default directly to a state with required input; target a composite or
parallel state whose normal initial transitions construct the required child
inputs instead.

State schemas can also declare `schemas.output` for the value emitted when that
state completes. Final-state `output` functions and the parent state's `onDone`
event use that local type. For a parallel state, declare the aggregate object on
the parallel state itself:

```ts
const uploadSetup = setup({
  states: {
    processing: {
      schemas: {
        output: types<{
          upload: { url: string };
          scan: { safe: boolean };
        }>()
      }
    }
  }
});
```

These local output schemas currently provide TypeScript contracts. Runtime
validation still checks the machine's stable terminal output at the existing
result boundary; it does not validate transient nested completion values.

Use `setup(...).extend(...)` to build a more specific setup from a shared one, merging schemas and sources.

## Runtime validation

<!-- runtime validation behavior from packages/core/src/setup.ts and packages/core/src/validation/index.ts -->

Schemas provide type inference by default. Install `standardSchemaValidator()` to check actor inputs, events, snapshots and outputs at runtime:

```ts
import { setup } from 'xstate';
import { standardSchemaValidator } from 'xstate/validation';
import { z } from 'zod';

const base = setup({
  schemas: { input: z.object({ orderId: z.string() }) }
});

const validated = base.extend({
  validator: standardSchemaValidator()
});
```

Validation can be installed, replaced or disabled by a derived setup. Installing it checks inherited and new schemas for compatibility. Runtime validation is assertion-only, so schemas that transform one type into another are rejected; disable validation with `validator: undefined` when transformations are required.

### Validation failures

Where a validation failure surfaces depends on which side of the delivery boundary produced the invalid value:

- **Events arriving from outside the actor** — from `actor.send` or from another actor — are rejected at the boundary when their payload fails its schema, or when the event type is undeclared and `unknownEvents` is `'error'`. The event is never delivered: the actor does not transition, does not error, and no API throws. The rejection is reported to the `onRejectedEvent` dead-letter hook on `createActor` options, to [inspection](inspection.md) observers as a `@xstate.deadletter` event, and as a development-mode console warning. In pure `transition(...)` calls, the snapshot is returned unchanged together with a `@xstate.deadLetter` effect carrying the rejection.
- **Values the actor produces itself** — input, context, output, emitted events and delayed raised events — error the actor when they fail their schema, and pure `transition(...)`/`initialTransition(...)` throw an `ActorValidationError`. These are machine bugs.

## Sources on the machine

`actions`, `guards`, `actors` and `delays` can be declared directly on `createMachine(...)` instead of on `setup(...)`. Use `setup(...)` when several machines share the same sources or when state schemas are needed.

```ts
const machine = createMachine({
  actions: { notify: (params: { msg: string }) => toast(params.msg) },
  guards: { isReady: ({ context }) => context.ready },
  actors: { chargeCard },
  delays: { retryDelay: 1_000 },
  initial: 'idle',
  states: { idle: {} }
});
```

## Using named sources

Named sources arrive as typed maps on the arguments of every transition function and entry/exit action.

```ts
idle: {
  on: {
    submit: (args, enq) => {
      const { actions } = args;
      if (!args.guards.isReady(args)) return;
      actions.notify({ msg: 'Charging' });
      enq(actions.notify, { msg: 'Queued' });
      return { target: 'charging' };
    }
  }
}
```

Named actions are called with their params. Named guards receive the transition arguments object first, then any params. Declare param types on the function itself, or with `schemas.actions` and `schemas.guards` so the params are checked before the implementations exist:

```ts
setup({
  schemas: {
    actions: { track: { params: z.object({ key: z.string() }) } },
    guards: { hasAccess: { params: z.object({ role: z.string() }) } }
  }
});
```

Named `actors` are referenced by `invoke.src`, and named `delays` by `after` keys and state [`timeout`](timeouts.md).

## Modular state configs

`createStateConfig(...)` builds a single state's config separately from the machine, keeping the same types. Pass a dotted path as the first argument to type a nested state.

```ts
const idle = orderSetup.createStateConfig({
  on: { submit: { target: 'charging' } }
});

const orderMachine = orderSetup.createMachine({
  context: { total: 0 },
  initial: 'idle',
  states: { idle, charging: {} }
});
```

This is useful when a large machine is split across files, or when a checkout flow's payment states are maintained separately from its shipping states.

## Providing implementations

`machine.provide(...)` returns a new machine with different `actions`, `guards`, `actors` or `delays`. The machine's structure and types stay the same.

```ts
const testMachine = orderMachine.provide({
  actors: { chargeCard: fakeChargeCard },
  delays: { retryDelay: 0 }
});
```

Use `provide(...)` for the same machine under different conditions: real payment actors in production and fakes in tests, or real timers in the app and instant ones in a test suite.

> **Warning:** `provide(...)` replaces implementations only. It cannot add states, transitions or new source names.

For typed system-wide actor registries, `createSystem(...).setup(...)` returns a setup whose machines share the registry types. See [actor systems](systems.md).

## TypeScript

Sources declared on `setup(...)` or on the machine config are inferred into `{ actions, guards, actors, delays }` on function arguments, and `provide(...)` requires the same signatures. The `{ type, params }` object form for named actions belongs to serialized JSON configs read by `createMachineFromConfig(...)`; in TypeScript, call the named source directly.

## Setup cheatsheet

```ts
const s = setup({
  schemas: { context: z.object({ n: z.number() }) },
  actions: { log: (params: { msg: string }) => console.log(params.msg) },
  guards: { isPositive: ({ context }) => context.n > 0 },
  actors: { fetchUser },
  delays: { retry: 1_000 },
  states: { loading: { schemas: { input: z.object({ id: z.string() }) } } }
});

const state = s.createStateConfig({ on: { go: { target: 'loading' } } });
const machine = s.createMachine({ context: { n: 0 }, initial: 'idle' });
const provided = machine.provide({ actors: { fetchUser: fakeFetchUser } });
```
