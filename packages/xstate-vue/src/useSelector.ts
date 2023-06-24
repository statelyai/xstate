import { onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { ActorRef, SnapshotFrom, Subscription } from 'xstate';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

export function useSelector<TActor extends ActorRef<any, any>, T>(
  actor: TActor,
  selector: (snapshot: SnapshotFrom<TActor>) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
) {
  const selected = shallowRef(selector(actor.getSnapshot()));

  const updateSelectedIfChanged = (nextSelected: T) => {
    if (!compare(selected.value, nextSelected)) {
      selected.value = nextSelected;
    }
  };

  let sub: Subscription | undefined;
  onMounted(() => {
    const initialSelected = selector(actor.getSnapshot());
    updateSelectedIfChanged(initialSelected);
    sub = actor.subscribe((emitted) => {
      const nextSelected = selector(emitted);
      updateSelectedIfChanged(nextSelected);
    });
  });

  onBeforeUnmount(() => {
    sub?.unsubscribe();
  });

  return selected;
}
