import type { ActorRef, EventObject, Sender } from 'xstate';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, on, onCleanup } from 'solid-js';
import { createStore } from 'solid-js/store';
import { deepClone, spreadIfObject, updateState } from './util';

type EmittedFromActorRef<
  TActor extends ActorRef<any>
> = TActor extends ActorRef<any, infer TEmitted> ? TEmitted : never;

const noop = () => {
  /* ... */
};

type ActorReturn<T> = Accessor<T>;

export function useActor<TActor extends ActorRef<any>>(
  actorRef: Accessor<TActor> | TActor
): [ActorReturn<EmittedFromActorRef<TActor>>, TActor['send']];
export function useActor<TEvent extends EventObject, TEmitted>(
  actorRef: Accessor<ActorRef<TEvent, TEmitted>> | ActorRef<TEvent, TEmitted>
): [ActorReturn<TEmitted>, Sender<TEvent>];
export function useActor(
  actorRef:
    | Accessor<ActorRef<EventObject, unknown>>
    | ActorRef<EventObject, unknown>
): [ActorReturn<unknown>, Sender<EventObject>] {
  const actorMemo = createMemo<ActorRef<EventObject, unknown>>(
    typeof actorRef === 'function' ? actorRef : () => actorRef
  );

  const send = (event: any) => actorMemo().send(event);

  const getClonedActorState = () =>
    deepClone(spreadIfObject(actorMemo().getSnapshot?.()));

  const [state, setState] = createStore({
    snapshot: getClonedActorState()
  });

  // Track if a new actor is passed in, only run once per actor
  createEffect(
    on(
      () => actorMemo(),
      () => {
        updateState(getClonedActorState(), (...values) =>
          setState('snapshot', ...(values as [any]))
        );
      },
      { defer: true }
    )
  );

  createEffect(() => {
    const { unsubscribe } = actorMemo().subscribe({
      next: (emitted: unknown) => {
        updateState(spreadIfObject(emitted), (...values) =>
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
