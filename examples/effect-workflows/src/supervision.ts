import { Effect, Schedule } from 'effect';
import { createEffectActor, createEffectLogic, join } from '@xstate/effect';

let attempts = 0;
const worker = createEffectLogic(
  Effect.suspend(() => {
    attempts++;
    return attempts < 3
      ? Effect.fail(new Error('Worker disconnected'))
      : Effect.succeed('complete');
  })
);

const attempt = Effect.gen(function* () {
  const actor = yield* createEffectActor(worker);
  return yield* join(actor);
});

// Each failed attempt closes its scope before a new actor starts.
const supervised = Effect.scoped(attempt).pipe(
  Effect.retry({ schedule: Schedule.exponential('10 millis'), times: 3 })
);

export const result = await Effect.runPromise(supervised);
console.log(result); // 'complete', from the third actor
