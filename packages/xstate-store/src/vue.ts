import { onMounted, onScopeDispose, type Ref, shallowRef } from 'vue';
import type { SnapshotFromStore, AnyStore, Subscription } from './types';

function defaultCompare<T>(a: T | undefined, b: T) {
  return a === b;
}

function useSelectorWithCompare<TStore extends AnyStore, T>(
  selector: (snapshot: SnapshotFromStore<TStore>) => T,
  compare: (a: T | undefined, b: T) => boolean
): (snapshot: SnapshotFromStore<TStore>) => T {
  let previous: T | undefined;

  return (state): T => {
    const next = selector(state);

    if (previous === undefined || !compare(previous, next)) {
      previous = next;
    }

    return previous;
  };
}

/**
 * Creates a selector which subscribes to the store and selects a value from the
 * store's snapshot, using an optional comparison function.
 *
 * @example
 *
 * ```vue
 * <script setup>
 * import { donutStore } from './donutStore.ts';
 * import { useSelector } from '@xstate/store/vue';
 *
 * const donutCount = useSelector(donutStore, (state) => state.context.donuts);
 * </script>
 *
 * <template>
 *   <div>
 *     <button @click="donutStore.send({ type: 'addDonut' })">
 *       Add donut ({{ donutCount }})
 *     </button>
 *   </div>
 * </template>
 * ```
 *
 * @param store The store, created from `createStore(…)`
 * @param selector A function which takes in the snapshot and returns a selected
 *   value from it
 * @param compare An optional function which compares the selected value to the
 *   previously selected value
 * @returns A readonly ref of the selected value
 */
export function useSelector<TStore extends AnyStore, T>(
  store: TStore,
  selector: (snapshot: SnapshotFromStore<TStore>) => T,
  compare: (a: T | undefined, b: T) => boolean = defaultCompare
): Ref<T> {
  const selectorWithCompare = useSelectorWithCompare(selector, compare);
  const selectedValue = shallowRef<T>(
    selectorWithCompare(store.getSnapshot() as SnapshotFromStore<TStore>)
  );

  let sub: Subscription;

  onMounted(() => {
    sub = store.subscribe(() => {
      const newValue = selectorWithCompare(
        store.getSnapshot() as SnapshotFromStore<TStore>
      );
      selectedValue.value = newValue;
    });
  });

  onScopeDispose(() => {
    sub?.unsubscribe();
  })

  return selectedValue;
}
