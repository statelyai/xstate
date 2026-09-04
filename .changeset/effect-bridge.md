---
'@xstate/effect': minor
---

Add experimental Effect 4 integration for XState v6.

- `createEffectActor(logic)` creates and starts an actor as a scoped Effect resource. The actor stops, and its running Effects are interrupted, when the enclosing `Scope` closes. XState timers use the Effect `Clock`, so `TestClock` drives delayed transitions.
- `fromEffect`, `fromEffectStream` and `fromEffectEventStream` turn Effects and Streams into actor logic with typed failures and service requirements. Interruption from inside the Effect reports an `EffectInterruptedError`.
- `setupEffect` accepts Effect schemas and Effect-returning actions.
- `send`, `snapshots`, `emitted`, `waitFor`, `join`, `inspect` and `deadLetters` expose an actor as Effects and Streams. `send` and `waitFor` are dual, so they take the actor first or can be piped. `waitFor` narrows its result when given a type predicate, and accepts a `timeout` that fails with `Cause.TimeoutError`. `join` waits for an actor's final output. `deadLetters` streams the events the actor's system could not deliver.

```ts
import { Effect, Schema } from 'effect';
import { createEffectActor, fromEffect, join } from '@xstate/effect';

const loadUser = fromEffect({
  schemas: {
    input: Schema.Struct({ id: Schema.String }),
    output: Schema.Struct({ id: Schema.String })
  },
  effect: ({ input }) => Effect.succeed({ id: input.id })
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(loadUser, { input: { id: '42' } });
  return yield* join(actor);
});

await Effect.runPromise(Effect.scoped(program));
```
