import { Effect } from 'effect';
import { createEffectActor, waitFor } from '@xstate/effect';
import { createMachine, type Snapshot } from 'xstate';

const review = createMachine({
  id: 'review',
  initial: 'draft',
  states: {
    draft: { on: { SUBMIT: { target: 'inReview' } } },
    inReview: { on: { APPROVE: { target: 'approved' } } },
    approved: { type: 'final' }
  }
});

// Handle one event, then return the snapshot to store.
const handle = (
  stored: Snapshot<unknown> | undefined,
  event: { type: 'SUBMIT' } | { type: 'APPROVE' }
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(review, { snapshot: stored });
      const before = actor.getSnapshot();
      actor.send(event);
      yield* waitFor(actor, (snapshot) => snapshot !== before);
      return JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
    })
  );

const program = Effect.gen(function* () {
  const submitted = yield* handle(undefined, { type: 'SUBMIT' });
  // Store `submitted` in a database row or a Durable Object, possibly for days.
  const approved = yield* handle(submitted, { type: 'APPROVE' });
  return approved.status;
});

export const result = await Effect.runPromise(program);
console.log(result); // 'done'
