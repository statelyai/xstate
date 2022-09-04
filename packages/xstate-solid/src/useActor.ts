import type { ActorRef, Event, EventObject, Sender } from 'xstate';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, on, onCleanup } from 'solid-js';
import { State } from 'xstate';
import { deriveServiceState } from './deriveServiceState';
import { createImmutable } from './createImmutable';

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

  const getActorState = () =>
    spreadIfStateInstance(actorMemo().getSnapshot?.());

  const [state, setState] = createImmutable({
    snapshot: deriveServiceState(actorMemo(), getActorState())
  });

  // Track if a new actor is passed in, only run once per actor
  createEffect(
    on(
      actorMemo,
      () => {
        setState({
          snapshot: deriveServiceState(actorMemo(), getActorState())
        });
      },
      { defer: true }
    )
  );

  createEffect(() => {
    const { unsubscribe } = actorMemo().subscribe({
      next: (emitted: unknown) => {
        setState({
          snapshot: deriveServiceState(actorMemo(), emitted)
        });
      },
      error: noop,
      complete: noop
    });
    onCleanup(unsubscribe);
  });

  const send = (event: Event<EventObject>) => actorMemo().send(event);

  return [() => state.snapshot, send];
}
