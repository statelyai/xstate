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
  actorRef: TActor,
  getSnapshot?: (actor: TActor) => EmittedOfActorRef<TActor>
): { state: EmittedOfActorRef<TActor>; send: Sender<EventOfActorRef<TActor>> };

export function useActor<TEvent extends EventObject, TEmitted>(
  actorRef: ActorRef<TEvent, TEmitted>,
  getSnapshot?: (actor: ActorRef<TEvent, TEmitted>) => TEmitted
): { state: TEmitted; send: Sender<TEvent> };

export function useActor<TEvent extends EventObject, TEmitted>(
  actor: ActorRef<TEvent, TEmitted> | Ref<ActorRef<TEvent, TEmitted>>,
  getSnapshot: (actor: ActorRef<EventObject, unknown>) => unknown = (a) =>
    isActorWithState(a) ? a.state : undefined
): {
  state: unknown;
  send: Sender<EventObject>;
} {
  const actorRef = isRef(actor) ? actor : shallowRef(actor);
  const state = shallowRef(getSnapshot(actorRef.value));

  const send: Sender<EventObject> = (event: TEvent) => {
    actorRef.value.send(event);
  };

  watch(
    actorRef,
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
