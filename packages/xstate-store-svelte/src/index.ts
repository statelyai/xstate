export * from '@xstate/store';

import { type Readable as XStateReadable } from '@xstate/store';
import {
  createStore,
  type AnyStoreConfig,
  type AnyStoreLogicCreator,
  type InputFromStoreLogicCreator,
  type StoreFromStoreConfig,
  type StoreFromStoreLogicCreator
} from '@xstate/store';
import type { Readable } from 'svelte/store';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

type StoreDefinition = AnyStoreConfig | AnyStoreLogicCreator;

type StoreFromStoreDefinition<TDefinition extends StoreDefinition> =
  TDefinition extends AnyStoreLogicCreator
    ? StoreFromStoreLogicCreator<TDefinition>
    : TDefinition extends AnyStoreConfig
      ? StoreFromStoreConfig<TDefinition>
      : never;

type UseStoreArgs<TDefinition extends StoreDefinition> =
  TDefinition extends AnyStoreLogicCreator
    ? undefined extends InputFromStoreLogicCreator<TDefinition>
      ? [logic: TDefinition, input?: InputFromStoreLogicCreator<TDefinition>]
      : [logic: TDefinition, input: InputFromStoreLogicCreator<TDefinition>]
    : [definition: TDefinition];

/**
 * Creates a Svelte readable store that subscribes to an XState store and
 * selects a value from the store's snapshot via a selector function.
 *
 * @example
 *
 * ```svelte
 * <script>
 * import { store } from './store';
 * import { useSelector } from '@xstate/store-svelte';
 *
 * const count = useSelector(store, (state) => state.context.count);
 * </script>
 *
 * <div>{$count}</div>
 * ```
 *
 * @param store The store, created from `createStore(…)`
 * @param selector A function which takes in the snapshot and returns a selected
 *   value
 * @param compare An optional function which compares the selected value to the
 *   previous value
 * @returns A Svelte readable store
 */
export function useSelector<TStore extends XStateReadable<any>, TSelected>(
  store: TStore,
  selector: (
    state: TStore extends XStateReadable<infer T> ? T : never
  ) => TSelected = (d) => d as any,
  compare: (a: TSelected, b: TSelected) => boolean = defaultCompare
): Readable<TSelected> {
  return {
    subscribe(run) {
      let currentValue = selector(store.get());
      run(currentValue);

      const { unsubscribe } = store.subscribe((state) => {
        const nextValue = selector(state);
        if (!compare(currentValue, nextValue)) {
          currentValue = nextValue;
          run(currentValue);
        }
      });

      return unsubscribe;
    }
  };
}

/** Creates a store instance for Svelte usage. */
export function useStore<TDefinition extends StoreDefinition>(
  ...[definition, input]: UseStoreArgs<TDefinition>
): StoreFromStoreDefinition<TDefinition> {
  return (
    'createStore' in definition
      ? definition.createStore(input)
      : createStore(definition)
  ) as StoreFromStoreDefinition<TDefinition>;
}
