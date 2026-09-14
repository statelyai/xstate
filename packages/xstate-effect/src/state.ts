import type {
  AnyMachineSnapshot,
  AnyStateMachine,
  MachineContext,
  MachineSnapshot,
  SnapshotFrom,
  StateContextFromStateValue,
  StateSchema,
  StateValue,
  StateValueFromStateSchema
} from 'xstate';

type IsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;

type Join<TPrefix extends string, TKey extends string> = TPrefix extends ''
  ? TKey
  : `${TPrefix}.${TKey}`;

/** The tag of the machine itself, used when the root state is parallel. */
export const MACHINE_TAG = '(machine)';

/**
 * The dotted path of a state value: `'idle'`, `'form.editing'`. A parallel
 * state has no single path, so its tag stops at the parallel state, or is
 * `'(machine)'` when the machine itself is parallel.
 */
export type StateTag<
  TValue,
  TPrefix extends string = ''
> = string extends TValue
  ? string
  : TValue extends string
    ? Join<TPrefix, TValue>
    : TValue extends object
      ? string extends keyof TValue
        ? string
        : IsUnion<keyof TValue & string> extends true
          ? TPrefix extends ''
            ? typeof MACHINE_TAG
            : TPrefix
          : {
              [K in keyof TValue & string]: StateTag<
                TValue[K],
                Join<TPrefix, K>
              >;
            }[keyof TValue & string]
      : never;

type TaggedStateOf<
  TSnapshot,
  TValue,
  TContext extends MachineContext,
  TSchema extends StateSchema
> = TValue extends unknown
  ? {
      readonly _tag: StateTag<TValue>;
      readonly value: TValue;
      readonly context: StateContextFromStateValue<TSchema, TContext, TValue>;
      readonly snapshot: TSnapshot;
    }
  : never;

/**
 * A machine snapshot as a tagged union over its states. `_tag` is the state's
 * dotted path and `context` is the context of that state, including any
 * per-state context schema, so `Match.tag` narrows both.
 */
export type TaggedStateFrom<TSnapshot> =
  TSnapshot extends MachineSnapshot<
    infer TContext,
    infer _TEvent,
    infer _TChildren,
    infer _TStateValue,
    infer _TTag,
    infer _TOutput,
    infer _TMeta,
    infer TSchema
  >
    ? TaggedStateOf<
        TSnapshot,
        StateValueFromStateSchema<TSchema>,
        TContext,
        TSchema
      >
    : never;

/** The tagged state union of a machine. */
export type TaggedState<TMachine extends AnyStateMachine> = TaggedStateFrom<
  SnapshotFrom<TMachine>
>;

/** Computes the dotted path tag of a state value. */
export function stateTag(value: StateValue, prefix = ''): string {
  if (typeof value === 'string') {
    return prefix ? `${prefix}.${value}` : value;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return prefix || MACHINE_TAG;
  }
  const key = keys[0]!;
  return stateTag(value[key]!, prefix ? `${prefix}.${key}` : key);
}

/**
 * Views a machine snapshot as a tagged union member for `Match.tag`,
 * `Match.tags` or a `switch` on `_tag`.
 *
 * @example
 *
 * ```ts
 * const view = Match.type<TaggedStateFrom<typeof snapshot>>().pipe(
 *   Match.tag('loading', ({ context }) => `Loading ${context.id}`),
 *   Match.tag('done', () => 'Done'),
 *   Match.exhaustive
 * );
 * view(taggedState(snapshot));
 * ```
 */
export function taggedState<TSnapshot extends AnyMachineSnapshot>(
  snapshot: TSnapshot
): TaggedStateFrom<TSnapshot> {
  return {
    _tag: stateTag(snapshot.value),
    value: snapshot.value,
    context: snapshot.context,
    snapshot
  } as unknown as TaggedStateFrom<TSnapshot>;
}
