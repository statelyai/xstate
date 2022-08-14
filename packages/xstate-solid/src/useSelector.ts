import type { ActorRef, Subscribable } from 'xstate';
import { defaultGetSnapshot } from './useActor';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, on, onCleanup } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';

const defaultCompare = (a, b) => a === b;

export function useSelector<
  TActor extends ActorRef<any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: Accessor<TActor> | TActor,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = defaultCompare,
  getSnapshot: (a: TActor) => TEmitted = defaultGetSnapshot
): Accessor<T> {
  const actorMemo = createMemo<TActor>(
    typeof actor === 'function' ? actor : () => actor
  );

  const getActorSnapshot = (act: TActor): T => selector(getSnapshot(act));

  const [state, setState] = createStore({
    snapshot: getActorSnapshot(actorMemo())
  });

  const guardedUpdate = (emitted: TEmitted) => {
    const next = selector(emitted);
    if (!compare(state.snapshot, next)) {
      setState('snapshot', reconcile(next));
    }
  };

  createEffect(
    on(
      // If the actor itself or snapshot value changes
      () => [actorMemo, getActorSnapshot(actorMemo())],
      () => {
        // Update with the latest actor
        guardedUpdate(getSnapshot(actorMemo()));
        const { unsubscribe } = actorMemo().subscribe((emitted) => {
          guardedUpdate(emitted);
        });
        onCleanup(unsubscribe);
      }
    )
  );

  return createMemo(() => state.snapshot);
}
