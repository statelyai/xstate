export * from '@xstate/store';

import { readonly, ref, toRaw, watch } from 'vue-demi';
import type { Ref } from 'vue-demi';
import {
  createStore,
  type AnyStoreLogicCreator,
  type InputFromStoreLogicCreator,
  type Readable,
  type Store,
  type StoreConfig,
  type StoreFromStoreLogicCreator
} from '@xstate/store';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

type AnyStoreConfig = StoreConfig<any, any, any, any, any, any>;

type StoreFromDefinition<TDefinition extends AnyStoreConfig> =
  TDefinition extends StoreConfig<infer TContext, infer TEventPayloadMap, any>
    ? Store<TContext, TEventPayloadMap, any>
    : never;

type StoreDefinition = AnyStoreConfig | AnyStoreLogicCreator;

type StoreFromStoreDefinition<TDefinition extends StoreDefinition> =
  TDefinition extends AnyStoreLogicCreator
    ? StoreFromStoreLogicCreator<TDefinition>
    : TDefinition extends AnyStoreConfig
      ? StoreFromDefinition<TDefinition>
      : never;

type UseStoreArgs<TDefinition extends StoreDefinition> =
  TDefinition extends AnyStoreLogicCreator
    ? undefined extends InputFromStoreLogicCreator<TDefinition>
      ? [logic: TDefinition, input?: InputFromStoreLogicCreator<TDefinition>]
      : [logic: TDefinition, input: InputFromStoreLogicCreator<TDefinition>]
    : [definition: TDefinition];

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
 * @param compare An optional function which compares the selected value to the
 *   previous value
 * @returns A readonly ref of the selected value
 */
export function useSelector<TStore extends Readable<any>, TSelected>(
  store: TStore,
  selector: (
    state: TStore extends Readable<infer T> ? T : never
  ) => TSelected = (d) => d as any,
  compare: (a: TSelected, b: TSelected) => boolean = defaultCompare
): Readonly<Ref<TSelected>> {
  const slice = ref(selector(store.get())) as Ref<TSelected>;

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

export function useStore<TDefinition extends StoreDefinition>(
  ...[definition, input]: UseStoreArgs<TDefinition>
): StoreFromStoreDefinition<TDefinition> {
  return (
    'createStore' in definition
      ? definition.createStore(input)
      : createStore(definition)
  ) as StoreFromStoreDefinition<TDefinition>;
}
