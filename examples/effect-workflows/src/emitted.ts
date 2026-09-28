import { Effect, Schema, Stream } from 'effect';
import { createEffectActor, emitted, setupEffect } from '@xstate/effect';

const reminderMachine = setupEffect({
  schemas: {
    emitted: { reminder: Schema.Struct({ message: Schema.String }) }
  }
}).createMachine({
  initial: 'waiting',
  states: {
    waiting: { after: { 1000: { target: 'reminding' } } },
    reminding: {
      entry: (_, enq) =>
        enq.emit({ type: 'reminder', message: 'Review pending' }),
      after: { 0: { target: 'waiting' } }
    }
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(reminderMachine);
  return [...(yield* emitted(actor).pipe(Stream.take(1), Stream.runCollect))];
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // [{ type: 'reminder', message: 'Review pending' }]
