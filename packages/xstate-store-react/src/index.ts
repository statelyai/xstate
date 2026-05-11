export * from '@xstate/store';

import { useCallback, useRef, useSyncExternalStore } from 'react';
import {
  type Store,
  type StoreConfig,
  type ResolveStoreContext,
  type ResolveStoreEmittedPayloadMap,
  type InferSchemaPayloadMap,
  type ExtractEvents,
  type StandardSchemaMap,
  type Readable,
  type AnyAtom,
  type BaseAtom,
  type StoreSnapshot,
  type ContextFromStoreConfig,
  createStore
} from '@xstate/store';

function defaultCompare<T>(a: T | undefined, b: T) {
  return a === b;
}

function identity<T>(snapshot: T): T {
  return snapshot;
}

function useSelectorWithCompare<TSnapshot, T>(
  selector: (snapshot: TSnapshot) => T,
  compare: (a: T | undefined, b: T) => boolean
): (snapshot: TSnapshot) => T {
  const previous = useRef<T | undefined>(undefined);

  return (snapshot) => {
    const next = selector(snapshot);
    return previous.current !== undefined && compare(previous.current, next)
      ? previous.current
      : (previous.current = next);
  };
}

type AnyStoreConfig = StoreConfig<any, any, any, any, any, any>;

type DistributiveOmit<T, K extends PropertyKey> = T extends any
  ? Omit<T, K>
  : never;

type EventPayloadFromEvent<TEvent> = TEvent extends { type: string }
  ? DistributiveOmit<TEvent, 'type'>
  : TEvent;

type EventPayloadMapFromTransitions<TTransitions> = {
  [K in keyof TTransitions & string]: TTransitions[K] extends (
    context: any,
    event: infer TEvent,
    ...args: any[]
  ) => unknown
    ? EventPayloadFromEvent<TEvent>
    : {};
};

type StoreEventPayloadMapFromDefinition<TDefinition extends AnyStoreConfig> =
  TDefinition extends { schemas: { events: infer TEventSchemaMap } }
    ? TEventSchemaMap extends StandardSchemaMap
      ? InferSchemaPayloadMap<TEventSchemaMap>
      : {}
    : TDefinition extends { on: infer TTransitions }
      ? EventPayloadMapFromTransitions<TTransitions>
      : {};

type StoreFromDefinition<TDefinition extends AnyStoreConfig> =
  TDefinition extends StoreConfig<
    infer TContext,
    any,
    infer TEmittedPayloadMap,
    infer TContextSchema,
    any,
    infer TEmittedSchemaMap
  >
    ? Store<
        ResolveStoreContext<TContext, TContextSchema>,
        StoreEventPayloadMapFromDefinition<TDefinition>,
        ExtractEvents<
          ResolveStoreEmittedPayloadMap<TEmittedPayloadMap, TEmittedSchemaMap>
        >
      >
    : never;

function createStoreFromDefinition<TDefinition extends AnyStoreConfig>(
  definition: TDefinition
): StoreFromDefinition<TDefinition>;
function createStoreFromDefinition(definition: AnyStoreConfig) {
  return createStore(definition);
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
export function useSelector<TSnapshot, T>(
  store: Readable<TSnapshot>,
  selector: (snapshot: TSnapshot) => T,
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
export function useSelector<TSnapshot>(
  store: Readable<TSnapshot>,
  selector?: undefined,
  compare?: (a: TSnapshot | undefined, b: TSnapshot | undefined) => boolean
): TSnapshot;
export function useSelector<TSnapshot, T>(
  store: Readable<TSnapshot>,
  selector?: (snapshot: TSnapshot) => T,
  compare: (a: T | undefined, b: T) => boolean = defaultCompare
): T | TSnapshot {
  const subscribe = useCallback(
    (handleStoreChange: () => void) =>
      store.subscribe(handleStoreChange).unsubscribe,
    [store]
  );

  if (!selector) {
    const selectorWithCompare = useSelectorWithCompare(
      identity,
      defaultCompare
    );

    return useSyncExternalStore(
      subscribe,
      () => selectorWithCompare(store.get()),
      () => selectorWithCompare(store.get())
    );
  }

  const selectorWithCompare = useSelectorWithCompare(selector, compare);

  return useSyncExternalStore(
    subscribe,
    () => selectorWithCompare(store.get()),
    () => selectorWithCompare(store.get())
  );
}

export const useStore: {
  <TDefinition extends AnyStoreConfig>(
    definition: TDefinition
  ): StoreFromDefinition<TDefinition>;
} = function useStoreImpl<TDefinition extends AnyStoreConfig>(
  definition: TDefinition
) {
  const storeRef = useRef<StoreFromDefinition<TDefinition> | undefined>(
    undefined
  );

  if (!storeRef.current) {
    storeRef.current = createStoreFromDefinition(definition);
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
export function createStoreHook<TDefinition extends AnyStoreConfig>(
  definition: TDefinition
) {
  type TStore = StoreFromDefinition<TDefinition>;
  type TSnapshot = StoreSnapshot<ContextFromStoreConfig<TDefinition>>;

  const store = createStoreFromDefinition(definition);

  function useStoreHook(): [TSnapshot, TStore];
  function useStoreHook<T>(
    selector: (snapshot: TSnapshot) => T,
    compare?: (a: T | undefined, b: T) => boolean
  ): [T, TStore];
  function useStoreHook<T>(
    selector?: (snapshot: TSnapshot) => T,
    compare: (a: T | undefined, b: T) => boolean = defaultCompare
  ) {
    if (!selector) {
      const snapshot = useSelector(store);
      return [snapshot, store];
    }

    const selectedValue = useSelector(store, selector, compare);
    return [selectedValue, store];
  }

  return useStoreHook;
}
