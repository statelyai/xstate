import { useCallback, useRef, useSyncExternalStore } from 'react';
import {
  SnapshotFromStore,
  AnyStore,
  StoreContext,
  EventPayloadMap,
  StoreConfig,
  Store,
  ExtractEvents
} from './types';
import { createStore } from './store';

function defaultCompare<T>(a: T | undefined, b: T) {
  return a === b;
}

function useSelectorWithCompare<TStore extends AnyStore, T>(
  selector: (snapshot: SnapshotFromStore<TStore>) => T,
  compare: (a: T | undefined, b: T) => boolean
): (snapshot: SnapshotFromStore<TStore>) => T {
  const previous = useRef<T | undefined>(undefined);

  return (state) => {
    const next = selector(state);
    return compare(previous.current, next)
      ? (previous.current as T)
      : (previous.current = next);
  };
}

/**
 * A React hook that subscribes to the `store` and selects a value from the
 * store's snapshot, with an optional compare function.
 *
 * @example
 *
 * ```ts
 * function Component() {
 *   const count = useSelector(store, (s) => s.count);
 *
 *   return <div>{count}</div>;
 * }
 * ```
 *
 * @param store The store, created from `createStore(…)`
 * @param selector A function which takes in the `snapshot` and returns a
 *   selected value
 * @param compare An optional function which compares the selected value to the
 *   previous value
 * @returns The selected value
 */
export function useSelector<TStore extends AnyStore, T>(
  store: TStore,
  selector: (snapshot: SnapshotFromStore<TStore>) => T,
  compare: (a: T | undefined, b: T) => boolean = defaultCompare
): T {
  const selectorWithCompare = useSelectorWithCompare(selector, compare);

  return useSyncExternalStore(
    useCallback(
      (handleStoreChange) => store.subscribe(handleStoreChange).unsubscribe,
      [store]
    ),
    () => selectorWithCompare(store.getSnapshot() as SnapshotFromStore<TStore>),
    () =>
      selectorWithCompare(
        store.getInitialSnapshot() as SnapshotFromStore<TStore>
      )
  );
}

export const useStore: {
  <
    TContext extends StoreContext,
    TEventPayloadMap extends EventPayloadMap,
    TEmitted extends EventPayloadMap
  >(
    definition: StoreConfig<TContext, TEventPayloadMap, TEmitted>
  ): Store<TContext, ExtractEvents<TEventPayloadMap>, ExtractEvents<TEmitted>>;
  <
    TContext extends StoreContext,
    TEventPayloadMap extends EventPayloadMap,
    TEmitted extends EventPayloadMap
  >(
    definition: StoreConfig<TContext, TEventPayloadMap, TEmitted>
  ): Store<TContext, ExtractEvents<TEventPayloadMap>, ExtractEvents<TEmitted>>;
} = function useStoreImpl<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap
>(definition: StoreConfig<TContext, TEventPayloadMap, TEmitted>) {
  const storeRef = useRef<AnyStore | undefined>(undefined);

  // Explicit undefined check for React compiler
  // See: https://newsletter.daishikato.com/p/using-useref-for-lazy-initialization-with-react-compiler
  if (storeRef.current === undefined) {
    storeRef.current = createStore(definition);
  }

  return storeRef.current;
};
