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
  compare?: (a: T, b: T) => boolean
): Ref<T>;
export function useSelector<TActor extends ActorRef<any, any>, T>(
  actor: (TActor | undefined) | Ref<TActor | undefined>,
  selector: (snapshot: SnapshotFrom<TActor> | undefined) => T,
  compare?: (a: T | undefined, b: T) => boolean
): Ref<T | undefined>;
export function useSelector<TActor extends ActorRef<any, any>, T>(
  actor: (TActor | undefined) | Ref<TActor | undefined>,
  selector: (snapshot: SnapshotFrom<TActor> | undefined) => T,
  compare: (a: T | undefined, b: T) => boolean = defaultCompare
): Ref<T | undefined> {
  const actorRefRef = isRef(actor) ? actor : shallowRef(actor);
  const selected = shallowRef(
    actorRefRef.value ? selector(actorRefRef.value.getSnapshot()) : undefined
  );

  const updateSelectedIfChanged = (nextSelected: T) => {
    if (!compare(selected.value, nextSelected)) {
      selected.value = nextSelected;
    }
  };

  watch(
    actorRefRef,
    (newActor, _, onCleanup) => {
      selected.value = selector(newActor?.getSnapshot() ?? undefined);
      const sub = newActor?.subscribe({
        next: (emitted) => {
          updateSelectedIfChanged(selector(emitted));
        },
        error: noop,
        complete: noop
      });
      onCleanup(() => sub?.unsubscribe());
    },
    {
      immediate: true
    }
  );

  return selected;
}
