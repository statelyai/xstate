export * from '@xstate/store';

import { readonly, ref, toRaw, watch } from 'vue-demi';
import type { Ref } from 'vue-demi';
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
        value: Readonly<Ref<ValueFromAtomConfig<TDefinition>>>,
        atom: ReturnType<TDefinition['createAtom']>
      ]
    : TDefinition extends BaseAtom<infer TValue>
      ? readonly [value: Readonly<Ref<TValue>>, atom: TDefinition]
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

/** Creates a store instance for the current Vue setup scope. */
export function useStore<TDefinition extends StoreDefinition>(
  ...[definition, input]: UseStoreArgs<TDefinition>
): StoreFromStoreDefinition<TDefinition> {
  return (
    'createStore' in definition
      ? definition.createStore(input)
      : createStore(definition)
  ) as StoreFromStoreDefinition<TDefinition>;
}

/** Subscribes to an atom and returns its current value as a readonly ref. */
export function useAtom<T>(atom: BaseAtom<T>): Readonly<Ref<T>>;
export function useAtom<TValue, TInput>(
  config: AtomConfig<TValue, TInput>,
  ...input: AtomConfigInput<TInput>
): Readonly<Ref<TValue>>;
export function useAtom<T, S>(
  atom: BaseAtom<T>,
  selector: (value: T) => S,
  compare?: (a: S, b: S) => boolean
): Readonly<Ref<S>>;
export function useAtom(
  definition: AnyAtom | AtomConfig<any, any>,
  selectorOrInput?: any,
  compare = defaultCompare
): Readonly<Ref<any>> {
  return isAtom(definition)
    ? useSelector(
        definition,
        selectorOrInput ?? ((value: any) => value),
        compare
      )
    : useSelector(definition.createAtom(selectorOrInput));
}

/**
 * Creates or subscribes to an atom for the lifetime of a Vue setup scope.
 *
 * Pass an existing atom to receive `[valueRef, atom]`, or pass an atom config
 * created with `createAtomConfig(...)` to create a local atom.
 */
export function useAtomState<TDefinition extends AtomDefinition>(
  ...[definition, input]: UseAtomStateArgs<TDefinition>
): AtomStateFromDefinition<TDefinition> {
  const atom = isAtom(definition) ? definition : definition.createAtom(input);
  const value = useAtom(atom);

  return [value, atom] as unknown as AtomStateFromDefinition<TDefinition>;
}
