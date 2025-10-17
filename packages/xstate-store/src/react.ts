import { useCallback, useRef, useSyncExternalStore } from 'react';
import {
  AnyStore,
  StoreContext,
  EventPayloadMap,
  StoreConfig,
  Store,
  ExtractEvents,
  Readable,
  AnyAtom,
  BaseAtom,
  StoreSnapshot
} from './types';
import { createStore } from './store';

function defaultCompare<T>(a: T | undefined, b: T) {
  return a === b;
}

function identity<T>(snapshot: T): T {
  return snapshot;
}

function useSelectorWithCompare<TStore extends Readable<any>, T>(
  selector: (snapshot: TStore extends Readable<infer T> ? T : never) => T,
  compare: (a: T | undefined, b: T) => boolean
): (snapshot: TStore extends Readable<infer TValue> ? TValue : never) => T {
  const previous = useRef<T | undefined>(undefined);

  return (snapshot) => {
    const next = selector(snapshot);
    return previous.current && compare(previous.current, next)
      ? previous.current
      : (previous.current = next);
  };
}

/**
 * A React hook that subscribes to the `store` and selects a value from the
 * store's snapshot via a selector function, with an optional compare function.
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
export function useSelector<TStore extends Readable<any>, T>(
  store: TStore,
  selector: (snapshot: TStore extends Readable<infer T> ? T : never) => T,
  compare?: (a: T | undefined, b: T) => boolean
): T;
/**
 * A React hook that subscribes to the `store` and selects a value from the
 * store's snapshot via an optional selector function (identity by default),
 * with an optional compare function.
 *
 * @example
 *
 * ```ts
 * function Component() {
 *   const countSnapshot = useSelector(store);
 *
 *   return <div>{countSnapshot.context.count}</div>;
 * }
 * ```
 *
 * @param store The store, created from `createStore(…)`
 * @param selector An optional function which takes in the `snapshot` and
 *   returns a selected value
 * @param compare An optional function which compares the selected value to the
 *   previous value
 * @returns The selected value
 */
export function useSelector<TStore extends Readable<any>>(
  store: TStore,
  selector?: undefined,
  compare?: (
    a: TStore extends Readable<infer T> ? T : never | undefined,
    b: TStore extends Readable<infer T> ? T : never | undefined
  ) => boolean
): TStore extends Readable<infer T> ? T : never;
export function useSelector<TStore extends Readable<any>, T>(
  store: TStore,
  selector: (
    snapshot: TStore extends Readable<infer T> ? T : never
  ) => T = identity,
  compare: (a: T | undefined, b: T) => boolean = defaultCompare
): T {
  const selectorWithCompare = useSelectorWithCompare(selector, compare);

  return useSyncExternalStore(
    useCallback(
      (handleStoreChange) => store.subscribe(handleStoreChange).unsubscribe,
      [store]
    ),
    () => selectorWithCompare(store.get()),
    () => selectorWithCompare(store.get())
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

  if (!storeRef.current) {
    storeRef.current = createStore(definition);
  }

  return storeRef.current;
};

/**
 * A React hook that subscribes to the `atom` and returns the current value of
 * the atom.
 *
 * @example
 *
 * ```ts
 * const atom = createAtom(0);
 *
 * const Component = () => {
 *   const count = useAtom(atom);
 *
 *   return (
 *     <div>
 *       <div>{count}</div>
 *       <button onClick={() => atom.set((c) => c + 1)}>Increment</button>
 *     </div>
 *   );
 * };
 * ```
 *
 * @param atom The atom, created from `createAtom(…)`
 * @param selector An optional function which takes in the `snapshot` and
 *   returns a selected value
 * @param compare An optional function which compares the selected value to the
 *   previous value
 */
export function useAtom<T>(atom: BaseAtom<T>): T;
export function useAtom<T, S>(
  atom: BaseAtom<T>,
  selector: (snapshot: T) => S,
  compare?: (a: S, b: S) => boolean
): S;
export function useAtom(
  atom: AnyAtom,
  selector = identity,
  compare = defaultCompare
) {
  const state = useSelector(atom, selector, compare);

  return state;
}

/**
 * Creates a custom hook that returns the selected value and the store from a
 * store configuration object.
 *
 * @example
 *
 * ```ts
 * const useCountStore = createStoreHook({
 *   context: { count: 0 },
 *   on: {
 *     inc: (context, event: { by: number }) => ({
 *       ...context,
 *       count: context.count + event.by
 *     })
 *   }
 * });
 *
 * function Component() {
 *   const [count, store] = useCountStore(s => s.context.count);
 *
 *   return (
 *     <div>
 *       {count}
 *       <button onClick={() => store.trigger.inc({ by: 1 })}>+</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @param definition The store configuration object
 * @returns A custom hook that returns [selectedValue, store]
 */
export function createStoreHook<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap
>(definition: StoreConfig<TContext, TEventPayloadMap, TEmitted>) {
  type TStore = Store<
    TContext,
    ExtractEvents<TEventPayloadMap>,
    ExtractEvents<TEmitted>
  >;
  type TSnapshot = StoreSnapshot<TContext>;

  const store = createStore(definition);

  function useStoreHook(): [TSnapshot, TStore];
  function useStoreHook<T>(
    selector: (snapshot: TSnapshot) => T,
    compare?: (a: T | undefined, b: T) => boolean
  ): [T, TStore];
  function useStoreHook<T>(
    selector?: (snapshot: TSnapshot) => T,
    compare: (a: T | undefined, b: T) => boolean = defaultCompare
  ) {
    // If no selector provided, return full snapshot
    if (!selector) {
      const snapshot = useSelector(store, identity, defaultCompare);
      return [snapshot, store] as const;
    }

    // Use selector with comparison
    const selectedValue = useSelector(store, selector ?? identity, compare);
    return [selectedValue, store] as const;
  }

  return useStoreHook;
}
