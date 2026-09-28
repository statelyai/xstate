import { Effect } from 'effect';
import { TestClock } from 'effect/testing';
import { createEffectActor, waitFor } from '@xstate/effect';
import { createMachine } from 'xstate';

const reviewMachine = createMachine({
  initial: 'pending',
  states: {
    pending: {
      after: { 30000: { target: 'expired' } },
      on: { APPROVE: { target: 'approved' } }
    },
    approved: { type: 'final' },
    expired: { type: 'final' }
  }
});

const test = Effect.gen(function* () {
  const actor = yield* createEffectActor(reviewMachine);
  yield* TestClock.adjust('30 seconds');
  const snapshot = yield* waitFor(actor, (s) => s.matches('expired'));
  return snapshot.value;
});

export const result = await Effect.runPromise(
  test.pipe(Effect.scoped, Effect.provide(TestClock.layer()))
);
console.log(result); // 'expired', with no 30-second wait
