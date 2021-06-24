import { onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { ActorRef, Subscribable } from 'xstate';
import { defaultGetSnapshot } from './useActor';

const defaultCompare = (a, b) => a === b;

export function useSelector<
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: TActor,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = defaultCompare,
  getSnapshot: (a: TActor) => TEmitted = defaultGetSnapshot
) {
  const selected = shallowRef(selector(getSnapshot(actor)));

  const updateSelectedIfChanged = (nextSelected: T) => {
    if (!compare(selected.value, nextSelected)) {
      selected.value = nextSelected;
    }
  };

  let sub;
  onMounted(() => {
    const initialSelected = selector(getSnapshot(actor));
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
