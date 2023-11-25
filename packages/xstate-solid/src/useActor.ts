import type { ActorRef, EmittedFrom, EventObject } from 'xstate';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, onCleanup } from 'solid-js';
import { deriveServiceState } from './deriveServiceState';
import { createImmutable } from './createImmutable';
import type { CheckSnapshot } from './types';
import { unwrap } from 'solid-js/store';

const noop = () => {
  /* ... */
};

type Sender<TEvent> = (event: TEvent) => void;

export function useActor<TActor extends ActorRef<any>>(
  actorRef: Accessor<TActor> | TActor
): [Accessor<CheckSnapshot<EmittedFrom<TActor>>>, TActor['send']];
export function useActor<TEvent extends EventObject, TEmitted>(
  actorRef: Accessor<ActorRef<TEvent, TEmitted>> | ActorRef<TEvent, TEmitted>
): [Accessor<CheckSnapshot<TEmitted>>, Sender<TEvent>];
export function useActor(
  actorRef:
    | Accessor<ActorRef<EventObject, unknown>>
    | ActorRef<EventObject, unknown>
): [Accessor<unknown>, Sender<EventObject>] {
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

  const send = (event: EventObject) => actorMemo().send(event);

  return [() => state.snapshot, send];
}
