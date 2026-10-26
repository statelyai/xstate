import { Effect, Schema } from 'effect';
import { createEffectActor, createSnapshotCodec } from '@xstate/effect';
import { createMachine } from 'xstate';

const review = createMachine({
  id: 'review',
  version: '1',
  context: { submittedAt: new Date('2026-01-01T00:00:00Z'), amount: 42n },
  initial: 'pending',
  states: { pending: {} }
});

const Snapshot = Schema.Struct({
  status: Schema.Literals(['active', 'stopped']),
  value: Schema.Literal('pending'),
  context: Schema.Struct({
    submittedAt: Schema.DateFromString,
    amount: Schema.BigIntFromString
  }),
  machine: Schema.Struct({
    id: Schema.Literal('review'),
    version: Schema.Literal('1')
  }),
  children: Schema.Record(Schema.String, Schema.Never),
  timers: Schema.Array(Schema.Unknown),
  historyValue: Schema.Record(Schema.String, Schema.Unknown),
  _nextTimerId: Schema.Number
});
const codec = createSnapshotCodec(review, Snapshot);

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(review);
  const json = yield* codec.encode(actor.getPersistedSnapshot());
  const snapshot = yield* codec.decode(json);
  const restored = yield* createEffectActor(review, { snapshot });
  const context = restored.getSnapshot().context;
  return {
    submittedAt: context.submittedAt.toISOString(),
    amount: String(context.amount)
  };
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // { submittedAt: '2026-01-01T00:00:00.000Z', amount: '42' }
