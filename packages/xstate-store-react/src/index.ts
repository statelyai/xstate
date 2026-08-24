export * from '@xstate/store';

import { useCallback, useRef, useSyncExternalStore } from 'react';
import {
  type AnyStoreConfig,
  type AnyStoreLogicCreator,
  type StoreFromStoreLogicCreator,
  type StoreFromStoreConfig,
  type InputFromStoreLogicCreator,
  type Readable,
  type AnyAtom,
  type AnyAtomConfig,
  type AtomConfig,
  type BaseAtom,
  type InputFromAtomConfig,
  type ValueFromAtomConfig,
  type StoreSnapshot,
  type ContextFromStoreConfig,
  createStore,
  isAtom
} from '@xstate/store';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

function identity<T>(snapshot: T): T {
  return snapshot;
}

function useSelectorWithCompare<TSnapshot, T>(
  selector: (snapshot: TSnapshot) => T,
  compare: (a: T, b: T) => boolean
): (snapshot: TSnapshot) => T {
  const previous = useRef<T | undefined>(undefined);

  return (snapshot) => {
    const next = selector(snapshot);
    return previous.current !== undefined && compare(previous.current, next)
      ? previous.current
      : (previous.current = next);
  };
}

function createStoreFromDefinition<TDefinition extends AnyStoreConfig>(
  definition: TDefinition
): StoreFromStoreConfig<TDefinition>;
function createStoreFromDefinition(definition: AnyStoreConfig) {
  return createStore(definition);
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

type AtomDefinition = BaseAtom<any> | AnyAtomConfig;

type AtomStateFromDefinition<TDefinition extends AtomDefinition> =
  TDefinition extends AnyAtomConfig
    ? readonly [
        value: ValueFromAtomConfig<TDefinition>,
        atom: ReturnType<TDefinition['createAtom']>
      ]
    : TDefinition extends BaseAtom<infer TValue>
      ? readonly [value: TValue, atom: TDefinition]
      : never;

type UseAtomStateArgs<TDefinition extends AtomDefinition> =
  TDefinition extends AnyAtomConfig
    ? undefined extends InputFromAtomConfig<TDefinition>
      ? [config: TDefinition, input?: InputFromAtomConfig<TDefinition>]
      : [config: TDefinition, input: InputFromAtomConfig<TDefinition>]
    : [atom: TDefinition];

type AtomConfigInput<TInput> = undefined extends TInput
  ? [input?: TInput]
  : [input: TInput];

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
  compare?: (a: T, b: T) => boolean
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
  compare: (a: T, b: T) => boolean = defaultCompare
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

/** Creates a stable store instance for the lifetime of a React component. */
export function useStore<TDefinition extends StoreDefinition>(
  ...[definition, input]: UseStoreArgs<TDefinition>
): StoreFromStoreDefinition<TDefinition> {
  const storeRef = useRef<any>(undefined);

  if (!storeRef.current) {
    storeRef.current =
      'createStore' in definition
        ? definition.createStore(input)
        : createStoreFromDefinition(definition);
  }

  return storeRef.current;
}

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
export function useAtom<TValue, TInput>(
  config: AtomConfig<TValue, TInput>,
  ...input: AtomConfigInput<TInput>
): TValue;
export function useAtom<T, S>(
  atom: BaseAtom<T>,
  selector: (snapshot: T) => S,
  compare?: (a: S, b: S) => boolean
): S;
export function useAtom(
  definition: AnyAtom | AtomConfig<any, any>,
  selectorOrInput?: any,
  compare = defaultCompare
) {
  const atomRef = useRef<any>(undefined);

  if (isAtom(definition)) {
    return useSelector(definition, selectorOrInput ?? identity, compare);
  }

  if (!atomRef.current) {
    atomRef.current = definition.createAtom(selectorOrInput);
  }

  const state = useSelector(atomRef.current, identity, compare);

  return state;
}

/**
 * Creates or subscribes to an atom for the lifetime of a React component.
 *
 * Pass an existing atom to receive `[value, atom]`, or pass an atom config
 * created with `createAtomConfig(...)` to create a stable local atom.
 */
export function useAtomState<TDefinition extends AtomDefinition>(
  ...[definition, input]: UseAtomStateArgs<TDefinition>
): AtomStateFromDefinition<TDefinition> {
  const atomRef = useRef<any>(undefined);

  if (!atomRef.current) {
    atomRef.current = isAtom(definition)
      ? definition
      : definition.createAtom(input);
  }

  const value = useAtom(atomRef.current);

  return [
    value,
    atomRef.current
  ] as unknown as AtomStateFromDefinition<TDefinition>;
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
  type TStore = StoreFromStoreConfig<TDefinition>;
  type TSnapshot = StoreSnapshot<ContextFromStoreConfig<TDefinition>>;

  const store = createStoreFromDefinition(definition);

  function useStoreHook(): [TSnapshot, TStore];
  function useStoreHook<T>(
    selector: (snapshot: TSnapshot) => T,
    compare?: (a: T, b: T) => boolean
  ): [T, TStore];
  function useStoreHook<T>(
    selector?: (snapshot: TSnapshot) => T,
    compare: (a: T, b: T) => boolean = defaultCompare
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
