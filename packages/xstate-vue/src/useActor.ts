import { ActorRef, EventObject, Snapshot, SnapshotFrom } from 'xstate';
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
export function useActor<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  actorRef: ActorRef<TEvent, TSnapshot> | Ref<ActorRef<TEvent, TSnapshot>>
): { state: Ref<TSnapshot>; send: (event: TEvent) => void };
export function useActor(
  actorRef:
    | ActorRef<EventObject, Snapshot<unknown>>
    | Ref<ActorRef<EventObject, Snapshot<unknown>>>
): {
  state: Ref<unknown>;
  send: (event: EventObject) => void;
} {
  const actorRefRef = isRef(actorRef) ? actorRef : shallowRef(actorRef);
  const state = shallowRef(actorRefRef.value.getSnapshot());

  const send: typeof actorRefRef.value.send = (event) => {
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
