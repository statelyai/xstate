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
import { Context, Effect } from 'effect';
import { createEffectActor, fromEffect } from '@xstate/effect';
import { setup } from 'xstate';

interface ApiService {
  fetchUser: (id: string) => Effect.Effect<{ id: string }, Error>;
}

const Api = Context.Service<ApiService>('Api');

const logic = fromEffect(
  ({ input }: { input: { id: string } }) =>
    Effect.gen(function* () {
      return yield* Api.use((api) => api.fetchUser(input.id));
    })
);

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
