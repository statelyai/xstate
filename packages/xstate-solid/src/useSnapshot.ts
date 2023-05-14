import type { ActorRef, SnapshotFrom, EventObject } from 'xstate';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, onCleanup } from 'solid-js';
import { deriveServiceState } from './deriveServiceState.ts';
import { createImmutable } from './createImmutable.ts';
import type { CheckSnapshot } from './types.ts';
import { unwrap } from 'solid-js/store';

const noop = () => {
  /* ... */
};

/**
 * A hook that returns a snapshot of the current state of an XState actor.
 * The snapshot is updated whenever the actor's state changes
 **/
export function useSnapshot<TActor extends ActorRef<any, any>>(
  actorRef: Accessor<TActor> | TActor
): Accessor<CheckSnapshot<SnapshotFrom<TActor>>>;
export function useSnapshot<TEvent extends EventObject, TEmitted>(
  actorRef: Accessor<ActorRef<TEvent, TEmitted>> | ActorRef<TEvent, TEmitted>
): Accessor<CheckSnapshot<TEmitted>>;
export function useSnapshot(
  actorRef:
    | Accessor<ActorRef<EventObject, unknown>>
    | ActorRef<EventObject, unknown>
): Accessor<unknown> {
  const actorMemo = createMemo(() =>
    typeof actorRef === 'function' ? actorRef() : actorRef
  );

  const [state, setState] = createImmutable({
    snapshot: deriveServiceState(actorMemo().getSnapshot?.())
  });

  const setActorState = (actorState: unknown, prevState?: unknown) => {
    setState({
      snapshot: deriveServiceState(actorState, prevState)
    });
  };

  createEffect<boolean>((isInitialActor) => {
    const currentActor = actorMemo();

    if (!isInitialActor) {
      setActorState(currentActor.getSnapshot?.());
    }

    const { unsubscribe } = currentActor.subscribe({
      next: (nextState) => setActorState(nextState, unwrap(state.snapshot)),
      error: noop,
      complete: noop
    });
    onCleanup(unsubscribe);

    return false;
  }, true);

  return () => state.snapshot;
}
