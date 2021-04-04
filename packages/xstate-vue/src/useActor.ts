import { ActorRef, EventObject, Sender } from 'xstate';
import { shallowRef, isRef, watch, Ref } from 'vue';

export function isActorWithState<T extends ActorRef<any>>(
  actorRef: T
): actorRef is T & { state: any } {
  return 'state' in actorRef;
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
): {
  state: Ref<EmittedOfActorRef<TActor>>;
  send: Sender<EventOfActorRef<TActor>>;
};
export function useActor<TEvent extends EventObject, TEmitted>(
  actorRef: ActorRef<TEvent, TEmitted> | Ref<ActorRef<TEvent, TEmitted>>,
  getSnapshot?: (actor: ActorRef<TEvent, TEmitted>) => TEmitted
): { state: Ref<TEmitted>; send: Sender<TEvent> };
export function useActor(
  actorRef:
    | ActorRef<EventObject, unknown>
    | Ref<ActorRef<EventObject, unknown>>,
  getSnapshot: (actor: ActorRef<EventObject, unknown>) => unknown = (a) =>
    isActorWithState(a) ? a.state : (a as any).current || undefined
): {
  state: Ref<unknown>;
  send: Sender<EventObject>;
} {
  const actorRefRef = isRef(actorRef) ? actorRef : shallowRef(actorRef);
  const state = shallowRef(getSnapshot(actorRefRef.value));

  const send: Sender<EventObject> = (event: EventObject) => {
    actorRefRef.value.send(event);
  };

  watch(
    actorRefRef,
    (newActor, _, onCleanup) => {
      state.value = getSnapshot(newActor);
      const { unsubscribe } = newActor.subscribe({
        next: (emitted) => (state.value = emitted),
        error: noop,
        complete: noop
      });
      onCleanup(() => unsubscribe());
    },
    {
      immediate: true
    }
  );

  return { state, send };
}
