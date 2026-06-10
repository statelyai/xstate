/* @jsxImportSource solid-js */
export * from '@xstate/store';

import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import {
  createStore,
  isAtom,
  type AnyAtom,
  type AnyAtomConfig,
  type AtomConfig,
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

type AtomDefinition = BaseAtom<any> | AnyAtomConfig;

type AtomStateFromDefinition<TDefinition extends AtomDefinition> =
  TDefinition extends AnyAtomConfig
    ? readonly [
        value: Accessor<ValueFromAtomConfig<TDefinition>>,
        atom: ReturnType<TDefinition['createAtom']>
      ]
    : TDefinition extends BaseAtom<infer TValue>
      ? readonly [value: Accessor<TValue>, atom: TDefinition]
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

function useSelectorWithCompare<TSnapshot, T>(
  selector: (snapshot: TSnapshot) => T,
  compare: (a: T, b: T) => boolean
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
  compare: (a: T, b: T) => boolean = defaultCompare
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

/** Creates a store instance for the current Solid owner. */
export function useStore<TDefinition extends StoreDefinition>(
  ...[definition, input]: UseStoreArgs<TDefinition>
): StoreFromStoreDefinition<TDefinition> {
  return (
    'createStore' in definition
      ? definition.createStore(input)
      : createStore(definition)
  ) as StoreFromStoreDefinition<TDefinition>;
}

/** Subscribes to an atom and returns its current value as an accessor. */
export function useAtom<T>(atom: BaseAtom<T>): Accessor<T>;
export function useAtom<TValue, TInput>(
  config: AtomConfig<TValue, TInput>,
  ...input: AtomConfigInput<TInput>
): Accessor<TValue>;
export function useAtom<T, S>(
  atom: BaseAtom<T>,
  selector: (value: T) => S,
  compare?: (a: S | undefined, b: S) => boolean
): Accessor<S>;
export function useAtom(
  definition: AnyAtom | AtomConfig<any, any>,
  selectorOrInput?: any,
  compare = defaultCompare
): Accessor<any> {
  return isAtom(definition)
    ? useSelector(
        definition,
        selectorOrInput ?? ((value: any) => value),
        compare
      )
    : useSelector(definition.createAtom(selectorOrInput), (value) => value);
}

/**
 * Creates or subscribes to an atom for the lifetime of a Solid owner.
 *
 * Pass an existing atom to receive `[accessor, atom]`, or pass an atom config
 * created with `createAtomConfig(...)` to create a local atom.
 */
export function useAtomState<TDefinition extends AtomDefinition>(
  ...[definition, input]: UseAtomStateArgs<TDefinition>
): AtomStateFromDefinition<TDefinition> {
  const atom = isAtom(definition) ? definition : definition.createAtom(input);
  const value = useAtom(atom);

  return [value, atom] as unknown as AtomStateFromDefinition<TDefinition>;
}
