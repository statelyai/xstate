import type { ActorRef, SnapshotFrom, EventObject, Snapshot } from 'xstate';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, onCleanup } from 'solid-js';
import { deriveServiceState } from './deriveServiceState.ts';
import { createImmutable } from './createImmutable.ts';
import { unwrap } from 'solid-js/store';

const noop = () => {
  /* ... */
};

type Sender<TEvent> = (event: TEvent) => void;

export function useActor<TActor extends ActorRef<any, any>>(
  actorRef: Accessor<TActor> | TActor
): [Accessor<SnapshotFrom<TActor>>, TActor['send']];
export function useActor<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  actorRef: Accessor<ActorRef<TEvent, TSnapshot>> | ActorRef<TEvent, TSnapshot>
): [Accessor<TSnapshot>, Sender<TEvent>];
export function useActor(
  actorRef:
    | Accessor<ActorRef<EventObject, Snapshot<unknown>>>
    | ActorRef<EventObject, Snapshot<unknown>>
): [Accessor<unknown>, Sender<EventObject>] {
  const actorMemo = createMemo(() =>
    typeof actorRef === 'function' ? actorRef() : actorRef
  );

  const [state, setState] = createImmutable({
    snapshot: deriveServiceState(actorMemo().getSnapshot?.())
  });

  const setActorState = (
    actorState: Snapshot<unknown>,
    prevState?: Snapshot<unknown>
  ) => {
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

  const send = (event: EventObject) => actorMemo().send(event);

  return [() => state.snapshot, send];
}
