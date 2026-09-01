# @xstate/effect

Effect integration for XState v6.

This package is experimental and targets XState v6 alpha and Effect 4 RC.

## Installation

<!-- package name and peer dependencies from package.json -->

```bash
npm install @xstate/effect@alpha xstate@alpha effect@rc
```

## Quick start

<!-- public API and actor-hosting contract from src/index.ts -->

`createEffectActor` hosts an ordinary XState machine in an Effect context. Use
`fromEffect` for Effect-based invoked actors; the machine remains a normal v6
machine and can use existing XState transitions.

```ts
import { Context, Effect, Schema } from 'effect';
import { createEffectActor, fromEffect } from '@xstate/effect';
import { setup } from 'xstate';
import { standardSchemaValidator } from 'xstate/validation';

interface ApiService {
  fetchUser: (id: string) => Effect.Effect<{ id: string }, Error>;
}

const Api = Context.Service<ApiService>('Api');

const logic = fromEffect({
  validator: standardSchemaValidator(),
  schemas: {
    input: Schema.Struct({ id: Schema.String }),
    output: Schema.Struct({ id: Schema.String })
  },
  effect: ({ input }) =>
    Effect.gen(function* () {
      return yield* Api.use((api) => api.fetchUser(input.id));
    })
});

const machine = setup({ actors: { fetchUser: logic } }).createMachine({
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: 'fetchUser',
        input: { id: '42' },
        onDone: 'success',
        onError: 'failure'
      }
    },
    success: {},
    failure: {}
  }
});

const actor = await Effect.runPromise(
  Effect.provideService(
    createEffectActor(machine),
    Api,
    { fetchUser: (id) => Effect.succeed({ id }) }
  )
);
```

`fromEffectStream` exposes the latest stream item as actor context and reaches
`done` when the stream completes. `fromEffectEventStream` relays each emitted
event to the parent machine. Effect failures become XState actor errors, while
interruption is treated as cancellation.

Effect-backed logic must be started with `createEffectActor`; using ordinary
`createActor` does not install an Effect runtime and fails during startup.

## Effect schemas

`setupEffect` accepts Effect schemas in its `schemas` and `states` options. The
same applies to `setupEffect(...).extend(...)`. XState infers the decoded
`Schema.Type`, so there is no need to call `Schema.toStandardSchemaV1`.

```ts
import { Effect, Schema } from 'effect';
import { createEffectActor, setupEffect } from '@xstate/effect';
import { standardSchemaValidator } from 'xstate/validation';

const machine = setupEffect({
  validator: standardSchemaValidator(),
  schemas: {
    context: Schema.Struct({ count: Schema.Number }),
    events: {
      ADD: Schema.Struct({ value: Schema.Number })
    }
  }
}).createMachine({
  context: { count: 0 },
  on: {
    ADD: ({ context, event }) => ({
      context: { count: context.count + event.value }
    })
  }
});

const actor = await Effect.runPromise(createEffectActor(machine));
actor.send({ type: 'ADD', value: 2 });
```

Standard Schemas remain supported and can be mixed with Effect schemas. Schema
validation follows normal XState rules. Schemas provide types without a
`validator`; adding `standardSchemaValidator()` enables runtime assertions.

XState validation checks a value but does not replace it with a transformed
value. When runtime validation is enabled, TypeScript rejects schemas whose
encoded and decoded types differ. Effect schemas used at this validation seam
must decode synchronously and without Effect service requirements.

Actor Effects can read services from the Effect context captured by
`createEffectActor`, as in the `Effect.provideService` example above. The actor
does not own the lifetime of a caller-provided Layer or `ManagedRuntime`. For a
Layer with scoped resources, keep a caller-owned `ManagedRuntime` alive until
the actor is stopped, then dispose it:

```ts
import { ManagedRuntime } from 'effect';

const runtime = ManagedRuntime.make(AppLayer);
const actor = await runtime.runPromise(createEffectActor(machine));

// use the actor
actor.stop();
await runtime.dispose();
```

Providing a scoped Layer only around `createEffectActor(machine)` is not
sufficient: actor creation returns immediately, so that Layer's scope would
close while the actor is still active.

`fromEffect` also accepts Effect schemas for actor input and output. Either
schema may be omitted, and the missing type is inferred from the Effect:

```ts
const loadUser = fromEffect({
  schemas: {
    input: Schema.Struct({ id: Schema.String }),
    output: Schema.Struct({ id: Schema.String })
  },
  effect: ({ input }) =>
    Api.use((api) => api.fetchUser(input.id))
});
```

The existing shorthand forms continue to work:

```ts
fromEffect(Effect.succeed('done'));
fromEffect(({ input }: { input: string }) => Effect.succeed(input.length));
```

## Effect actions

<!-- effect action contract from src/setupEffect.ts -->

`setupEffect({ actions })` makes registered actions return Effects. They run in
the host context and are tracked with the actor lifecycle. The v6 enqueue
contract is preserved, so action parameters are passed explicitly:

```ts
const machine = setupEffect({
  actions: {
    audit: ({ context }) =>
      Effect.sync(() => console.log('count', context.count))
  }
}).createMachine({
  context: { count: 1 },
  initial: 'active',
  states: {
    active: {
      on: {
        AUDIT: (args, enq) => enq(args.actions.audit, args)
      }
    }
  }
});
```

For an action that needs XState enqueue methods, pass the enqueue object as a
second action parameter and keep enqueue operations outside the Effect:

```ts
const machine = setupEffect({
  actions: {
    audit: ({ context }, enq) => {
      enq?.raise({ type: 'AUDIT_COMPLETE', count: context.count });
      return Effect.sync(() => console.log('count', context.count));
    }
  }
}).createMachine({
  context: { count: 1 },
  initial: 'active',
  states: {
    active: {
      on: {
        AUDIT: (args, enq) => enq(args.actions.audit, args, enq)
      }
    }
  }
});
```

The enqueue calls are planned synchronously by the action function; the
returned Effect is the asynchronous boundary.
