import { Effect } from 'effect';
import {
  setup,
  type AnyActorRef,
  type AnySetupConfig,
  type EnqueueObject,
  type EventObject,
  type MachineContext,
  type SetupConfig,
  type SetupReturn,
  type SetupSchemas,
  type SetupStateSchema,
  type Sources,
  type SystemRuntime,
  type SystemRegistry
} from 'xstate';
import { runHostedEffect } from './internal.ts';
import { effectActionBrand } from './brands.ts';

export type EffectActionArgs<
  TContext extends MachineContext = MachineContext,
  TEvent extends EventObject = EventObject
> = {
  readonly context: TContext;
  readonly event: TEvent;
  readonly self: AnyActorRef;
  readonly parent: AnyActorRef | undefined;
  readonly children: Record<string, AnyActorRef | undefined>;
  readonly actions: Record<string, unknown>;
  readonly actors: Record<string, unknown>;
  readonly guards: Record<string, unknown>;
  readonly delays: Record<string, unknown>;
  readonly system: SystemRuntime<SystemRegistry>;
  readonly params?: unknown;
  readonly output?: unknown;
};

export type EffectAction<
  TContext extends MachineContext = MachineContext,
  TEvent extends EventObject = EventObject,
  TError = unknown,
  TRequirements = never
> = (
  args: EffectActionArgs<TContext, TEvent>,
  enq?: EnqueueObject<EventObject, EventObject>
) => Effect.Effect<void, TError, TRequirements>;

type AnyEffectAction = EffectAction<any, any, any, any>;

type EffectActionRequirements<TAction> = TAction extends (
  ...args: any[]
) => infer TResult
  ? TResult extends Effect.Effect<any, any, infer TRequirements>
    ? TRequirements
    : never
  : never;

type CoreEffectAction<TAction> = TAction extends (...args: infer TArgs) => any
  ? ((...args: TArgs) => void) & {
      readonly [effectActionBrand]: EffectActionRequirements<TAction>;
    }
  : never;

type CoreEffectActionMap<TActionMap> = {
  [K in keyof TActionMap]: CoreEffectAction<TActionMap[K]>;
};

type EffectSetupConfig<
  TSchemas extends SetupSchemas,
  TStates extends Record<string, SetupStateSchema>,
  TActionMap extends Record<string, AnyEffectAction>,
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays']
> = Omit<
  SetupConfig<
    TSchemas,
    TStates,
    CoreEffectActionMap<TActionMap>,
    TActorMap,
    TGuardMap,
    TDelayMap
  >,
  'actions'
> & {
  actions?: TActionMap & Record<string, AnyEffectAction>;
};

function wrapActions(
  actions: Record<string, AnyEffectAction> | undefined
): Record<string, (...args: any[]) => void | PromiseLike<void>> | undefined {
  if (!actions) {
    return undefined;
  }

  const wrapped: Record<string, (...args: any[]) => void | PromiseLike<void>> =
    {};
  for (const key of Object.keys(actions)) {
    const action = actions[key];
    wrapped[key] = (args, enq) => {
      const effect = action(args, enq);
      return runHostedEffect(args.self, effect);
    };
  }
  return wrapped;
}

function decorateEffectSetup(effectSetup: SetupReturn): SetupReturn {
  const extend = effectSetup.extend;
  const extendAny = extend as (extension: any) => SetupReturn;
  effectSetup.extend = ((extension: AnySetupConfig) =>
    decorateEffectSetup(
      extendAny({
        ...extension,
        actions: wrapActions(
          extension.actions as Record<string, AnyEffectAction> | undefined
        )
      })
    )) as typeof effectSetup.extend;
  return effectSetup;
}

export function setupEffect(): SetupReturn;
export function setupEffect<
  const TSchemas extends SetupSchemas = {},
  const TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >,
  TActionMap extends Record<string, AnyEffectAction> = {},
  TActorMap extends Sources['actors'] = {},
  TGuardMap extends Sources['guards'] = {},
  TDelayMap extends Sources['delays'] = {}
>(
  config: EffectSetupConfig<
    TSchemas,
    TStates,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
  >
): SetupReturn<
  TStates,
  TSchemas,
  CoreEffectActionMap<TActionMap>,
  TActorMap,
  TGuardMap,
  TDelayMap,
  Extract<keyof TDelayMap, string>,
  SystemRegistry
>;
export function setupEffect(config: AnySetupConfig = {}): SetupReturn {
  return decorateEffectSetup(
    setup({
      ...config,
      actions: wrapActions(
        config.actions as Record<string, AnyEffectAction> | undefined
      )
    } as AnySetupConfig) as SetupReturn
  );
}
