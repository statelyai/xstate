import { Effect } from 'effect';
import {
  setup,
  type ActorLogicValidator,
  type AnyStateMachine,
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
  type SystemRegistry,
  type SystemRuntime
} from 'xstate';
import { effectActionBrand } from './brands.ts';
import { runHostedEffect } from './internal.ts';
import type { EffectRequirements } from './types.ts';
import {
  toStandardSetupSchemas,
  toStandardSetupStates,
  type EffectSetupSchemas,
  type EffectSetupStateSchema,
  type ToStandardSetupSchemas,
  type ToStandardSetupStates,
  type ValidateEffectSetupSchemas,
  type ValidateEffectSetupStates
} from './schema.ts';

/**
 * Argument an Effect action receives. It mirrors the v6 action argument
 * object: the machine's `context` and the `event` that caused the transition,
 * the actor itself and its family (`self`, `parent`, `children`), the
 * registered `actions`, `actors`, `guards` and `delays`, the actor `system`,
 * and the `params` and `output` the transition passed along.
 */
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

/**
 * An action registered with `setupEffect({ actions })`. It is called
 * synchronously during the transition with the arguments the transition
 * enqueued, and returns an Effect that runs afterwards in the actor's Effect
 * context. The Effect is interrupted when the actor stops; its failures and
 * defects route to the state's `onError`. The optional second parameter is the
 * transition's enqueue object, typed with the base `EventObject`.
 */
export type EffectAction<
  TContext extends MachineContext = MachineContext,
  TEvent extends EventObject = EventObject,
  TError = unknown,
  TRequirements = never
> = (
  args: EffectActionArgs<TContext, TEvent>,
  enq?: EnqueueObject<any, any>
) => Effect.Effect<void, TError, TRequirements>;

type AnyEffectAction = EffectAction<any, any, any, any>;

type EffectActionRequirements<TAction> = TAction extends (
  ...args: any[]
) => infer TResult
  ? EffectRequirements<TResult>
  : never;

type CoreEffectAction<TAction> = TAction extends (...args: infer TArgs) => any
  ? ((...args: TArgs) => void) & {
      readonly [effectActionBrand]?: EffectActionRequirements<TAction>;
    }
  : never;

type CoreEffectActionMap<TActionMap> = {
  [K in keyof TActionMap]: CoreEffectAction<TActionMap[K]>;
};

type EffectSetupConfig<
  TSchemas extends EffectSetupSchemas,
  TStates extends Record<string, EffectSetupStateSchema>,
  TActionMap extends Record<string, AnyEffectAction>,
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TValidator extends ActorLogicValidator | undefined,
  TSourceSchemas extends SetupSchemas = ToStandardSetupSchemas<TSchemas>
> = {
  validator?: TValidator;
  actions?: TActionMap & Record<string, AnyEffectAction>;
  actors?: TActorMap;
  guards?: NonNullable<
    SetupConfig<
      TSourceSchemas,
      ToStandardSetupStates<TStates>,
      CoreEffectActionMap<TActionMap>,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TValidator
    >['guards']
  >;
  delays?: NonNullable<
    SetupConfig<
      TSourceSchemas,
      ToStandardSetupStates<TStates>,
      CoreEffectActionMap<TActionMap>,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TValidator
    >['delays']
  >;
  schemas?: TSchemas &
    ([TValidator] extends [ActorLogicValidator]
      ? ValidateEffectSetupSchemas<TSchemas>
      : unknown);
  states?: TStates &
    ([TValidator] extends [ActorLogicValidator]
      ? ValidateEffectSetupStates<TStates>
      : unknown);
};

type MergeRecord<TBase, TExtension> = Omit<TBase, keyof TExtension> &
  TExtension;

type MergeSetupSchemas<
  TBaseSchemas extends SetupSchemas,
  TExtensionSchemas extends SetupSchemas
> = {
  [K in keyof TBaseSchemas | keyof TExtensionSchemas]: K extends
    | 'events'
    | 'internalEvents'
    | 'emitted'
    | 'children'
    | 'actions'
    | 'guards'
    ? MergeRecord<
        K extends keyof TBaseSchemas ? NonNullable<TBaseSchemas[K]> : {},
        K extends keyof TExtensionSchemas
          ? NonNullable<TExtensionSchemas[K]>
          : {}
      >
    : K extends keyof TExtensionSchemas
      ? TExtensionSchemas[K]
      : K extends keyof TBaseSchemas
        ? TBaseSchemas[K]
        : never;
} extends infer TMergedSchemas extends SetupSchemas
  ? TMergedSchemas
  : never;

interface RuntimeValidationDoesNotSupportTransformingSchemas {
  readonly __xstate_effect_error: 'Runtime validation does not support schemas with different encoded and decoded types';
}

type RuntimeValidationCompatibility<TSchemas, TStates, TValidator> = [
  TValidator
] extends [ActorLogicValidator]
  ? [TSchemas] extends [ValidateEffectSetupSchemas<TSchemas>]
    ? [TStates] extends [ValidateEffectSetupStates<TStates>]
      ? unknown
      : RuntimeValidationDoesNotSupportTransformingSchemas
    : RuntimeValidationDoesNotSupportTransformingSchemas
  : unknown;

declare const inheritedEffectValidator: unique symbol;
type InheritedEffectValidator = typeof inheritedEffectValidator;

type ResolveExtendedValidator<TBase, TExtension> = [TExtension] extends [
  InheritedEffectValidator
]
  ? TBase
  : Exclude<TExtension, InheritedEffectValidator>;

type ExtendValidatorConfig<TExtension> = [TExtension] extends [
  InheritedEffectValidator
]
  ? { validator?: never }
  : { validator: TExtension };

type EffectSetupExtensionConfig<
  TBaseSchemas extends SetupSchemas,
  TBaseStates extends Record<string, SetupStateSchema>,
  TBaseValidator extends ActorLogicValidator | undefined,
  TExtensionSchemas extends EffectSetupSchemas,
  TExtensionStates extends Record<string, EffectSetupStateSchema>,
  TExtensionActionMap extends Record<string, AnyEffectAction>,
  TExtensionActorMap extends Sources['actors'],
  TExtensionGuardMap extends Sources['guards'],
  TExtensionDelayMap extends Sources['delays'],
  TExtensionValidator extends
    | ActorLogicValidator
    | undefined
    | InheritedEffectValidator
> = EffectSetupConfig<
  TExtensionSchemas,
  TExtensionStates,
  TExtensionActionMap,
  TExtensionActorMap,
  TExtensionGuardMap,
  TExtensionDelayMap,
  ResolveExtendedValidator<TBaseValidator, TExtensionValidator>,
  MergeSetupSchemas<TBaseSchemas, ToStandardSetupSchemas<TExtensionSchemas>>
> &
  ExtendValidatorConfig<TExtensionValidator> &
  RuntimeValidationCompatibility<
    NoInfer<TBaseSchemas>,
    NoInfer<TBaseStates>,
    ResolveExtendedValidator<TBaseValidator, TExtensionValidator>
  >;

/**
 * What `setupEffect` returns: the XState `SetupReturn` with an `extend` method
 * that also accepts Effect schemas and Effect-returning actions. Call
 * `createMachine` on it to build a machine whose registered actions and actors
 * contribute to `RequirementsFrom`.
 */
export type EffectSetupReturn<
  TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >,
  TSchemas extends SetupSchemas = {},
  TSetupActionMap extends Sources['actions'] = {},
  TSetupActorMap extends Sources['actors'] = {},
  TSetupGuardMap extends Sources['guards'] = {},
  TSetupDelayMap extends Sources['delays'] = {},
  TSetupDelays extends string = Extract<keyof TSetupDelayMap, string>,
  TValidator extends ActorLogicValidator | undefined = undefined
> = Omit<
  SetupReturn<
    TStates,
    TSchemas,
    TSetupActionMap,
    TSetupActorMap,
    TSetupGuardMap,
    TSetupDelayMap,
    TSetupDelays,
    SystemRegistry,
    TValidator
  >,
  'extend'
> & {
  extend<
    const TExtensionSchemas extends EffectSetupSchemas = {},
    const TExtensionStates extends Record<string, EffectSetupStateSchema> = {},
    TExtensionActionMap extends Record<string, AnyEffectAction> = {},
    TExtensionActorMap extends Sources['actors'] = {},
    TExtensionGuardMap extends Sources['guards'] = {},
    TExtensionDelayMap extends Sources['delays'] = {},
    const TExtensionValidator extends
      | ActorLogicValidator
      | undefined
      | InheritedEffectValidator = InheritedEffectValidator
  >(
    config: EffectSetupExtensionConfig<
      TSchemas,
      TStates,
      TValidator,
      TExtensionSchemas,
      TExtensionStates,
      TExtensionActionMap,
      TExtensionActorMap,
      TExtensionGuardMap,
      TExtensionDelayMap,
      TExtensionValidator
    >
  ): EffectSetupReturn<
    MergeRecord<TStates, ToStandardSetupStates<TExtensionStates>>,
    MergeSetupSchemas<TSchemas, ToStandardSetupSchemas<TExtensionSchemas>>,
    MergeRecord<TSetupActionMap, CoreEffectActionMap<TExtensionActionMap>>,
    MergeRecord<TSetupActorMap, TExtensionActorMap>,
    MergeRecord<TSetupGuardMap, TExtensionGuardMap>,
    MergeRecord<TSetupDelayMap, TExtensionDelayMap>,
    TSetupDelays | Extract<keyof TExtensionDelayMap, string>,
    ResolveExtendedValidator<TValidator, TExtensionValidator>
  >;
};

type AnyEffectSetupConfig = Omit<
  AnySetupConfig,
  'actions' | 'schemas' | 'states'
> & {
  actions?: Record<string, AnyEffectAction>;
  schemas?: EffectSetupSchemas;
  states?: Record<string, EffectSetupStateSchema>;
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
      const result = action(args, enq);
      return Effect.isEffect(result)
        ? runHostedEffect(
            args.self,
            result as Effect.Effect<void, unknown>,
            `action.${key}`
          )
        : (result as void | PromiseLike<void>);
    };
  }
  return wrapped;
}

/**
 * Makes `machine.provide` host Effect-returning action overrides the same way
 * `setupEffect` hosts declared actions.
 */
function decorateMachine<TMachine extends AnyStateMachine>(
  machine: TMachine
): TMachine {
  const provide = machine.provide.bind(machine) as (
    sources: Record<string, unknown>
  ) => AnyStateMachine;
  machine.provide = ((sources: Record<string, unknown>) =>
    decorateMachine(
      provide({
        ...sources,
        actions: wrapActions(
          sources.actions as Record<string, AnyEffectAction> | undefined
        )
      })
    )) as TMachine['provide'];
  return machine;
}

function decorateEffectSetup(effectSetup: SetupReturn): SetupReturn {
  const createMachine = effectSetup.createMachine.bind(effectSetup) as (
    config: unknown
  ) => AnyStateMachine;
  effectSetup.createMachine = ((config: unknown) =>
    decorateMachine(createMachine(config))) as typeof effectSetup.createMachine;
  const extend = effectSetup.extend;
  const extendAny = extend as (extension: any) => SetupReturn;
  effectSetup.extend = ((extension: AnySetupConfig) =>
    decorateEffectSetup(
      extendAny({
        ...extension,
        schemas: toStandardSetupSchemas(extension.schemas),
        states: toStandardSetupStates(extension.states),
        actions: wrapActions(
          extension.actions as Record<string, AnyEffectAction> | undefined
        )
      })
    )) as typeof effectSetup.extend;
  return effectSetup;
}

/**
 * The Effect-aware form of XState's `setup`. It accepts Effect `Schema` values
 * wherever `setup` accepts Standard Schemas, and actions that return an
 * Effect, which it wraps so the transition stays synchronous while the Effect
 * runs in the actor's Effect context. Everything else, including `actors`,
 * `guards`, `delays` and `extend`, behaves as in `setup`. Machines built from
 * it must be started with `createEffectActor`.
 */
export function setupEffect(): EffectSetupReturn;
export function setupEffect<
  const TSchemas extends EffectSetupSchemas = {},
  const TStates extends Record<string, EffectSetupStateSchema> = Record<
    string,
    EffectSetupStateSchema
  >,
  TActionMap extends Record<string, AnyEffectAction> = {},
  TActorMap extends Sources['actors'] = {},
  TGuardMap extends Sources['guards'] = {},
  TDelayMap extends Sources['delays'] = {},
  const TValidator extends ActorLogicValidator | undefined = undefined
>(
  config: EffectSetupConfig<
    TSchemas,
    TStates,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TValidator
  >
): EffectSetupReturn<
  ToStandardSetupStates<TStates>,
  ToStandardSetupSchemas<TSchemas>,
  CoreEffectActionMap<TActionMap>,
  TActorMap,
  TGuardMap,
  TDelayMap,
  Extract<keyof TDelayMap, string>,
  TValidator
>;
export function setupEffect(
  config: AnyEffectSetupConfig = {}
): EffectSetupReturn {
  return decorateEffectSetup(
    setup({
      ...config,
      schemas: toStandardSetupSchemas(config.schemas),
      states: toStandardSetupStates(config.states),
      actions: wrapActions(config.actions)
    } as AnySetupConfig) as SetupReturn
  ) as EffectSetupReturn;
}
