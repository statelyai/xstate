export * from '@xstate/store';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'preact/hooks';
import {
  createAtom,
  createStore,
  type AnyAtom,
  type AnyAtomConfig,
  type AnyStoreConfig,
  type AnyStoreLogicCreator,
  type BaseAtom,
  type InputFromAtomConfig,
  type InputFromStoreLogicCreator,
  type Readable,
  type StoreFromStoreConfig,
  type StoreFromStoreLogicCreator,
  type ValueFromAtomConfig
} from '@xstate/store';

type InternalStore = {
  _value: any;
  _getSnapshot: () => any;
};

type StoreRef = {
  _instance: InternalStore;
};

/**
 * Custom useSyncExternalStore for Preact Adapted from
 * https://github.com/preactjs/preact/blob/main/compat/src/hooks.js and
 * https://github.com/facebook/react/blob/main/packages/use-sync-external-store/src/useSyncExternalStoreShimClient.js
 */
function useSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T
): T {
  const value = getSnapshot();

  const [{ _instance }, forceUpdate] = useState<StoreRef>({
    _instance: { _value: value, _getSnapshot: getSnapshot }
  });

  useLayoutEffect(() => {
    _instance._value = value;
    _instance._getSnapshot = getSnapshot;

    if (didSnapshotChange(_instance)) {
      forceUpdate({ _instance });
    }
  }, [subscribe, value, getSnapshot]);

  useEffect(() => {
    if (didSnapshotChange(_instance)) {
      forceUpdate({ _instance });
    }

    return subscribe(() => {
      if (didSnapshotChange(_instance)) {
        forceUpdate({ _instance });
      }
    });
  }, [subscribe]);

  return value;
}

function didSnapshotChange(inst: {
  _getSnapshot: () => any;
  _value: any;
}): boolean {
  const latestGetSnapshot = inst._getSnapshot;
  const prevValue = inst._value;
  try {
    const nextValue = latestGetSnapshot();
    return !Object.is(prevValue, nextValue);
  } catch {
    return true;
  }
}

function defaultCompare<T>(a: T | undefined, b: T) {
  return a === b;
}

function identity<T>(snapshot: T): T {
  return snapshot;
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

function useSelectorWithCompare<TStore extends Readable<any>, T>(
  selector: (snapshot: TStore extends Readable<infer T> ? T : never) => T,
  compare: (a: T | undefined, b: T) => boolean
): (snapshot: TStore extends Readable<infer TValue> ? TValue : never) => T {
  const previous = useRef<T | undefined>(undefined);

  return (snapshot) => {
    const next = selector(snapshot);
    return previous.current !== undefined && compare(previous.current, next)
      ? previous.current
      : (previous.current = next);
  };
}

/**
 * A Preact hook that subscribes to the `store` and selects a value from the
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
 * A Preact hook that subscribes to the `store` and selects a value from the
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
    () => selectorWithCompare(store.get())
  );
}

export function useStore<TDefinition extends StoreDefinition>(
  ...[definition, input]: UseStoreArgs<TDefinition>
): StoreFromStoreDefinition<TDefinition> {
  const storeRef = useRef<any>(undefined);

  if (!storeRef.current) {
    storeRef.current =
      'createStore' in definition
        ? definition.createStore(input)
        : createStore(definition);
  }

  return storeRef.current;
}

export function useAtom<T>(atom: BaseAtom<T>): T;
export function useAtom<T, S>(
  atom: BaseAtom<T>,
  selector: (value: T) => S,
  compare?: (a: S | undefined, b: S) => boolean
): S;
export function useAtom(
  atom: AnyAtom,
  selector = identity,
  compare = defaultCompare
) {
  return useSelector(atom, selector, compare);
}

export function useAtomState<TDefinition extends AtomDefinition>(
  ...[definition, input]: UseAtomStateArgs<TDefinition>
): AtomStateFromDefinition<TDefinition> {
  const atomRef = useRef<any>(undefined);

  if (!atomRef.current) {
    atomRef.current =
      'createAtom' in definition ? createAtom(definition, input) : definition;
  }

  const value = useAtom(atomRef.current);

  return [
    value,
    atomRef.current
  ] as unknown as AtomStateFromDefinition<TDefinition>;
}
