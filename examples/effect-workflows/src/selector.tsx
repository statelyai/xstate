import { Context, Layer, ManagedRuntime } from 'effect';
import { createEffectActor, type EffectActor } from '@xstate/effect';
import { useSelector } from '@xstate/react';
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

export const runtime = ManagedRuntime.make(
  Layer.effect(ReviewActor, createEffectActor(reviewMachine))
);
export const actor = await runtime.runPromise(ReviewActor);

// Render <Review actor={actor} /> in your React application.
export function Review({
  actor
}: {
  actor: EffectActor<typeof reviewMachine>;
}) {
  const status = useSelector(actor, (s) => s.value);
  return (
    <button
      disabled={status !== 'pending'}
      onClick={() => actor.send({ type: 'APPROVE' })}
    >
      {status}
    </button>
  );
}

// Call await runtime.dispose() when the application shuts down.
