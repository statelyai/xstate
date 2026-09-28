import { Effect, Stream } from 'effect';
import {
  createEffectActor,
  fromEffectEventStream,
  join,
  setupEffect
} from '@xstate/effect';

// A deployment feed drives the workflow, rather than just displaying data.
const deploymentEvents = fromEffectEventStream(
  Stream.make({ type: 'HEALTHY' }, { type: 'UNHEALTHY' })
);

const rolloutMachine = setupEffect({
  actors: { deploymentEvents }
}).createMachine({
  output: () => 'rollback requested',
  initial: 'monitoring',
  states: {
    monitoring: {
      invoke: { src: 'deploymentEvents' },
      initial: 'checking',
      states: {
        checking: { on: { HEALTHY: { target: 'healthy' } } },
        healthy: {}
      },
      on: { UNHEALTHY: { target: 'rollingBack' } }
    },
    rollingBack: { type: 'final' }
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(rolloutMachine);
  return yield* join(actor);
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 'rollback requested'
