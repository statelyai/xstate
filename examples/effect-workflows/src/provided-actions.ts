import { Context, Effect, Latch } from 'effect';
import { createEffectActor, send, setupEffect } from '@xstate/effect';

class Audit extends Context.Service<Audit, { record: Effect.Effect<void> }>()(
  'Audit'
) {}

const recorded = Latch.makeUnsafe();
const machine = setupEffect({
  actions: { audit: (_args) => Effect.void }
}).createMachine({
  on: { APPROVE: (args, enq) => enq(args.actions.audit, args) }
});

const auditedMachine = machine.provide({
  actions: { audit: () => Audit.use((audit) => audit.record) }
});

const program = Effect.gen(function* () {
  // The override adds Audit to this machine's required services.
  const actor = yield* createEffectActor(auditedMachine);
  yield* send(actor, { type: 'APPROVE' });
  yield* recorded.await;
  return 'approval recorded';
});

export const result = await Effect.runPromise(
  program.pipe(
    Effect.scoped,
    Effect.provideService(Audit, { record: Effect.asVoid(recorded.open) })
  )
);
console.log(result); // approval recorded
