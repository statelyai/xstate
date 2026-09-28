import { Effect, Stream, pipe } from 'effect';
import {
  createEffectActor,
  join,
  send,
  snapshots,
  waitFor
} from '@xstate/effect';
import { createMachine } from 'xstate';

const reviewMachine = createMachine({
  output: () => ({ approved: true }),
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: { target: 'approved' } } },
    approved: { type: 'final' }
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(reviewMachine);
  const history = yield* snapshots(actor).pipe(
    // Send after the subscription sees the initial state.
    Stream.tap((s) =>
      s.matches('pending')
        ? pipe(actor, send({ type: 'APPROVE' }))
        : Effect.void
    ),
    Stream.map((s) => s.value),
    Stream.runCollect
  );
  yield* waitFor(actor, (s) => s.matches('approved'), { timeout: '5 seconds' });
  return { history: [...history], output: yield* join(actor) };
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result);
// { history: ['pending', 'approved'], output: { approved: true } }
