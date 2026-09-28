import { createInspector } from '@statelyai/sdk';
import { Effect } from 'effect';
import type { Snapshot } from 'xstate';
import {
  createEffectActor,
  fromEffect,
  join,
  send,
  setupEffect
} from '@xstate/effect';

const reviewMachine = setupEffect({
  actors: { publish: fromEffect(Effect.succeed('Release published')) }
}).createMachine({
  id: 'releaseReview',
  output: () => 'Release published',
  initial: 'awaitingApproval',
  states: {
    awaitingApproval: { on: { APPROVE: { target: 'publishing' } } },
    publishing: { invoke: { src: 'publish', onDone: { target: 'published' } } },
    published: { type: 'final' }
  }
});

// Keep wire snapshots JSON-safe; actor snapshots contain live child references.
const inspectorSnapshot = (snapshot: Snapshot<unknown>) => ({
  status: snapshot.status,
  ...('value' in snapshot ? { value: snapshot.value } : {})
});

export const program = Effect.gen(function* () {
  const inspector = yield* Effect.acquireRelease(
    Effect.sync(() =>
      process.env.INSPECT === '1' ? createInspector() : undefined
    ),
    (inspector) => Effect.sync(() => inspector?.destroy())
  );
  const actor = yield* createEffectActor(reviewMachine);
  if (inspector) {
    inspector.actor(actor.sessionId!, {
      machine: reviewMachine.config,
      snapshot: inspectorSnapshot(actor.getSnapshot())
    });
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        actor.inspect((event) => {
          // Session IDs stay stable across Effect's pure execution steps.
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
    // Let the inspector connect before the demo sends its first event.
    yield* Effect.promise(() => inspector.ready);
  }
  yield* send(actor, { type: 'APPROVE' });
  return yield* join(actor);
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 'Release published'
