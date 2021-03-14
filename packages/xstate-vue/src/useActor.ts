import { ActorRef, EventObject, Sender } from 'xstate';
import { shallowRef, isRef, watch, Ref } from 'vue';

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

type EventOfActorRef<
  TActor extends ActorRef<any, any>
> = TActor extends ActorRef<infer TEvent, any> ? TEvent : never;

type EmittedOfActorRef<
  TActor extends ActorRef<any, any>
> = TActor extends ActorRef<any, infer TEmitted> ? TEmitted : never;

const noop = () => {};

export function useActor<TActor extends ActorRef<any, any>>(
  actorRef: TActor | Ref<TActor>,
  getSnapshot?: (actor: TActor) => EmittedOfActorRef<TActor>
): { state: EmittedOfActorRef<TActor>; send: Sender<EventOfActorRef<TActor>> };

export function useActor<TEvent extends EventObject, TEmitted>(
  actorRef: ActorRef<TEvent, TEmitted> | Ref<ActorRef<TEvent, TEmitted>>,
  getSnapshot?: (actor: ActorRef<TEvent, TEmitted>) => TEmitted
): { state: TEmitted; send: Sender<TEvent> };

export function useActor(
  actorRef:
    | ActorRef<EventObject, unknown>
    | Ref<ActorRef<EventObject, unknown>>,
  getSnapshot: (actor: ActorRef<EventObject, unknown>) => unknown = (a) =>
    isActorWithState(a) ? a.state : undefined
): {
  state: unknown;
  send: Sender<EventObject>;
} {
  const actorRefRef = isRef(actorRef) ? actorRef : shallowRef(actorRef);
  const state = shallowRef(getSnapshot(actorRefRef.value));
  const deferredEventsRef = shallowRef<EventObject[]>([]);

  const send: Sender<EventObject> = (event) => {
    const currentActorRef = actorRefRef.value;
    // If the previous actor is a deferred actor,
    // queue the events so that they can be replayed
    // on the non-deferred actor.
    if (isDeferredActor(currentActorRef) && currentActorRef.deferred) {
      deferredEventsRef.value.push(event);
    } else {
      currentActorRef.send(event);
    }
  };

  watch(
    actorRef,
    (newActor, _, onCleanup) => {
      const newActorRef = isRef(newActor) ? newActor.value : newActor;
      actorRefRef.value = newActorRef;
      state.value = getSnapshot(newActorRef);
      const { unsubscribe } = newActorRef.subscribe({
        next: (emitted) => (state.value = emitted),
        error: noop,
        complete: noop
      });

      // Dequeue deferred events from the previous deferred actorRef
      while (deferredEventsRef.value.length > 0) {
        const deferredEvent = deferredEventsRef.value.shift()!;
        newActorRef.send(deferredEvent);
      }

      onCleanup(() => unsubscribe());
    },
    {
      immediate: true
    }
  );

  return { state, send };
}
