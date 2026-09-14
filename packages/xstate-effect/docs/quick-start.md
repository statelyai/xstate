---
title: Quick start
description: Run an XState machine as an Effect.
---

Use `@xstate/effect` when a machine's side effects are Effects and you want the actor to live in an Effect program: services, scopes, clocks and tracing all come from Effect.

This package is experimental. It targets XState v6 alpha and Effect 4 RC.

```bash
npm install @xstate/effect@alpha xstate@alpha effect@rc
```

```ts
import { Context, Effect, Schema } from 'effect';
import { createEffectActor, fromEffect, waitFor } from '@xstate/effect';
import { setup } from 'xstate';

class Api extends Context.Service<
  Api,
  {
    readonly fetchUser: (id: string) => Effect.Effect<{ id: string }, Error>;
  }
>()('@app/Api') {}

const fetchUser = fromEffect({
  schemas: {
    input: Schema.Struct({ id: Schema.String }),
    output: Schema.Struct({ id: Schema.String })
  },
  effect: ({ input }) => Api.use((api) => api.fetchUser(input.id))
});

const machine = setup({ actors: { fetchUser } }).createMachine({
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: 'fetchUser',
        input: { id: '42' },
        onDone: { target: 'success' },
        onError: { target: 'failure' }
      }
    },
    success: {},
    failure: {}
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(machine);
  const snapshot = yield* waitFor(actor, (s) => s.matches('success'));
  return snapshot.value;
});

await Effect.runPromise(
  Effect.provideService(Effect.scoped(program), Api, {
    fetchUser: (id) => Effect.succeed({ id })
  })
);
```

## How it runs

XState's transition function is pure: `transition(snapshot, event)` returns the next snapshot and the actions to run, without running them. `createEffectActor` drives that function from an Effect fiber and interprets what it produces. The mailbox is an Effect `Queue`, so `actor.send` enqueues the event and the fiber processes events in order. Timers for `after` transitions and delayed sends are `Effect.sleep` fibers on the Effect `Clock`. Declared Effect actions run as forked Effects with the services captured when the actor was created. Built-in actions and child actors behave as XState defines them. Because the loop runs on a fiber, `send` returns before the event is processed, so read outcomes with [`waitFor`, `join` or `snapshots`](observing-actors.md) instead of calling `getSnapshot()` right after a send.

Effect-backed logic must run under `createEffectActor`. Starting it with `createActor` puts the actor in the `error` status, because no Effect runtime is available to host its Effects.

## Next steps

- [Actors](actors.md): lifetime, services and the Effect `Clock`.
- [Observing actors](observing-actors.md): reading snapshots, output and emitted events.
- [Effect actor logic](effect-logic.md): `fromEffect` and the stream variants.
- [Schemas and actions](schemas-and-actions.md): `setupEffect` with Effect schemas and Effect actions.
