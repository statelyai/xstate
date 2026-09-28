import { Effect, Schema } from 'effect';
import { createEffectActor, fromEffect, join } from '@xstate/effect';

const buildReport = fromEffect({
  schemas: { input: Schema.Struct({ orderIds: Schema.Array(Schema.String) }) },
  effect: ({ input, emit }) =>
    Effect.sync(() => {
      emit({ type: 'reportBuilt', count: input.orderIds.length });
      return { total: input.orderIds.length };
    })
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(buildReport, {
    input: { orderIds: ['order-1', 'order-2'] }
  });
  return yield* join(actor);
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // { total: 2 }
