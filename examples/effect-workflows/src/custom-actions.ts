import { createInspector } from '@statelyai/sdk';
import { Effect, Latch, Schema } from 'effect';
import type { Snapshot } from 'xstate';
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

const inspectorSnapshot = (snapshot: Snapshot<unknown>) => ({
  status: snapshot.status,
  ...('value' in snapshot ? { value: snapshot.value } : {})
});

const program = Effect.gen(function* () {
  const inspector = yield* Effect.acquireRelease(
    Effect.sync(() =>
      process.env.INSPECT === '1' ? createInspector() : undefined
    ),
    (inspector) => Effect.sync(() => inspector?.destroy())
  );
  const actor = yield* createEffectActor(machine);
  if (inspector) {
    inspector.actor(actor.sessionId!, {
      machine: machine.config,
      snapshot: inspectorSnapshot(actor.getSnapshot())
    });
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        actor.inspect((event) => {
          const id = event.actorRef.sessionId!;
          if (event.type === '@xstate.actor') {
            inspector.actor(id, {
              parent: event.parentRef?.sessionId,
              snapshot: inspectorSnapshot(event.snapshot)
            });
          } else {
            inspector.event(id, event.event, {
              source: event.sourceRef?.sessionId
            });
            inspector.snapshot(
              id,
              inspectorSnapshot(event.snapshot),
              event.event
            );
            if (event.snapshot.status !== 'active') inspector.stop(id);
          }
        })
      ),
      (subscription) => Effect.sync(() => subscription.unsubscribe())
    );
    yield* Effect.promise(() => inspector.ready);
  }
  yield* send(actor, { type: 'SAVE' });
  yield* recorded.await;
  return messages;
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result);
