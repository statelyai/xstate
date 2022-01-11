import type { ActorRef, EventObject, Sender } from 'xstate';
import type { Accessor } from 'solid-js';
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { updateState } from './utils';

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

/**
 * Returns an object that can be used in a store
 * Handles primitives or objects.
 */
export const setSnapshotValue = (
  actorRef: Accessor<ActorRef<any, unknown>> | unknown,
  getSnapshot: (actor: ActorRef<any>) => unknown
) => {
  const defaultValue =
    typeof actorRef === 'function' ? getSnapshot(actorRef()) : actorRef;
  return typeof defaultValue === 'object' && defaultValue
    ? defaultValue
    : { _snapshot: defaultValue };
};

export const getSnapshotValue = (state) =>
  '_snapshot' in state ? state._snapshot : state;

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
  const [state, setState] = createStore(
    setSnapshotValue(actorMemo, getSnapshot)
  );
  const [snapshot, setSnapshot] = createSignal(getSnapshotValue(state));
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

  const update = (value: Accessor<ActorRef<any, unknown>> | unknown) => {
    updateState(setSnapshotValue(value, getSnapshot), setState);
    setSnapshot(getSnapshotValue(state));
  };
  createEffect(
    on(actorMemo, () => {
      update(actorMemo);
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
