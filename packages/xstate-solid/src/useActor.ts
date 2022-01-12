import type { ActorRef, EventObject, Sender } from 'xstate';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, on, onCleanup } from 'solid-js';
import { createStoreSignal } from './createStoreSignal';

export function isActorWithState<T extends ActorRef<any>>(
  actorRef: T
): actorRef is T & { state: any } {
  return 'state' in actorRef;
}

function isDeferredActor<T extends ActorRef<any>>(
  actorRef: T
): actorRef is T & { deferred: boolean } {
  return 'deferred' in actorRef;
}

type EmittedFromActorRef<
  TActor extends ActorRef<any, any>
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
  actorRef: Accessor<TActor>,
  getSnapshot?: (actor: TActor) => EmittedFromActorRef<TActor>
): [ActorReturn<EmittedFromActorRef<TActor>>, TActor['send']];
export function useActor<TEvent extends EventObject, TEmitted>(
  actorRef: Accessor<ActorRef<TEvent, TEmitted>>,
  getSnapshot?: (actor: ActorRef<TEvent, TEmitted>) => TEmitted
): [ActorReturn<TEmitted>, Sender<TEvent>];
export function useActor(
  actorRef: Accessor<ActorRef<EventObject, unknown>>,
  getSnapshot: (
    actor: ActorRef<EventObject, unknown>
  ) => unknown = defaultGetSnapshot
): [ActorReturn<unknown>, Sender<EventObject>] {
  const actorMemo = createMemo<ActorRef<EventObject, unknown>>(actorRef);
  const deferredEventsRef: EventObject[] = [];
  const [snapshot, update] = createStoreSignal<unknown>(actorMemo, getSnapshot);
  const send: Sender<EventObject> = (event: EventObject) => {
    const currentActorRef = actorMemo();
    // If the previous actor is a deferred actor,
    // queue the events so that they can be replayed
    // on the non-deferred actor.
    if (isDeferredActor(currentActorRef) && currentActorRef.deferred) {
      deferredEventsRef.push(event);
    } else {
      currentActorRef.send(event);
    }
  };

  createEffect(
    on(actorMemo, () => {
      update(getSnapshot(actorMemo()));
      const { unsubscribe } = actorMemo().subscribe({
        next: (emitted: unknown) => {
          update(emitted);
        },
        error: noop,
        complete: noop
      });
      while (deferredEventsRef.length > 0) {
        const deferredEvent = deferredEventsRef.shift()!;
        actorMemo().send(deferredEvent);
      }
      onCleanup(() => unsubscribe());
    })
  );

  return [snapshot, send];
}
