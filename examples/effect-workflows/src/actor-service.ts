import { Context, Effect, Layer, ManagedRuntime } from 'effect';
import {
  createEffectActor,
  send,
  waitFor,
  type EffectActor
} from '@xstate/effect';
import { createMachine } from 'xstate';

const reviewMachine = createMachine({
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: { target: 'approved' } } },
    approved: {}
  }
});

class ReviewActor extends Context.Service<
  ReviewActor,
  EffectActor<typeof reviewMachine>
>()('@app/ReviewActor') {}

const ReviewActorLayer = Layer.effect(
  ReviewActor,
  createEffectActor(reviewMachine)
);
const runtime = ManagedRuntime.make(ReviewActorLayer);

try {
  const snapshot = await runtime.runPromise(
    Effect.gen(function* () {
      const actor = yield* ReviewActor;
      yield* send(actor, { type: 'APPROVE' });
      return yield* waitFor(actor, (s) => s.matches('approved'));
    })
  );
  console.log(snapshot.value); // 'approved'
} finally {
  await runtime.dispose();
}
