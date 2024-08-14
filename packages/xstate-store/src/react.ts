import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  Store,
  SnapshotFromStore,
  StoreLogic,
  SendersFromStore,
  SendersFromStoreLogic
} from './types';
import { createStore } from './store';

function defaultCompare<T>(a: T | undefined, b: T) {
  return a === b;
}

function useSelectorWithCompare<TStore extends Store<any, any>, T>(
  selector: (snapshot: SnapshotFromStore<TStore>) => T,
  compare: (a: T | undefined, b: T) => boolean
): (snapshot: SnapshotFromStore<TStore>) => T {
  const previous = useRef<T>();

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
export function useSelector<TStore extends Store<any, any>, T>(
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

export function useStoreState<TStoreLogic extends StoreLogic<any, any>>(
  storeLogic: TStoreLogic
): [TStoreLogic['initialSnapshot'], SendersFromStoreLogic<TStoreLogic>] {
  const storeRef = useRef<Store<any, any>>();

  if (!storeRef.current) {
    storeRef.current = createStore(
      storeLogic.initialSnapshot.context,
      storeLogic.transitions
    );
  }

  const state = useSelector(storeRef.current, (s) => s);

  const senders = useMemo(() => {
    return Object.keys(storeLogic.transitions).reduce(
      (acc, key: keyof typeof storeLogic.transitions) => {
        acc[key] = (payload: any) =>
          storeRef.current!.send({ type: key, ...payload });
        return acc;
      },
      {} as SendersFromStoreLogic<TStoreLogic>
    );
  }, []);

  return [state, senders];
}
