import {
  ActorRef,
  AnyInterpreter,
  EmittedFrom,
  Event,
  EventObject,
  InterpreterStatus
} from 'xstate';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, onCleanup } from 'solid-js';
import { deriveServiceState, isStateLike } from './deriveServiceState';
import { createImmutable } from './createImmutable';
import type { CheckSnapshot } from './types';

const noop = () => {
  /* ... */
};

type Sender<TEvent> = (event: TEvent) => void;

// Only spread actor snapshot if it is a xstate state class
const spreadIfStateInstance = <T>(value: T) =>
  isStateLike(value) ? { ...value } : value;

const isServiceLike = (actor: ActorRef<any>): actor is AnyInterpreter =>
  'machine' in actor;

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

  const initialActor = actorMemo();
  const initialState =
    isServiceLike(initialActor) &&
    initialActor.status === InterpreterStatus.NotStarted
      ? initialActor.machine.initialState
      : initialActor.getSnapshot?.();

  const [state, setState] = createImmutable({
    snapshot: deriveServiceState(
      initialState,
      spreadIfStateInstance(initialState)
    )
  });

  createEffect<boolean>((isInitialActor) => {
    const actor = actorMemo();

    if (!isInitialActor) {
      const currentState = actor.getSnapshot?.();
      setState({
        snapshot: deriveServiceState(
          currentState,
          spreadIfStateInstance(currentState)
        )
      });
    }

    const { unsubscribe } = actor.subscribe({
      next: (state) => {
        setState({
          snapshot: deriveServiceState(state)
        });
      },
      error: noop,
      complete: noop
    });
    onCleanup(unsubscribe);

    return false;
  }, true);

  const send = (event: Event<EventObject>) => actorMemo().send(event);

  return [() => state.snapshot, send];
}
