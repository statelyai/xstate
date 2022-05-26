import { ActorRef, EventObject, Sender, SnapshotFrom } from 'xstate';
import { shallowRef, isRef, watch, Ref } from 'vue';

const noop = () => {
  /* ... */
};

export function useActor<TActor extends ActorRef<any, any>>(
  actorRef: TActor | Ref<TActor>
): {
  state: Ref<SnapshotFrom<TActor>>;
  send: TActor['send'];
};
export function useActor<TEvent extends EventObject, TSnapshot>(
  actorRef: ActorRef<TEvent, TSnapshot> | Ref<ActorRef<TEvent, TSnapshot>>
): { state: Ref<TSnapshot>; send: Sender<TEvent> };
export function useActor(
  actorRef: ActorRef<EventObject, unknown> | Ref<ActorRef<EventObject, unknown>>
): {
  state: Ref<unknown>;
  send: Sender<EventObject>;
} {
  const actorRefRef = isRef(actorRef) ? actorRef : shallowRef(actorRef);
  const state = shallowRef(actorRefRef.value.getSnapshot());

  const send: Sender<EventObject> = (event: EventObject) => {
    actorRefRef.value.send(event);
  };

  watch(
    actorRefRef,
    (newActor, _, onCleanup) => {
      state.value = newActor.getSnapshot();
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
