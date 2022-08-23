import type { ActorRef, Event, EventObject, Sender } from 'xstate';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, on, onCleanup } from 'solid-js';
import { createStore } from 'solid-js/store';
import { State } from 'xstate';
import { deepClone } from './utils';
import { deriveServiceState, updateState } from './stateUtils';

type EmittedFromActorRef<
  TActor extends ActorRef<any>
> = TActor extends ActorRef<any, infer TEmitted> ? TEmitted : never;

const noop = () => {
  /* ... */
};

// Only spread actor snapshot if it is a xstate state class
const spreadIfStateInstance = <T>(value: T) =>
  value instanceof State ? { ...value } : value;

export function useActor<TActor extends ActorRef<any>>(
  actorRef: Accessor<TActor> | TActor
): [Accessor<EmittedFromActorRef<TActor>>, TActor['send']];
export function useActor<TEvent extends EventObject, TEmitted>(
  actorRef: Accessor<ActorRef<TEvent, TEmitted>> | ActorRef<TEvent, TEmitted>
): [Accessor<TEmitted>, Sender<TEvent>];
export function useActor(
  actorRef:
    | Accessor<ActorRef<EventObject, unknown>>
    | ActorRef<EventObject, unknown>
): [Accessor<unknown>, Sender<EventObject>] {
  const actorMemo = createMemo(() =>
    typeof actorRef === 'function' ? actorRef() : actorRef
  );

  const send = (event: Event<EventObject>) => actorMemo().send(event);

  const getClonedActorState = () =>
    deepClone(spreadIfStateInstance(actorMemo().getSnapshot?.()));

  const [state, setState] = createStore({
    snapshot: deriveServiceState(actorMemo(), getClonedActorState())
  });

  // Track if a new actor is passed in, only run once per actor
  createEffect(
    on(
      actorMemo,
      () => {
        setState(
          'snapshot',
          deriveServiceState(actorMemo(), getClonedActorState())
        );
      },
      { defer: true }
    )
  );

  createEffect(() => {
    const { unsubscribe } = actorMemo().subscribe({
      next: (emitted: unknown) => {
        updateState(emitted, (...values) =>
          setState('snapshot', ...(values as [any]))
        );
      },
      error: noop,
      complete: noop
    });
    onCleanup(unsubscribe);
  });

  return [() => state.snapshot, send];
}
