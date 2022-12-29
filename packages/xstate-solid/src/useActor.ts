import type { ActorRef, EmittedFrom, Event, EventObject } from 'xstate';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, onCleanup } from 'solid-js';
import { deriveServiceState } from './deriveServiceState';
import { createImmutable } from './createImmutable';
import type { CheckSnapshot } from './types';

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

  const getActorState = () => actorMemo().getSnapshot?.();

  const [state, setState] = createImmutable({
    snapshot: deriveServiceState(getActorState())
  });

  const setActorState = (actorState: unknown) => {
    setState({
      snapshot: deriveServiceState(actorState)
    });
  };

  createEffect<boolean>((isInitialActor) => {
    if (!isInitialActor) {
      setActorState(getActorState());
    }

    const { unsubscribe } = actorMemo().subscribe({
      next: setActorState,
      error: noop,
      complete: noop
    });
    onCleanup(unsubscribe);

    return false;
  }, true);

  const send = (event: Event<EventObject>) => actorMemo().send(event);

  return [() => state.snapshot, send];
}
