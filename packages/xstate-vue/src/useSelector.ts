import { Ref, isRef, shallowRef, watch } from 'vue';
import { ActorRef, SnapshotFrom } from 'xstate';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

const noop = () => {
  /* ... */
};

export function useSelector<TActor extends ActorRef<any, any>, T>(
  actor: TActor | Ref<TActor>,
  selector: (snapshot: SnapshotFrom<TActor>) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
) {
  const actorRefRef = isRef(actor) ? actor : shallowRef(actor);
  const selected = shallowRef(selector(actorRefRef.value.getSnapshot()));

  const updateSelectedIfChanged = (nextSelected: T) => {
    if (!compare(selected.value, nextSelected)) {
      selected.value = nextSelected;
    }
  };

  watch(
    actorRefRef,
    (newActor, _, onCleanup) => {
      selected.value = selector(newActor.getSnapshot());
      const { unsubscribe } = newActor.subscribe({
        next: (emitted) => {
          updateSelectedIfChanged(selector(emitted));
        },
        error: noop,
        complete: noop
      });
      onCleanup(() => unsubscribe());
    },
    {
      immediate: true
    }
  );

  return selected;
}
