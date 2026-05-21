/* @jsxImportSource solid-js */
export * from '@xstate/store';

import { createEffect, createSignal, onCleanup } from 'solid-js';
import {
  createStore,
  type AnyStoreLogicCreator,
  type InputFromStoreLogicCreator,
  type Readable,
  type Store,
  type StoreConfig,
  type StoreFromStoreLogicCreator
} from '@xstate/store';

function defaultCompare<T>(a: T | undefined, b: T) {
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

function useSelectorWithCompare<TSnapshot, T>(
  selector: (snapshot: TSnapshot) => T,
  compare: (a: T | undefined, b: T) => boolean
): (snapshot: TSnapshot) => T {
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
 * ```tsx
 * import { donutStore } from './donutStore.ts';
 * import { useSelector } from '@xstate/store-solid';
 *
 * function DonutCounter() {
 *   const donutCount = useSelector(donutStore, (state) => state.context.donuts);
 *
 *   return (
 *     <div>
 *       <button onClick={() => donutStore.send({ type: 'addDonut' })}>
 *         Add donut ({donutCount()})
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @param store The store, created from `createStore(…)`
 * @param selector A function which takes in the snapshot and returns a selected
 *   value from it
 * @param compare An optional function which compares the selected value to the
 *   previously selected value
 * @returns A read-only signal of the selected value
 */
export function useSelector<TSnapshot, T>(
  store: Readable<TSnapshot>,
  selector: (snapshot: TSnapshot) => T,
  compare: (a: T | undefined, b: T) => boolean = defaultCompare
): () => T {
  const selectorWithCompare = useSelectorWithCompare(selector, compare);
  const [selectedValue, setSelectedValue] = createSignal(
    selectorWithCompare(store.get())
  );

  createEffect(() => {
    const subscription = store.subscribe(() => {
      const newValue = selectorWithCompare(store.get());
      setSelectedValue(() => newValue);
    });

    onCleanup(() => {
      subscription.unsubscribe();
    });
  });

  return selectedValue;
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
