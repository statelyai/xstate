import { Effect, Schema } from 'effect';
import { createEffectActor, setupEffect } from '@xstate/effect';
import { sendAndAwait } from '@xstate/effect/test';
import { standardSchemaValidator } from 'xstate/validation';

const Input = Schema.Struct({ count: Schema.NumberFromString });
const Add = Schema.Struct({
  type: Schema.Literal('ADD'),
  delta: Schema.NumberFromString
});
const counter = setupEffect({
  validator: standardSchemaValidator(),
  schemas: {
    input: Schema.toType(Input),
    events: { ADD: Schema.Struct({ delta: Schema.Number }) }
  }
}).createMachine({
  context: ({ input }) => ({ count: input.count }),
  on: {
    ADD: ({ context, event }) => ({
      context: { count: context.count + event.delta }
    })
  }
});

const program = Effect.gen(function* () {
  const input = yield* Schema.decodeUnknownEffect(Input)({ count: '2' });
  const actor = yield* createEffectActor(counter, { input });
  const event = yield* Schema.decodeUnknownEffect(Add)({
    type: 'ADD',
    delta: '3'
  });
  return (yield* sendAndAwait(actor, event)).context.count;
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 5
