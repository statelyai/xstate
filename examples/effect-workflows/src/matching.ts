import { Effect, Match, Schema, Stream } from 'effect';
import {
  createEffectActor,
  send,
  setupEffect,
  snapshots,
  taggedState,
  type TaggedState
} from '@xstate/effect';

const reviewMachine = setupEffect({
  states: {
    approved: {
      schemas: { context: Schema.Struct({ reviewer: Schema.String }) }
    }
  }
}).createMachine({
  initial: 'pending',
  states: {
    pending: {
      on: { APPROVE: { target: 'approved', context: { reviewer: 'Ada' } } }
    },
    approved: { type: 'final' }
  }
});

const describe = Match.type<TaggedState<typeof reviewMachine>>().pipe(
  Match.tag('pending', () => 'Waiting for review'),
  Match.tag('approved', ({ context }) => `Approved by ${context.reviewer}`),
  Match.exhaustive
);

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(reviewMachine);
  return [
    ...(yield* snapshots(actor).pipe(
      Stream.tap((s) =>
        s.matches('pending') ? send(actor, { type: 'APPROVE' }) : Effect.void
      ),
      Stream.map(taggedState),
      Stream.map(describe),
      Stream.runCollect
    ))
  ];
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // ['Waiting for review', 'Approved by Ada']
