import { Effect, Schedule } from 'effect';
import { createEffectActor, fromEffect, join } from '@xstate/effect';

let attempts = 0;
const publish = fromEffect(
  Effect.suspend(() => {
    attempts++;
    return attempts < 3
      ? Effect.fail(new Error('Publisher temporarily unavailable'))
      : Effect.succeed('published');
  }).pipe(
    Effect.retry({ schedule: Schedule.exponential('10 millis'), times: 3 })
  )
);

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(publish);
  return yield* join(actor);
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 'published', on attempt 3
