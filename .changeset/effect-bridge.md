---
'@xstate/effect': minor
---

Add experimental Effect 4 integration for XState v6.

- `createEffectActor(logic)` creates and starts an actor as a scoped Effect resource. The actor stops, and its running Effects are interrupted, when the enclosing `Scope` closes. XState timers use the Effect `Clock`, so `TestClock` drives delayed transitions.
- `fromEffect`, `fromEffectStream` and `fromEffectEventStream` turn Effects and Streams into actor logic with typed failures and service requirements. Interruption from inside the Effect reports an `EffectInterruptedError`.
- `setupEffect` accepts Effect schemas and Effect-returning actions; `runEffect` runs an Effect from an inline action.
- `send`, `snapshots`, `emitted`, `waitFor`, `toEffect` and `inspect` expose an actor as Effects and Streams.

```ts
import { Effect, Schema } from 'effect';
import { createEffectActor, fromEffect, toEffect } from '@xstate/effect';

const loadUser = fromEffect({
  schemas: {
    input: Schema.Struct({ id: Schema.String }),
    output: Schema.Struct({ id: Schema.String })
  },
  effect: ({ input }) => Effect.succeed({ id: input.id })
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(loadUser, { input: { id: '42' } });
  return yield* toEffect(actor);
});

await Effect.runPromise(Effect.scoped(program));
```
