import { Context, Effect, Schema } from 'effect';
import {
  createEffectActor,
  fromEffect,
  send,
  setupEffect,
  waitFor
} from '@xstate/effect';

export class Deployments extends Context.Service<
  Deployments,
  { readonly deploy: (release: string) => Effect.Effect<string, Error> }
>()('@app/Deployments') {}

const deploy = fromEffect({
  schemas: { input: Schema.Struct({ release: Schema.String }) },
  effect: ({ input }) => Deployments.use((api) => api.deploy(input.release))
});

export const approvalMachine = setupEffect({
  schemas: { input: Schema.Struct({ release: Schema.String }) },
  actors: { deploy }
}).createMachine({
  context: ({ input }) => ({ release: input.release, url: '' }),
  initial: 'awaitingApproval',
  states: {
    awaitingApproval: {
      after: { 30000: { target: 'expired' } },
      on: {
        APPROVE: { target: 'deploying' },
        CANCEL: { target: 'cancelled' }
      }
    },
    deploying: {
      invoke: {
        src: 'deploy',
        input: ({ context }) => ({ release: context.release }),
        onDone: ({ context, event }) => ({
          target: 'deployed',
          context: { ...context, url: event.output }
        }),
        onError: { target: 'failed' }
      },
      on: { CANCEL: { target: 'cancelled' } }
    },
    failed: {
      on: {
        RETRY: { target: 'deploying' },
        CANCEL: { target: 'cancelled' }
      }
    },
    deployed: { type: 'final' },
    expired: { type: 'final' },
    cancelled: { type: 'final' }
  }
});

export const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(approvalMachine, {
    input: { release: 'v1.2.0' }
  });
  // A UI, webhook or CLI can send this event after a person approves.
  yield* send(actor, { type: 'APPROVE' });
  const snapshot = yield* waitFor(actor, (s) => s.matches('deployed'), {
    timeout: '5 seconds'
  });
  return snapshot.context.url;
});

export const result = await Effect.runPromise(
  program.pipe(
    Effect.scoped,
    Effect.provideService(Deployments, {
      // Replace this demo service with your deployment API.
      deploy: (release) => Effect.succeed(`https://example.com/${release}`)
    })
  )
);
console.log(result); // 'https://example.com/v1.2.0'
