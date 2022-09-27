import type { ActorRef, EmittedFrom, Event, EventObject } from 'xstate';
import type { Accessor } from 'solid-js';
import { createMemo, createRenderEffect, on, onCleanup } from 'solid-js';
import { deriveServiceState } from './deriveServiceState';
import { createImmutable } from './createImmutable';
import { isStateLike } from 'xstate/lib/utils';
import type { CheckSnapshot } from './types';

const noop = () => {
  /* ... */
};

type Sender<TEvent> = (event: TEvent) => void;

// Only spread actor snapshot if it is a xstate state class
const spreadIfStateInstance = <T>(value: T) =>
  isStateLike(value) ? { ...value } : value;

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

  const getActorState = () =>
    spreadIfStateInstance(actorMemo().getSnapshot?.());

  const [state, setState] = createImmutable({
    snapshot: deriveServiceState(actorMemo(), getActorState())
  });

  // Track if a new actor is passed in, only run once per actor
  createRenderEffect(
    on(
      actorMemo,
      (actor) => {
        setState({
          snapshot: deriveServiceState(actor, getActorState())
        });
      },
      { defer: true }
    )
  );

  createRenderEffect(() => {
    const actor = actorMemo();
    const { unsubscribe } = actor.subscribe({
      next: (emitted: unknown) =>
        setState({
          snapshot: deriveServiceState(actor, emitted)
        }),
      error: noop,
      complete: noop
    });
    onCleanup(unsubscribe);
  });

  const send = (event: Event<EventObject>) => actorMemo().send(event);

  return [() => state.snapshot, send];
}
