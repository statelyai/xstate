export * from '@xstate/store';

import { readonly, ref, toRaw, watch } from 'vue-demi';
import type { Ref } from 'vue-demi';
import { shallowEqual, type Readable } from '@xstate/store';

type EqualityFn<T> = (objA: T, objB: T) => boolean;

interface UseSelectorOptions<T> {
  compare?: EqualityFn<T>;
}

/**
 * A Vue composable that subscribes to a store and selects a value from the
 * store's snapshot via a selector function.
 *
 * @example
 *
 * ```vue
 * <script setup>
 * import { store } from './store';
 * import { useSelector } from '@xstate/store-vue';
 *
 * const count = useSelector(store, (state) => state.context.count);
 * </script>
 *
 * <template>
 *   <div>{{ count }}</div>
 * </template>
 * ```
 *
 * @param store The store, created from `createStore(…)`
 * @param selector A function which takes in the snapshot and returns a selected
 *   value
 * @param options Optional configuration with compare function
 * @returns A readonly ref of the selected value
 */
export function useSelector<TStore extends Readable<any>, TSelected>(
  store: TStore,
  selector: (
    state: TStore extends Readable<infer T> ? T : never
  ) => TSelected = (d) => d as any,
  options: UseSelectorOptions<TSelected> = {}
): Readonly<Ref<TSelected>> {
  const slice = ref(selector(store.get())) as Ref<TSelected>;
  const compare = options.compare ?? shallowEqual;

  watch(
    () => store,
    (value, _oldValue, onCleanup) => {
      const unsub = value.subscribe((s) => {
        const data = selector(s);
        if (compare(toRaw(slice.value), data)) {
          return;
        }
        slice.value = data;
      }).unsubscribe;

      onCleanup(() => {
        unsub();
      });
    },
    { immediate: true }
  );

  return readonly(slice) as Readonly<Ref<TSelected>>;
}
