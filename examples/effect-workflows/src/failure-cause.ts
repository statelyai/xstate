import { Cause, Effect, Option } from 'effect';
import {
  createEffectActor,
  createEffectLogic,
  setupEffect,
  waitFor
} from '@xstate/effect';

const request = createEffectLogic(Effect.fail({ code: 'NOT_FOUND' as const }));
const machine = setupEffect({ actors: { request } }).createMachine({
  context: { code: '' },
  initial: 'pending',
  states: {
    pending: {
      invoke: {
        src: 'request',
        onError: ({ event }) => {
          const failure = Cause.findErrorOption(event.error.cause);
          return {
            target: 'failed',
            context: {
              code: Option.isSome(failure) ? failure.value.code : 'UNEXPECTED'
            }
          };
        }
      }
    },
    failed: {}
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(machine);
  return (yield* waitFor(actor, (snapshot) => snapshot.matches('failed')))
    .context.code;
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 'NOT_FOUND'
