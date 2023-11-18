import type { ActorRef, SnapshotFrom, EventObject, Snapshot } from 'xstate';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, onCleanup } from 'solid-js';
import { createImmutable } from './createImmutable.ts';

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
    snapshot: actorMemo().getSnapshot?.()
  });

  createEffect<boolean>((isInitialActor) => {
    const currentActor = actorMemo();

    if (!isInitialActor) {
      setState({ snapshot: currentActor.getSnapshot?.() });
    }

    const { unsubscribe } = currentActor.subscribe({
      next: (nextState) => setState({ snapshot: nextState }),
      error: noop,
      complete: noop
    });
    onCleanup(unsubscribe);

    return false;
  }, true);

  const send = (event: EventObject) => actorMemo().send(event);

  return [() => state.snapshot, send];
}
