---
title: Setup and provide
description: Declare typed sources with setup(...) and swap implementations with provide(...).
---

`setup(...)` declares the schemas and named sources a machine is built from, and returns a factory for fully typed machines and state configs.

```ts
const orderSetup = setup({
  schemas: {
    context: z.object({ total: z.number() }),
    events: { submit: z.object({}) }
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
