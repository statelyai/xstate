import { Context, Effect, Latch, Schema } from 'effect';
import { createEffectActor, send, setupEffect, waitFor } from '@xstate/effect';
import { standardSchemaValidator } from 'xstate/validation';

class Audit extends Context.Service<
  Audit,
  { readonly record: (reviewer: string) => Effect.Effect<void> }
>()('@app/Audit') {}

const reviewMachine = setupEffect({
  schemas: { events: { APPROVE: Schema.Struct({ reviewer: Schema.String }) } },
  actions: {
    audit: ({ event }) => Audit.use((audit) => audit.record(event.reviewer))
  }
}).createMachine({
  validator: standardSchemaValidator(),
  initial: 'pending',
  states: {
    pending: {
      on: {
        APPROVE: (args, enq) => {
          enq(args.actions.audit, args);
          return { target: 'approved' };
        }
      }
    },
    // Keep the actor alive while its background audit runs.
    approved: {}
  }
});

const program = Effect.gen(function* () {
  const recorded = yield* Latch.make();
  const actor = yield* createEffectActor(reviewMachine).pipe(
    Effect.provideService(Audit, { record: () => Effect.asVoid(recorded.open) })
  );
  yield* send(actor, { type: 'APPROVE', reviewer: 'Ada' });
  yield* waitFor(actor, (s) => s.matches('approved'));
  // Wait for the demo audit before closing the scope.
  yield* recorded.await;
  return actor.getSnapshot().value;
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 'approved'
