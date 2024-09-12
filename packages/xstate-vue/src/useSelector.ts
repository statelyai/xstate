import { Ref, isRef, shallowRef, watch } from 'vue';
import { AnyActorRef } from 'xstate';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

const noop = () => {
  /* ... */
};

export function useSelector<
  TActor extends Pick<AnyActorRef, 'getSnapshot' | 'subscribe'> | undefined,
  T
>(
  actor: TActor | Ref<TActor>,
  selector: (
    snapshot: TActor extends { getSnapshot(): infer TSnapshot }
      ? TSnapshot
      : undefined
  ) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
): Ref<T> {
  const actorRefRef = isRef(actor) ? actor : shallowRef(actor);
  const selected = shallowRef(selector(actorRefRef.value?.getSnapshot()));

  const updateSelectedIfChanged = (nextSelected: T) => {
    if (!compare(selected.value, nextSelected)) {
      selected.value = nextSelected;
    }
  };

  watch(
    actorRefRef,
    (newActor, _, onCleanup) => {
      selected.value = selector(newActor?.getSnapshot());
      if (!newActor) {
        return;
      }
      const sub = newActor.subscribe({
        next: (emitted) => {
          updateSelectedIfChanged(selector(emitted));
        },
        error: noop,
        complete: noop
      });
      onCleanup(() => sub.unsubscribe());
    },
    {
      immediate: true
    }
  );

  return selected;
}
