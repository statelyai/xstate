import type { Effect } from 'effect';
import type { StateMachine, Sources } from 'xstate';
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

type RequirementsFromActors<T> =
  T extends Record<string, infer TActor>
    ? TActor extends EffectLogicBrand<any, infer R>
      ? R
      : never
    : never;

export type RequirementsFrom<T> =
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
          any,
          infer TActionMap extends Sources['actions'],
          infer TActorMap extends Sources['actors'],
          any,
          any,
          any
        >
      ? RequirementsFromActions<TActionMap> | RequirementsFromActors<TActorMap>
      : never;

export type ErrorFrom<T> =
  T extends EffectLogicBrand<infer E, any> ? E : unknown;
