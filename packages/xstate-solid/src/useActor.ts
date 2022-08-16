import type { ActorRef, EventObject, Sender } from 'xstate';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, onCleanup } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';

export function isActorWithState<T extends ActorRef<any>>(
  actorRef: T
): actorRef is T & { state: any } {
  return 'state' in actorRef;
}

type EmittedFromActorRef<
  TActor extends ActorRef<any>
> = TActor extends ActorRef<any, infer TEmitted> ? TEmitted : never;

const noop = () => {
  /* ... */
};

export function defaultGetSnapshot<TEmitted>(
  actorRef: ActorRef<any, TEmitted>
): TEmitted | object {
  return 'getSnapshot' in actorRef
    ? actorRef.getSnapshot()
    : isActorWithState(actorRef)
    ? actorRef.state
    : {};
}

type ActorReturn<T> = Accessor<T>;
export function useActor<TActor extends ActorRef<any, any>>(
  actorRef: Accessor<TActor> | TActor,
  getSnapshot?: (actor: TActor) => EmittedFromActorRef<TActor>
): [ActorReturn<EmittedFromActorRef<TActor>>, TActor['send']];
export function useActor<TEvent extends EventObject, TEmitted>(
  actorRef: Accessor<ActorRef<TEvent, TEmitted>> | ActorRef<TEvent, TEmitted>,
  getSnapshot?: (actor: ActorRef<TEvent, TEmitted>) => TEmitted
): [ActorReturn<TEmitted>, Sender<TEvent>];
export function useActor(
  actorRef:
    | Accessor<ActorRef<EventObject, unknown>>
    | ActorRef<EventObject, unknown>,
  getSnapshot: (
    actor: ActorRef<EventObject, unknown>
  ) => unknown = defaultGetSnapshot
): [ActorReturn<unknown>, Sender<EventObject>] {
  const actorMemo = createMemo<ActorRef<EventObject, unknown>>(
    typeof actorRef === 'function' ? actorRef : () => actorRef
  );

  const [state, update] = createStore({
    snapshot: getSnapshot(actorMemo())
  });

  createEffect(() => {
    update('snapshot', reconcile(getSnapshot(actorMemo())));
    const { unsubscribe } = actorMemo().subscribe({
      next: (emitted: unknown) => {
        update('snapshot', reconcile(emitted));
      },
      error: noop,
      complete: noop
    });
    onCleanup(unsubscribe);
  });

  return [createMemo(() => state.snapshot), actorMemo().send];
}
