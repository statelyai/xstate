import { Effect, Latch, Schema } from 'effect';
import { createEffectActor, send, setupEffect } from '@xstate/effect';

const messages: string[] = [];
const recorded = Latch.makeUnsafe();
const machine = setupEffect({
  schemas: {
    actions: {
      audit: { params: Schema.Struct({ message: Schema.String }) }
    }
  },
  actions: {
    audit: ({ message }) =>
      Effect.sync(() => {
        messages.push(message);
      }).pipe(Effect.andThen(recorded.open))
  }
}).createMachine({
  on: {
    SAVE: (args, enq) =>
      enq(args.actions.audit, { self: args.self, message: 'saved' })
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(machine);
  yield* send(actor, { type: 'SAVE' });
  yield* recorded.await;
  return messages;
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result);
