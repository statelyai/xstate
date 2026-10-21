import { Effect, Match } from 'effect';
import {
  createEffectActor,
  taggedState,
  type TaggedState
} from '@xstate/effect';
import { createMachine } from 'xstate';

const releaseMachine = createMachine({
  id: 'release',
  type: 'parallel',
  states: {
    review: { initial: 'pending', states: { pending: {}, approved: {} } },
    build: { initial: 'running', states: { running: {}, passed: {} } }
  }
});

const describe = Match.type<TaggedState<typeof releaseMachine>>().pipe(
  Match.tag('release', ({ snapshot }) =>
    snapshot.matches({ build: 'running' })
      ? 'Build in progress'
      : 'Build finished'
  ),
  Match.exhaustive
);

export const result = await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(releaseMachine);
      return describe(taggedState(actor.getSnapshot()));
    })
  )
);
console.log(result); // 'Build in progress'
