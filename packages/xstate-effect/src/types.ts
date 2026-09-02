import type { Effect } from 'effect';
import type { StateMachine } from 'xstate';
import type { EffectLogicBrand } from './fromEffect.ts';
import { effectActionBrand } from './brands.ts';

type RequirementsFromEffect<T> =
  T extends Effect.Effect<any, any, infer R> ? R : never;

type RequirementsFromActions<T> =
  T extends Record<string, (...args: any[]) => any>
    ? T[keyof T] extends infer TAction
      ? TAction extends {
          readonly [effectActionBrand]: infer R;
        }
        ? R
        : RequirementsFromEffect<
            TAction extends (...args: any[]) => infer R ? R : never
          >
      : never
    : never;

/**
 * Recursion budget for walking registered child machines. A machine cannot
 * contain itself as a registered actor type, but deeply nested machine trees
 * are capped at this depth to keep the conditional type finite.
 */
type MaxDepth = 10;

type PrevDepth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type Depth = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

type RequirementsFromActors<T, TDepth extends Depth> =
  T extends Record<string, any>
    ? // `T[keyof T]` is the union of every registered actor logic; the naked
      // type parameter in `RequirementsFrom` distributes over it, so mixed
      // maps (Effect logic + child machines + plain logic) all contribute.
      RequirementsFrom<T[keyof T], TDepth>
    : never;

/** `invoke` accepts a single config or an array of them. */
type InvokeEntry<TInvoke> = TInvoke extends readonly (infer U)[] ? U : TInvoke;

/**
 * Requirements of the logic passed inline as `invoke.src`. A string `src`
 * names an actor registered in `setup({ actors })`, whose requirements are
 * already collected from the actor map, so it contributes nothing here.
 */
type RequirementsFromInvoke<TInvoke, TDepth extends Depth> =
  InvokeEntry<TInvoke> extends infer TEntry
    ? TEntry extends { src: infer TSrc }
      ? TSrc extends string
        ? never
        : RequirementsFrom<TSrc, TDepth>
      : never
    : never;

/**
 * Walks the machine's literal config tree (the state schema) collecting
 * requirements from inline `invoke.src` logic at the root and in every
 * descendant state node.
 */
type RequirementsFromStateSchema<TSchema, TDepth extends Depth> =
  | (TSchema extends { invoke: infer TInvoke }
      ? RequirementsFromInvoke<TInvoke, TDepth>
      : never)
  | (TSchema extends { states: infer TStates }
      ? TStates extends Record<string, any>
        ? RequirementsFromStateSchema<TStates[keyof TStates], TDepth>
        : never
      : never);

/**
 * Collects the Effect service requirements of an actor logic.
 *
 * For Effect logic this is the logic's own `R`. For a state machine it is the
 * union of the requirements of its registered Effect actions, its registered
 * Effect actors, the Effect logic passed inline as `invoke.src` anywhere in
 * its state tree, and — recursively — the requirements of any child machine
 * reached either way (capped at {@link MaxDepth} levels of machine nesting).
 */
export type RequirementsFrom<T, TDepth extends Depth = MaxDepth> =
  T extends EffectLogicBrand<any, infer R>
    ? R
    : T extends StateMachine<
          any,
          any,
          any,
          any,
          any,
          any,
          any,
          any,
          any,
          infer TStateSchema,
          infer TActionMap,
          infer TActorMap,
          any,
          any,
          any
        >
      ?
          | RequirementsFromActions<TActionMap>
          | ([TDepth] extends [0]
              ? never
              :
                  | RequirementsFromActors<TActorMap, PrevDepth[TDepth]>
                  | RequirementsFromStateSchema<
                      TStateSchema,
                      PrevDepth[TDepth]
                    >)
      : never;

export type ErrorFrom<T> =
  T extends EffectLogicBrand<infer E, any> ? E : unknown;
