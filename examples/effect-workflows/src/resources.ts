import { Effect } from 'effect';
import {
  createEffectActor,
  fromEffect,
  waitFor,
  withActorScope
} from '@xstate/effect';
import { setup } from 'xstate';

const events: string[] = [];
const prepareRelease = fromEffect(
  Effect.gen(function* () {
    // Keep the shared cache open for the rest of the release workflow.
    yield* Effect.acquireRelease(
      Effect.succeed({ name: 'release-cache' }),
      () => Effect.sync(() => events.push('close cache'))
    ).pipe(withActorScope);

    // This temporary workspace belongs to this invocation.
    yield* Effect.acquireRelease(
      Effect.succeed({ directory: '/tmp/release' }),
      () => Effect.sync(() => events.push('remove workspace'))
    );
    events.push('prepare release');
    return 'artifact ready';
  })
);

const releaseMachine = setup({ actors: { prepareRelease } }).createMachine({
  initial: 'preparing',
  states: {
    preparing: {
      invoke: { src: 'prepareRelease', onDone: { target: 'ready' } }
    },
    ready: {}
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(releaseMachine);
  yield* waitFor(actor, (snapshot) => snapshot.matches('ready'));
  events.push('ready for approval');
  // The workspace is gone; the cache stays open while the actor is alive.
});

await Effect.runPromise(Effect.scoped(program));
export const result = events;
console.log(result);
// ['prepare release', 'remove workspace', 'ready for approval', 'close cache']
