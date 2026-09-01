import { SetupStateSchemas, StandardSchemaV1 } from './schema.types.ts';
import type { ActorLogicValidator } from './validation.types.ts';
import { StateMachine } from './StateMachine.ts';
import {
  createActor as createActorFromLogic,
  type Actor,
  type RequiredActorOptionsKeys
} from './createActor.ts';
import {
  AnyActorRef,
  AnyActorLogic,
  ActorRefFromLogic,
  AnyStateNode,
  EventObject,
  AnyEventObject,
  EventDescriptor,
  ExtractEvent,
  MachineContext,
  ProvidedActor,
  RoutableStateId,
  StateSchema,
  StateValue,
  StateValueFromStateSchema,
  ToChildren,
  MetaObject,
  Cast,
  Compute,
  EnqueueObject,
  DoneActorEvent,
  DoneStateEvent,
  ErrorActorEvent,
  SystemRegistry,
  RegistryKeyForLogic,
  ActorOptions,
  Observer,
  Subscription,
  OutputArg,
  SnapshotEvent,
  SingleOrArray,
  AfterEvent,
  TimeoutEvent,
  ErrorEvent
} from './types.ts';
import { AnyActorSystem } from './system.ts';
import { InspectionEvent } from './inspection.ts';
import {
  ActionSchemas,
  DelayMapFromNames,
  DelaySourceMap,
  GuardSourceMap,
  GuardSchemas,
  InferChildren,
  InferActions,
  InferGuards,
  Sources,
  InferOutput,
  InferEvents,
  InferInternalEvents,
  Next_MachineConfig,
  Next_InvokeConfig,
  Next_StateNodeConfig,
  Next_TransitionConfigOrTarget,
  OutputFromConfig,
  ValidateHistoryDefaults,
  ValidateStateTargets,
  WithDefault
} from './types.v6.ts';

export type SetupConfig<
  TSchemas extends SetupSchemas,
  TStates extends Record<string, SetupStateSchema>,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TValidator extends ActorLogicValidator | undefined =
    | ActorLogicValidator
    | undefined
> = {
  validator?: TValidator;
  schemas?: TSchemas;
  states?: TStates;
  actions?: TActionMap;
  actors?: TActorMap;
  guards?: TGuardMap & SetupGuardSources<NoInfer<TSchemas>>;
  delays?: TDelayMap & SetupDelaySources<NoInfer<TSchemas>>;
};

/**
 * Contextual types for guard/delay source maps passed to `setup()`, derived
 * from the same call's `schemas` (context/events). These intersect the
 * inferred source-map type parameters so inline functions get typed args
 * without hand-annotating.
 */
type SetupGuardSources<TSchemas> = GuardSourceMap<
  SetupContext<TSchemas, StandardSchemaV1>,
  SetupEvents<TSchemas, Record<string, StandardSchemaV1>>
>;

type SetupDelaySources<TSchemas> = DelaySourceMap<
  SetupContext<TSchemas, StandardSchemaV1>,
  SetupEvents<TSchemas, Record<string, StandardSchemaV1>>
>;

/**
 * Contextual companion for the whole-config `setup()` overload: gives inline
 * `guards`/`delays` functions typed args from the config's own `schemas`.
 */
type SetupSourceCompanions<TSchemas> = {
  guards?: SetupGuardSources<TSchemas>;
  delays?: SetupDelaySources<TSchemas>;
};

type MergeRecord<TBase, TExtend> = Omit<TBase, keyof TExtend> & TExtend;

/**
 * Mirrors the runtime `mergeSchemas`: scalar schema keys (`context`, `input`,
 * ...) are overridden whole, while map-valued keys (`events`, `emitted`,
 * `children`, `actions`, `guards`) are merged entry-by-entry with extension
 * entries winning, so base-declared entries stay visible to extension sources.
 */
type MergedSetupSchemas<TBaseSchemas, TExtendSchemas> = {
  [K in keyof TBaseSchemas | keyof TExtendSchemas]: K extends
    | 'events'
    | 'emitted'
    | 'children'
    | 'actions'
    | 'guards'
    ? MergeRecord<
        K extends keyof TBaseSchemas ? NonNullable<TBaseSchemas[K]> : {},
        K extends keyof TExtendSchemas ? NonNullable<TExtendSchemas[K]> : {}
      >
    : K extends keyof TExtendSchemas
      ? TExtendSchemas[K]
      : K extends keyof TBaseSchemas
        ? TBaseSchemas[K]
        : never;
};

export type AnySetupConfig = SetupConfig<
  SetupSchemas,
  Record<string, SetupStateSchema>,
  Sources['actions'],
  Sources['actors'],
  Sources['guards'],
  Sources['delays'],
  ActorLogicValidator | undefined
>;

interface RuntimeValidationDoesNotSupportTransformingSchemas {
  readonly __xstate_error: 'Runtime validation does not support schemas with different input and output types';
}

type IsAny<T> = 0 extends 1 & T ? true : false;

type AssertNonTransformingSchema<TSchema extends StandardSchemaV1> =
  IsAny<StandardSchemaV1.InferInput<TSchema>> extends true
    ? TSchema
    : IsAny<StandardSchemaV1.InferOutput<TSchema>> extends true
      ? TSchema
      : [
            StandardSchemaV1.InferInput<TSchema>,
            StandardSchemaV1.InferOutput<TSchema>
          ] extends [
            StandardSchemaV1.InferOutput<TSchema>,
            StandardSchemaV1.InferInput<TSchema>
          ]
        ? TSchema
        : RuntimeValidationDoesNotSupportTransformingSchemas;

type ValidateSchemaMap<TMap> =
  TMap extends Record<string, StandardSchemaV1>
    ? {
        [K in keyof TMap]: TMap[K] extends StandardSchemaV1
          ? AssertNonTransformingSchema<TMap[K]>
          : TMap[K];
      }
    : TMap;

type ValidateSetupSchemas<TSchemas> = TSchemas extends SetupSchemas
  ? {
      [K in keyof TSchemas]: K extends
        | 'events'
        | 'internalEvents'
        | 'emitted'
        | 'children'
        ? ValidateSchemaMap<TSchemas[K]>
        : K extends 'context' | 'input' | 'output'
          ? TSchemas[K] extends StandardSchemaV1
            ? AssertNonTransformingSchema<TSchemas[K]>
            : TSchemas[K]
          : TSchemas[K];
    }
  : TSchemas;

type ValidateSetupStates<TStates> =
  TStates extends Record<string, SetupStateSchema>
    ? {
        [K in keyof TStates]: TStates[K] extends SetupStateSchema
          ? Omit<TStates[K], 'schemas' | 'states'> & {
              schemas?: TStates[K]['schemas'] extends SetupStateSchemas
                ? {
                    [P in keyof TStates[K]['schemas']]: TStates[K]['schemas'][P] extends StandardSchemaV1
                      ? AssertNonTransformingSchema<TStates[K]['schemas'][P]>
                      : TStates[K]['schemas'][P];
                  }
                : TStates[K]['schemas'];
              states?: TStates[K]['states'] extends Record<
                string,
                SetupStateSchema
              >
                ? ValidateSetupStates<TStates[K]['states']>
                : TStates[K]['states'];
            }
          : TStates[K];
      }
    : TStates;

type RuntimeValidationConstraint<TSchemas, TStates, TValidator> = [
  TValidator
] extends [ActorLogicValidator]
  ? {
      schemas?: ValidateSetupSchemas<TSchemas>;
      states?: ValidateSetupStates<TStates>;
    }
  : unknown;

type RuntimeValidationCompatibility<TSchemas, TStates, TValidator> = [
  TValidator
] extends [ActorLogicValidator]
  ? [TSchemas] extends [ValidateSetupSchemas<TSchemas>]
    ? [TStates] extends [ValidateSetupStates<TStates>]
      ? unknown
      : RuntimeValidationDoesNotSupportTransformingSchemas
    : RuntimeValidationDoesNotSupportTransformingSchemas
  : unknown;

declare const inheritedValidator: unique symbol;
type InheritedValidator = typeof inheritedValidator;

type ResolveExtendedValidator<TBase, TExtension> = [TExtension] extends [
  InheritedValidator
]
  ? TBase
  : Exclude<TExtension, InheritedValidator>;

type ExtendValidatorConfig<TExtension> = [TExtension] extends [
  InheritedValidator
]
  ? { validator?: never }
  : { validator: TExtension };

type SetupExtensionConfig<
  TBaseSchemas,
  TBaseStates,
  TBaseValidator,
  TExtendSchemas extends SetupSchemas,
  TExtendStates extends Record<string, SetupStateSchema>,
  TExtendActionMap extends Sources['actions'],
  TExtendActorMap extends Sources['actors'],
  TExtendGuardMap extends Sources['guards'],
  TExtendDelayMap extends Sources['delays'],
  TExtendValidator extends ActorLogicValidator | undefined | InheritedValidator
> = Omit<
  SetupConfig<
    TExtendSchemas,
    TExtendStates,
    TExtendActionMap,
    TExtendActorMap,
    TExtendGuardMap,
    TExtendDelayMap
  >,
  'validator' | 'guards' | 'delays'
> & {
  guards?: TExtendGuardMap &
    SetupGuardSources<
      NoInfer<MergedSetupSchemas<TBaseSchemas, TExtendSchemas>>
    >;
  delays?: TExtendDelayMap &
    SetupDelaySources<
      NoInfer<MergedSetupSchemas<TBaseSchemas, TExtendSchemas>>
    >;
} & ExtendValidatorConfig<TExtendValidator> &
  RuntimeValidationCompatibility<
    NoInfer<TBaseSchemas>,
    NoInfer<TBaseStates>,
    ResolveExtendedValidator<TBaseValidator, TExtendValidator>
  > &
  RuntimeValidationConstraint<
    NoInfer<TExtendSchemas>,
    NoInfer<TExtendStates>,
    ResolveExtendedValidator<TBaseValidator, TExtendValidator>
  >;

type InlineMachineSchemas<
  TContextSchema,
  TEventSchemaMap,
  TInternalEventSchemaMap,
  TEmittedSchemaMap,
  TActionSchemaMap,
  TGuardSchemaMap,
  TInputSchema,
  TOutputSchema,
  TMetaSchema,
  TTagSchema,
  TChildrenSchemaMap
> = {
  context?: TContextSchema;
  events?: TEventSchemaMap;
  internalEvents?: TInternalEventSchemaMap;
  emitted?: TEmittedSchemaMap;
  actions?: TActionSchemaMap;
  guards?: TGuardSchemaMap;
  input?: TInputSchema;
  output?: TOutputSchema;
  meta?: TMetaSchema;
  tags?: TTagSchema;
  children?: TChildrenSchemaMap;
};

type MachineConfigStates<TConfig> = TConfig extends {
  states?: infer TStates;
}
  ? TStates
  : {};

type MachineConfigSchemas<TConfig> = TConfig extends {
  schemas?: infer TSchemas;
}
  ? TSchemas
  : {};

export type SystemConfig<TSystemRegistry extends SystemRegistry> = {
  registry?: TSystemRegistry;
};

export type SystemActorMap<TSystemRegistry extends SystemRegistry> = {
  [K in keyof TSystemRegistry & string]: ActorRefFromLogic<TSystemRegistry[K]>;
};

type MachineIdentity<TConfig> = {
  readonly id: TConfig extends { id: infer TId extends string }
    ? TId
    : '(machine)';
  readonly version: TConfig extends { version: infer TVersion extends string }
    ? TVersion
    : undefined;
};

export type SystemRuntime<TSystemRegistry extends SystemRegistry> = Omit<
  AnyActorSystem,
  'get' | 'getAll'
> & {
  get<K extends keyof SystemActorMap<TSystemRegistry> & string>(
    key: K
  ): SystemActorMap<TSystemRegistry>[K] | undefined;
  getAll(): Partial<SystemActorMap<TSystemRegistry>>;
};

type LogicMatchesRegistryKey<TLogic, TSystemLogic> =
  TLogic extends AnyActorLogic
    ? TSystemLogic extends AnyActorLogic
      ? [TLogic] extends [TSystemLogic]
        ? true
        : [TSystemLogic] extends [TLogic]
          ? true
          : ActorRefFromLogic<TLogic> extends ActorRefFromLogic<TSystemLogic>
            ? true
            : false
      : false
    : false;

type RegistryKeyMatchesSrc<
  TKey extends string,
  TSrc,
  TSystemRegistry extends SystemRegistry,
  TActorMap extends Sources['actors']
> = TKey extends keyof TSystemRegistry & string
  ? TSrc extends keyof TActorMap & string
    ? LogicMatchesRegistryKey<TActorMap[TSrc], TSystemRegistry[TKey]>
    : TSrc extends AnyActorLogic
      ? LogicMatchesRegistryKey<TSrc, TSystemRegistry[TKey]>
      : true
  : false;

type ValidateSystemInvoke<
  TInvoke,
  TSystemRegistry extends SystemRegistry,
  TActorMap extends Sources['actors']
> = TInvoke extends readonly unknown[]
  ? {
      [K in keyof TInvoke]: TInvoke[K] &
        ValidateSystemInvoke<TInvoke[K], TSystemRegistry, TActorMap>;
    }
  : TInvoke extends { registryKey: infer TKey }
    ? TKey extends string
      ? TInvoke extends { src: infer TSrc }
        ? RegistryKeyMatchesSrc<
            TKey,
            TSrc,
            TSystemRegistry,
            TActorMap
          > extends true
          ? unknown
          : { registryKey: never }
        : TKey extends keyof TSystemRegistry & string
          ? unknown
          : { registryKey: never }
      : { registryKey: never }
    : unknown;

type ValidateRegistryKeys<
  TConfig,
  TSystemRegistry extends SystemRegistry,
  TActorMap extends Sources['actors']
> = string extends keyof TSystemRegistry
  ? unknown
  : (TConfig extends { invoke: infer TInvoke }
      ? {
          invoke: TInvoke &
            ValidateSystemInvoke<TInvoke, TSystemRegistry, TActorMap>;
        }
      : unknown) &
      (TConfig extends { states: infer TStates }
        ? {
            states: {
              [K in keyof TStates]: TStates[K] &
                ValidateRegistryKeys<TStates[K], TSystemRegistry, TActorMap>;
            };
          }
        : unknown);

export type { SetupStateSchemas };

/** State node types that can be declared in a setup state contract. */
export type SetupStateType =
  | 'atomic'
  | 'compound'
  | 'parallel'
  | 'final'
  | 'history'
  | 'choice';

export type SetupSchemas = {
  context?: StandardSchemaV1;
  events?: Record<string, StandardSchemaV1>;
  internalEvents?: Record<string, StandardSchemaV1>;
  actions?: ActionSchemas;
  guards?: GuardSchemas;
  emitted?: Record<string, StandardSchemaV1>;
  input?: StandardSchemaV1;
  output?: StandardSchemaV1;
  meta?: StandardSchemaV1;
  tags?: StandardSchemaV1;
  children?: Record<string, StandardSchemaV1>;
};

/**
 * State schema with optional input/output schemas, structural metadata, and
 * nested states.
 *
 * Structural fields are contracts/defaults for `createMachine(...)`; machine
 * behavior remains authored in the machine config.
 */
export interface SetupStateSchema {
  type?: SetupStateType;
  id?: string;
  initial?: string;
  history?: 'shallow' | 'deep' | true;
  target?: string | readonly [string, ...string[]];
  route?: true;
  schemas?: SetupStateSchemas;
  states?: Record<string, SetupStateSchema>;
}

type SetupSchema<
  TSchemas,
  TKey extends keyof SetupSchemas
> = TKey extends keyof TSchemas
  ? TSchemas[TKey] extends StandardSchemaV1
    ? TSchemas[TKey]
    : never
  : never;

type SetupSchemaMap<
  TSchemas,
  TKey extends 'events' | 'internalEvents' | 'emitted' | 'children'
> = TKey extends keyof TSchemas
  ? TSchemas[TKey] extends Record<string, StandardSchemaV1>
    ? TSchemas[TKey]
    : never
  : never;

type SetupActionSchemaMap<TSchemas> = 'actions' extends keyof TSchemas
  ? TSchemas['actions'] extends ActionSchemas
    ? TSchemas['actions']
    : never
  : never;

type SetupGuardSchemaMap<TSchemas> = 'guards' extends keyof TSchemas
  ? TSchemas['guards'] extends GuardSchemas
    ? TSchemas['guards']
    : never
  : never;

type SetupOrConfigSchema<
  TSchemas,
  TKey extends Exclude<
    keyof SetupSchemas,
    'events' | 'actions' | 'guards' | 'emitted' | 'children'
  >,
  TConfigSchema extends StandardSchemaV1
> = [SetupSchema<TSchemas, TKey>] extends [never]
  ? TConfigSchema
  : SetupSchema<TSchemas, TKey>;

type SetupOrConfigSchemaMap<
  TSchemas,
  TKey extends 'events' | 'internalEvents' | 'emitted' | 'children',
  TConfigSchemaMap extends Record<string, StandardSchemaV1>
> = [SetupSchemaMap<TSchemas, TKey>] extends [never]
  ? TConfigSchemaMap
  : SetupSchemaMap<TSchemas, TKey>;

type SetupStateKeys<TStateSchemas extends Record<string, SetupStateSchema>> =
  keyof TStateSchemas & string;

type HasExplicitSetupStateContracts<
  TStateSchemas extends Record<string, SetupStateSchema>
> = string extends keyof TStateSchemas
  ? false
  : [keyof TStateSchemas] extends [never]
    ? false
    : true;

type UncheckedSetupStateSchema = {
  schemas?: never;
  states?: never;
};

type UncheckedSetupStateSchemas = Record<string, UncheckedSetupStateSchema>;

type SetupStateKey<TStateSchemas extends Record<string, SetupStateSchema>> =
  string extends SetupStateKeys<TStateSchemas>
    ? string
    : [SetupStateKeys<TStateSchemas>] extends [never]
      ? string
      : SetupStateKeys<TStateSchemas>;

type StrictSetupStatePaths<
  TStateSchemas extends Record<string, SetupStateSchema>
> = [SetupStateKeys<TStateSchemas>] extends [never]
  ? never
  : StatePaths<TStateSchemas>;

type SetupRelativeStateTarget<
  TStateSchemas extends Record<string, SetupStateSchema>
> =
  string extends SetupStateKeys<TStateSchemas>
    ? `.${string}`
    : [SetupStateKeys<TStateSchemas>] extends [never]
      ? '.'
      : '.' | `.${StatePaths<TStateSchemas> & string}`;

type SetupStateTarget<TStateSchemas extends Record<string, SetupStateSchema>> =
  TStateSchemas extends { readonly [strictSetupStateTargets]: true }
    ?
        | StrictSetupStatePaths<TStateSchemas>
        | SetupRelativeStateTarget<RelativeSetupStateSchemas<TStateSchemas>>
        | `#${string}`
    : string extends SetupStateKeys<TStateSchemas>
      ? string
      : [SetupStateKeys<TStateSchemas>] extends [never]
        ? string
        : StatePaths<TStateSchemas> | `.${string}` | `#${string}`;

type KnownSetupStateTarget<
  TStateSchemas extends Record<string, SetupStateSchema>
> =
  string extends StatePaths<TStateSchemas>
    ? string extends StatePaths<RelativeSetupStateSchemas<TStateSchemas>>
      ? never
      :
          | SetupRelativeStateTarget<RelativeSetupStateSchemas<TStateSchemas>>
          | SetupStateIdTarget<
              SetupStateIds<RootSetupStateSchemas<TStateSchemas>>
            >
          | SetupStateIdTargets<RootSetupStateSchemas<TStateSchemas>>
    :
        | (StrictSetupStatePaths<TStateSchemas> & string)
        | SetupRelativeStateTarget<RelativeSetupStateSchemas<TStateSchemas>>
        | SetupStateIdTarget<
            SetupStateIds<RootSetupStateSchemas<TStateSchemas>>
          >
        | SetupStateIdTargets<RootSetupStateSchemas<TStateSchemas>>;

declare const strictSetupStateTargets: unique symbol;
declare const relativeSetupStateSchemas: unique symbol;
declare const rootSetupStateSchemas: unique symbol;
declare const currentSetupStateSchema: unique symbol;
declare const parentSetupStateType: unique symbol;

type StrictSetupStateSchemas<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TRelativeStateSchemas extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >,
  TRootStateSchemas extends Record<string, SetupStateSchema> =
    RootSetupStateSchemas<TStateSchemas>,
  TCurrentStateSchema extends SetupStateSchema = never
> = TStateSchemas & {
  readonly [strictSetupStateTargets]: true;
  readonly [relativeSetupStateSchemas]: TRelativeStateSchemas;
  readonly [rootSetupStateSchemas]: TRootStateSchemas;
  readonly [currentSetupStateSchema]: TCurrentStateSchema;
};

type RelativeSetupStateSchemas<
  TStateSchemas extends Record<string, SetupStateSchema>
> = TStateSchemas extends {
  readonly [relativeSetupStateSchemas]: infer TRelativeStateSchemas extends
    Record<string, SetupStateSchema>;
}
  ? TRelativeStateSchemas
  : TStateSchemas;

type RootSetupStateSchemas<
  TStateSchemas extends Record<string, SetupStateSchema>
> = TStateSchemas extends {
  readonly [rootSetupStateSchemas]: infer TRootStateSchemas extends Record<
    string,
    SetupStateSchema
  >;
}
  ? TRootStateSchemas
  : TStateSchemas;

type CurrentSetupStateSchema<
  TStateSchemas extends Record<string, SetupStateSchema>
> = TStateSchemas extends {
  readonly [currentSetupStateSchema]: infer TCurrentStateSchema extends
    SetupStateSchema;
}
  ? TCurrentStateSchema
  : never;

type SetupStateSelfSchema<TStateSchema extends SetupStateSchema> =
  TStateSchema extends { schemas: infer TSchemas extends SetupStateSchemas }
    ? { schemas: TSchemas }
    : {};

type SetupStateSchemasWithParentType<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TParentStateType extends SetupStateType | never
> = TStateSchemas & {
  readonly [parentSetupStateType]: TParentStateType;
};

type SetupStateParentType<
  TStateSchemas extends Record<string, SetupStateSchema>
> = TStateSchemas extends {
  readonly [parentSetupStateType]: infer TParentStateType;
}
  ? TParentStateType
  : never;

type IsParallelSetupStateParent<
  TStateSchemas extends Record<string, SetupStateSchema>
> = [SetupStateParentType<TStateSchemas>] extends [never]
  ? false
  : SetupStateParentType<TStateSchemas> extends 'parallel'
    ? true
    : false;

type ResolveStateSiblingsForPath<
  TStates extends Record<string, SetupStateSchema>,
  TPath extends string
> =
  SetupStateParentAtPath<TStates, TPath> extends infer TParent
    ? [TParent] extends [SetupStateSchema]
      ? SetupStateSchemasWithParentType<
          ResolveStateSiblings<TStates, TPath>,
          TParent extends { type: infer TType extends SetupStateType }
            ? TType
            : never
        >
      : ResolveStateSiblings<TStates, TPath>
    : never;

type WithRootSetupStateSchemas<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TRootStateSchemas extends Record<string, SetupStateSchema>
> = TStateSchemas & {
  readonly [rootSetupStateSchemas]: TRootStateSchemas;
};

type RootSetupStateTransitionSchemas<
  TStateSchemas extends Record<string, SetupStateSchema>
> = StrictSetupStateSchemas<{}, TStateSchemas, TStateSchemas>;

type RootSetupStateTarget<
  TStateSchemas extends Record<string, SetupStateSchema>
> =
  | SetupRelativeStateTarget<TStateSchemas>
  | RootSetupStateIdTarget<TStateSchemas>;

type RootSetupStateIdTarget<
  TStateSchemas extends Record<string, SetupStateSchema>
> =
  | SetupStateIdTarget<SetupStateIds<TStateSchemas>>
  | SetupStateIdTargets<TStateSchemas>;

type SetupStateTransitionChildSchemas<TStateSchema extends SetupStateSchema> =
  TStateSchema extends {
    states: infer TChildStateSchemas extends Record<string, SetupStateSchema>;
  }
    ? TChildStateSchemas
    : {};

type SetupStateTransitionSchemas<
  TSiblingStateSchemas extends Record<string, SetupStateSchema>,
  TStateSchema extends SetupStateSchema
> =
  IsParallelSetupStateParent<TSiblingStateSchemas> extends true
    ? StrictSetupStateSchemas<
        {},
        SetupStateTransitionChildSchemas<TStateSchema>,
        RootSetupStateSchemas<TSiblingStateSchemas>,
        SetupStateSelfSchema<TStateSchema>
      >
    : string extends SetupStateKeys<TSiblingStateSchemas>
      ? TSiblingStateSchemas
      : keyof SetupStateSchema extends keyof TStateSchema
        ? TSiblingStateSchemas
        : TStateSchema extends { states: Record<string, SetupStateSchema> }
          ? TStateSchema extends { type: SetupStateType }
            ? StrictSetupStateSchemas<
                TSiblingStateSchemas,
                SetupStateTransitionChildSchemas<TStateSchema>,
                RootSetupStateSchemas<TSiblingStateSchemas>,
                SetupStateSelfSchema<TStateSchema>
              >
            : TSiblingStateSchemas
          : StrictSetupStateSchemas<
              TSiblingStateSchemas,
              {},
              RootSetupStateSchemas<TSiblingStateSchemas>,
              SetupStateSelfSchema<TStateSchema>
            >;

type SetupStateChildSchemas<TStateSchema extends SetupStateSchema> =
  TStateSchema['states'] extends Record<string, SetupStateSchema>
    ? TStateSchema['states']
    : Record<string, SetupStateSchema>;

type SetupStateIds<TStateSchemas extends Record<string, SetupStateSchema>> =
  | {
      [K in keyof TStateSchemas & string]: TStateSchemas[K] extends {
        id: infer TId extends string;
      }
        ? TId
        : never;
    }[keyof TStateSchemas & string]
  | {
      [K in keyof TStateSchemas &
        string]: TStateSchemas[K]['states'] extends Record<
        string,
        SetupStateSchema
      >
        ? SetupStateIds<TStateSchemas[K]['states']>
        : never;
    }[keyof TStateSchemas & string];

type SetupStateIdTarget<TId extends string> =
  `#${EscapeSetupStatePathDots<TId>}`;

type SetupStateIdTargets<
  TStateSchemas extends Record<string, SetupStateSchema>
> =
  string extends SetupStateKeys<TStateSchemas>
    ? never
    :
        | {
            [K in keyof TStateSchemas & string]: TStateSchemas[K] extends {
              id: infer TId extends string;
            }
              ? TStateSchemas[K]['states'] extends infer TChildStateSchemas extends
                  Record<string, SetupStateSchema>
                ? string extends SetupStateKeys<TChildStateSchemas>
                  ? never
                  : `${SetupStateIdTarget<TId>}.${StatePaths<TChildStateSchemas> & string}`
                : never
              : never;
          }[keyof TStateSchemas & string]
        | {
            [K in keyof TStateSchemas &
              string]: TStateSchemas[K]['states'] extends infer TChildStateSchemas extends
              Record<string, SetupStateSchema>
              ? SetupStateIdTargets<TChildStateSchemas>
              : never;
          }[keyof TStateSchemas & string];

type SetupStateSchemaAtTarget<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TTarget extends string
> = (
  TTarget extends '.'
    ? CurrentSetupStateSchema<TStateSchemas>
    : TTarget extends `.${infer TPath}`
      ? ResolveStatePath<RelativeSetupStateSchemas<TStateSchemas>, TPath>
      : TTarget extends `#${string}`
        ? SetupStateSchemaAtIdTarget<
            RootSetupStateSchemas<TStateSchemas>,
            TTarget
          >
        : ResolveStatePath<TStateSchemas, TTarget>
) extends infer TStateSchema
  ? TStateSchema extends SetupStateSchema
    ? TStateSchema
    : never
  : never;

type SetupStateSchemaAtId<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TId extends string
> = {
  [K in keyof TStateSchemas & string]: TStateSchemas[K] extends {
    id: TId;
  }
    ? TStateSchemas[K]
    : TStateSchemas[K]['states'] extends Record<string, SetupStateSchema>
      ? SetupStateSchemaAtId<TStateSchemas[K]['states'], TId>
      : never;
}[keyof TStateSchemas & string];

type SetupStateSchemaAtIdTarget<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TTarget extends string
> = TTarget extends `#${infer TPath}`
  ? SplitSetupStatePath<TPath> extends [
      infer TId extends string,
      ...infer TDescendant extends string[]
    ]
    ? SetupStateSchemaAtId<TStateSchemas, TId> extends infer TStateSchema
      ? TDescendant extends []
        ? TStateSchema
        : TStateSchema extends {
              states: infer TChildStateSchemas extends Record<
                string,
                SetupStateSchema
              >;
            }
          ? ResolveStatePathSegments<TChildStateSchemas, TDescendant>
          : never
      : never
    : never
  : never;

type StateSchemasWithKeys<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TStateKeys extends string
> = TStateSchemas & {
  [K in Exclude<TStateKeys, keyof TStateSchemas>]: {};
};

type EscapeSetupStatePathDots<TValue extends string> =
  TValue extends `${infer THead}.${infer TTail}`
    ? `${THead}\\.${EscapeSetupStatePathDots<TTail>}`
    : TValue;

type ProtectSetupStatePathDots<TValue extends string> =
  TValue extends `${infer THead}\\.${infer TTail}`
    ? `${THead}__XSTATE_ESCAPED_DOT__${ProtectSetupStatePathDots<TTail>}`
    : TValue;

type RestoreSetupStatePathDots<TValue extends string> =
  TValue extends `${infer THead}__XSTATE_ESCAPED_DOT__${infer TTail}`
    ? `${THead}.${RestoreSetupStatePathDots<TTail>}`
    : TValue;

type SplitSetupStatePath<TPath extends string> =
  ProtectSetupStatePathDots<TPath> extends infer TProtected extends string
    ? TProtected extends ''
      ? []
      : TProtected extends `${infer THead}.${infer TTail}`
        ? [RestoreSetupStatePathDots<THead>, ...SplitSetupStatePath<TTail>]
        : [RestoreSetupStatePathDots<TProtected>]
    : never;

type ResolveStatePathSegments<
  TStates extends Record<string, SetupStateSchema>,
  TSegments extends readonly string[]
> = TSegments extends [
  infer THead extends string,
  ...infer TRest extends string[]
]
  ? THead extends keyof TStates
    ? TRest extends []
      ? TStates[THead]
      : TStates[THead]['states'] extends Record<string, SetupStateSchema>
        ? ResolveStatePathSegments<TStates[THead]['states'], TRest>
        : never
    : never
  : never;

type ResolveStatePath<
  TStates extends Record<string, SetupStateSchema>,
  TPath extends string
> = ResolveStatePathSegments<TStates, SplitSetupStatePath<TPath>>;

type ResolveStateSiblingsSegments<
  TStates extends Record<string, SetupStateSchema>,
  TSegments extends readonly string[]
> = TSegments extends [
  infer THead extends string,
  ...infer TRest extends string[]
]
  ? TRest extends []
    ? TStates
    : THead extends keyof TStates
      ? TStates[THead]['states'] extends Record<string, SetupStateSchema>
        ? ResolveStateSiblingsSegments<TStates[THead]['states'], TRest>
        : never
      : never
  : never;

/**
 * The sibling state schemas of a dotted path: the children of the path's
 * parent. A bare transition target resolves relative to the parent, so the
 * valid targets for a path's config are its siblings. For a dotless (top-level)
 * path the siblings are the root states.
 */
type ResolveStateSiblings<
  TStates extends Record<string, SetupStateSchema>,
  TPath extends string
> = ResolveStateSiblingsSegments<TStates, SplitSetupStatePath<TPath>>;

type SetupStateParentAtSegments<
  TStates extends Record<string, SetupStateSchema>,
  TSegments extends readonly string[]
> = TSegments extends [
  infer THead extends string,
  ...infer TRest extends string[]
]
  ? THead extends keyof TStates
    ? TRest extends [string]
      ? TStates[THead]
      : TStates[THead]['states'] extends Record<string, SetupStateSchema>
        ? SetupStateParentAtSegments<TStates[THead]['states'], TRest>
        : never
    : never
  : never;

type SetupStateParentAtPath<
  TStates extends Record<string, SetupStateSchema>,
  TPath extends string
> = SetupStateParentAtSegments<TStates, SplitSetupStatePath<TPath>>;

/** Union of every addressable dotted path into a setup states tree */
type StatePathsInner<TStates extends Record<string, SetupStateSchema>> = {
  [K in SetupStateKeys<TStates>]:
    | EscapeSetupStatePathDots<K>
    | (TStates[K]['states'] extends Record<string, SetupStateSchema>
        ? `${EscapeSetupStatePathDots<K>}.${StatePathsInner<TStates[K]['states']>}`
        : never);
}[SetupStateKeys<TStates>];

type StatePaths<TStates extends Record<string, SetupStateSchema>> =
  string extends SetupStateKeys<TStates>
    ? string
    : [SetupStateKeys<TStates>] extends [never]
      ? string
      : StatePathsInner<TStates>;

type SetupStatePath = readonly string[];

type SetupStatePathAtId<
  TStates extends Record<string, SetupStateSchema>,
  TId extends string,
  TPrefix extends SetupStatePath = []
> = {
  [K in SetupStateKeys<TStates>]: TStates[K] extends { id: TId }
    ? [...TPrefix, K]
    : TStates[K]['states'] extends Record<string, SetupStateSchema>
      ? SetupStatePathAtId<TStates[K]['states'], TId, [...TPrefix, K]>
      : never;
}[SetupStateKeys<TStates>];

type SetupParentStatePath<TPath extends SetupStatePath> =
  TPath extends readonly [...infer TParent extends string[], string]
    ? TParent
    : [];

type SetupResolvedStatePath<
  TRootStateSchemas extends Record<string, SetupStateSchema>,
  TSourcePath extends string,
  TTarget extends string
> = TTarget extends `#${infer TIdPath}`
  ? SplitSetupStatePath<TIdPath> extends [
      infer TId extends string,
      ...infer TDescendant extends string[]
    ]
    ? SetupStatePathAtId<TRootStateSchemas, TId> extends infer TIdStatePath
      ? TIdStatePath extends SetupStatePath
        ? [...TIdStatePath, ...TDescendant]
        : never
      : never
    : never
  : TTarget extends '.'
    ? SplitSetupStatePath<TSourcePath>
    : TTarget extends `.${infer TDescendant}`
      ? [
          ...SplitSetupStatePath<TSourcePath>,
          ...SplitSetupStatePath<TDescendant>
        ]
      : [
          ...SetupParentStatePath<SplitSetupStatePath<TSourcePath>>,
          ...SplitSetupStatePath<TTarget>
        ];

type SetupCommonStatePath<
  TLeft extends SetupStatePath,
  TRight extends SetupStatePath,
  TCommon extends SetupStatePath = []
> = TLeft extends readonly [
  infer TLeftHead extends string,
  ...infer TLeftTail extends string[]
]
  ? TRight extends readonly [
      infer TRightHead extends string,
      ...infer TRightTail extends string[]
    ]
    ? TLeftHead extends TRightHead
      ? SetupCommonStatePath<TLeftTail, TRightTail, [...TCommon, TLeftHead]>
      : TCommon
    : TCommon
  : TCommon;

type SetupIsParallelStatePath<
  TRootStateSchemas extends Record<string, SetupStateSchema>,
  TPath extends SetupStatePath
> = TPath extends []
  ? false
  : ResolveStatePathSegments<
        TRootStateSchemas,
        TPath
      > extends infer TStateSchema
    ? TStateSchema extends { type: 'parallel' }
      ? true
      : TStateSchema extends { type: SetupStateType }
        ? false
        : 'unknown'
    : 'unknown';

type SetupInvalidTargetPair<
  TRootStateSchemas extends Record<string, SetupStateSchema>,
  TLeft extends SetupStatePath,
  TRight extends SetupStatePath
> = [TLeft] extends [never]
  ? false
  : [TRight] extends [never]
    ? false
    : TLeft extends TRight
      ? true
      : TRight extends TLeft
        ? true
        : SetupIsParallelStatePath<
              TRootStateSchemas,
              SetupCommonStatePath<TLeft, TRight>
            > extends true
          ? false
          : SetupIsParallelStatePath<
                TRootStateSchemas,
                SetupCommonStatePath<TLeft, TRight>
              > extends false
            ? true
            : false;

type SetupInvalidTargetPairsWithHead<
  TRootStateSchemas extends Record<string, SetupStateSchema>,
  TSourcePath extends string,
  THead,
  TRest extends readonly unknown[]
> = TRest extends readonly [infer TNext, ...infer TTail]
  ? SetupInvalidTargetPair<
      TRootStateSchemas,
      SetupResolvedStatePath<
        TRootStateSchemas,
        TSourcePath,
        Extract<THead, string>
      >,
      SetupResolvedStatePath<
        TRootStateSchemas,
        TSourcePath,
        Extract<TNext, string>
      >
    > extends true
    ? true
    : SetupInvalidTargetPairsWithHead<
        TRootStateSchemas,
        TSourcePath,
        THead,
        TTail
      >
  : false;

type SetupInvalidTargetSet<
  TRootStateSchemas extends Record<string, SetupStateSchema>,
  TSourcePath extends string,
  TTargets
> = TTargets extends readonly [infer THead, ...infer TRest]
  ? SetupInvalidTargetPairsWithHead<
      TRootStateSchemas,
      TSourcePath,
      THead,
      TRest
    > extends true
    ? true
    : SetupInvalidTargetSet<TRootStateSchemas, TSourcePath, TRest>
  : false;

type SetupTargetSetLegality<
  TTransition,
  TRootStateSchemas extends Record<string, SetupStateSchema>,
  TSourcePath extends string
> = TTransition extends (...args: infer TArgs) => infer TResult
  ? (
      ...args: TArgs
    ) => TResult &
      SetupTargetSetLegality<TResult, TRootStateSchemas, TSourcePath>
  : TTransition extends readonly unknown[]
    ? {
        [K in keyof TTransition]: TTransition[K] &
          SetupTargetSetLegality<
            TTransition[K],
            TRootStateSchemas,
            TSourcePath
          >;
      }
    : TTransition extends {
          target: infer TTargets extends readonly string[];
        }
      ? string extends TTargets[number]
        ? unknown
        : SetupInvalidTargetSet<
              TRootStateSchemas,
              TSourcePath,
              TTargets
            > extends true
          ? never
          : unknown
      : unknown;

type SetupTargetSetMapLegality<
  TMap,
  TRootStateSchemas extends Record<string, SetupStateSchema>,
  TSourcePath extends string
> =
  TMap extends Record<string, unknown>
    ? {
        [K in keyof TMap]?: TMap[K] &
          SetupTargetSetLegality<TMap[K], TRootStateSchemas, TSourcePath>;
      }
    : unknown;

type SetupInvokeTargetSetLegality<
  TInvoke,
  TRootStateSchemas extends Record<string, SetupStateSchema>,
  TSourcePath extends string
> = TInvoke extends readonly unknown[]
  ? {
      [K in keyof TInvoke]: TInvoke[K] &
        SetupInvokeTargetSetLegality<
          TInvoke[K],
          TRootStateSchemas,
          TSourcePath
        >;
    }
  : TInvoke extends Record<string, unknown>
    ? (TInvoke extends { onDone: infer TOnDone }
        ? {
            onDone?: TInvoke['onDone'] &
              SetupTargetSetLegality<TOnDone, TRootStateSchemas, TSourcePath>;
          }
        : unknown) &
        (TInvoke extends { onError: infer TOnError }
          ? {
              onError?: TInvoke['onError'] &
                SetupTargetSetLegality<
                  TOnError,
                  TRootStateSchemas,
                  TSourcePath
                >;
            }
          : unknown) &
        (TInvoke extends { onSnapshot: infer TOnSnapshot }
          ? {
              onSnapshot?: TInvoke['onSnapshot'] &
                SetupTargetSetLegality<
                  TOnSnapshot,
                  TRootStateSchemas,
                  TSourcePath
                >;
            }
          : unknown) &
        (TInvoke extends { onTimeout: infer TOnTimeout }
          ? {
              onTimeout?: TInvoke['onTimeout'] &
                SetupTargetSetLegality<
                  TOnTimeout,
                  TRootStateSchemas,
                  TSourcePath
                >;
            }
          : unknown)
    : unknown;

type SetupStateTargetSetLegality<
  TConfig,
  TRootStateSchemas extends Record<string, SetupStateSchema>,
  TSourcePath extends string
> = (TConfig extends { on: infer TOn }
  ? {
      on?: TConfig['on'] &
        SetupTargetSetMapLegality<TOn, TRootStateSchemas, TSourcePath>;
    }
  : unknown) &
  (TConfig extends { always: infer TAlways }
    ? {
        always?: TConfig['always'] &
          SetupTargetSetLegality<TAlways, TRootStateSchemas, TSourcePath>;
      }
    : unknown) &
  (TConfig extends { after: infer TAfter }
    ? {
        after?: TConfig['after'] &
          SetupTargetSetMapLegality<TAfter, TRootStateSchemas, TSourcePath>;
      }
    : unknown) &
  (TConfig extends { onDone: infer TOnDone }
    ? {
        onDone?: TConfig['onDone'] &
          SetupTargetSetLegality<TOnDone, TRootStateSchemas, TSourcePath>;
      }
    : unknown) &
  (TConfig extends { onError: infer TOnError }
    ? {
        onError?: TConfig['onError'] &
          SetupTargetSetLegality<TOnError, TRootStateSchemas, TSourcePath>;
      }
    : unknown) &
  (TConfig extends { onTimeout: infer TOnTimeout }
    ? {
        onTimeout?: TConfig['onTimeout'] &
          SetupTargetSetLegality<TOnTimeout, TRootStateSchemas, TSourcePath>;
      }
    : unknown) &
  (TConfig extends { choice: infer TChoice }
    ? {
        choice?: TConfig['choice'] &
          SetupTargetSetLegality<TChoice, TRootStateSchemas, TSourcePath>;
      }
    : unknown) &
  (TConfig extends { invoke: infer TInvoke }
    ? {
        invoke?: TConfig['invoke'] &
          SetupInvokeTargetSetLegality<TInvoke, TRootStateSchemas, TSourcePath>;
      }
    : unknown);

/**
 * Shared body of both `createStateConfig` overloads: the
 * `StateNodeConfigWithNestedInput` instantiation whose only varying parts are
 * the leading sibling-schemas and state-schema arguments.
 */
type SetupStateNodeConfig<
  TStates extends Record<string, SetupStateSchema>,
  TStateSchema extends SetupStateSchema,
  TSchemas extends SetupSchemas,
  TSetupActionMap extends Sources['actions'],
  TSetupActorMap extends Sources['actors'],
  TSetupGuardMap extends Sources['guards'],
  TSetupDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry
> = StateNodeConfigWithNestedInput<
  TStates,
  TStateSchema,
  SetupContext<TSchemas, StandardSchemaV1>,
  SetupContextShape<
    TSchemas,
    StandardSchemaV1,
    SetupContext<TSchemas, StandardSchemaV1>
  >,
  SetupEvents<TSchemas, Record<string, StandardSchemaV1>>,
  Cast<
    SetupChildren<TSchemas, Record<string, StandardSchemaV1>>,
    Record<string, AnyActorRef | undefined>
  >,
  string,
  SetupTags<TSchemas, StandardSchemaV1>,
  SetupOutput<TSchemas, StandardSchemaV1>,
  SetupEmitted<TSchemas, Record<string, StandardSchemaV1>>,
  SetupMeta<TSchemas, StandardSchemaV1>,
  SetupActions<TSchemas, TSetupActionMap>,
  TSetupActorMap,
  SetupGuards<TSchemas, TSetupGuardMap>,
  TSetupDelayMap,
  TSystemRegistry
>;

type SetupContext<TSchemas, TContextSchema extends StandardSchemaV1> = [
  SetupSchema<TSchemas, 'context'>
] extends [never]
  ? unknown extends StandardSchemaV1.InferOutput<TContextSchema>
    ? MachineContext
    : StandardSchemaV1.InferOutput<TContextSchema> & MachineContext
  : StandardSchemaV1.InferOutput<SetupSchema<TSchemas, 'context'>> &
      MachineContext;

type SetupContextShape<
  TSchemas,
  TContextSchema extends StandardSchemaV1,
  TFallbackContext
> = [SetupSchema<TSchemas, 'context'>] extends [never]
  ? unknown extends StandardSchemaV1.InferOutput<TContextSchema>
    ? TFallbackContext
    : StandardSchemaV1.InferOutput<TContextSchema>
  : StandardSchemaV1.InferOutput<SetupSchema<TSchemas, 'context'>>;

type SetupContextRequired<TSchemas, TContextSchema extends StandardSchemaV1> = [
  SetupSchema<TSchemas, 'context'>
] extends [never]
  ? unknown extends StandardSchemaV1.InferOutput<TContextSchema>
    ? false
    : true
  : true;

type SetupPublicEvents<
  TSchemas,
  TEventSchemaMap extends Record<string, StandardSchemaV1>
> = [SetupSchemaMap<TSchemas, 'events'>] extends [never]
  ? InferEvents<TEventSchemaMap>
  : InferEvents<SetupSchemaMap<TSchemas, 'events'>>;

type SetupInternalEvents<
  TSchemas,
  TInternalEventSchemaMap extends Record<string, StandardSchemaV1>
> = [SetupSchemaMap<TSchemas, 'internalEvents'>] extends [never]
  ? InferInternalEvents<TInternalEventSchemaMap>
  : InferInternalEvents<SetupSchemaMap<TSchemas, 'internalEvents'>>;

type SetupEvents<
  TSchemas,
  TEventSchemaMap extends Record<string, StandardSchemaV1>,
  TInternalEventSchemaMap extends Record<string, StandardSchemaV1> = {}
> =
  | SetupPublicEvents<TSchemas, TEventSchemaMap>
  | SetupInternalEvents<TSchemas, TInternalEventSchemaMap>;

type SetupTags<TSchemas, TTagSchema extends StandardSchemaV1> = [
  SetupSchema<TSchemas, 'tags'>
] extends [never]
  ? StandardSchemaV1.InferOutput<TTagSchema> & string
  : StandardSchemaV1.InferOutput<SetupSchema<TSchemas, 'tags'>> & string;

type SetupInput<TSchemas, TInputSchema extends StandardSchemaV1> = [
  SetupSchema<TSchemas, 'input'>
] extends [never]
  ? InferOutput<TInputSchema, unknown>
  : InferOutput<SetupSchema<TSchemas, 'input'>, unknown>;

type SetupOutput<TSchemas, TOutputSchema extends StandardSchemaV1> = [
  SetupSchema<TSchemas, 'output'>
] extends [never]
  ? InferOutput<TOutputSchema, unknown>
  : InferOutput<SetupSchema<TSchemas, 'output'>, unknown>;

/**
 * Whether an output schema was declared, either in `setup({ schemas })` or in
 * the machine config's own `schemas.output`. A declared schema is always
 * authoritative for the machine's output type.
 */
type HasOutputSchema<TSchemas, TOutputSchema extends StandardSchemaV1> = [
  SetupSchema<TSchemas, 'output'>
] extends [never]
  ? StandardSchemaV1 extends TOutputSchema
    ? false
    : true
  : true;

/**
 * The machine's output type. A declared output schema wins; otherwise the type
 * is inferred from the config's `output` property (a mapper's return type, or
 * the static value's type).
 */
type SetupOrConfigOutput<
  TSchemas,
  TOutputSchema extends StandardSchemaV1,
  TConfig
> =
  HasOutputSchema<TSchemas, TOutputSchema> extends true
    ? SetupOutput<TSchemas, TOutputSchema>
    : OutputFromConfig<TConfig, SetupOutput<TSchemas, TOutputSchema>>;

type SetupEmitted<
  TSchemas,
  TEmittedSchemaMap extends Record<string, StandardSchemaV1>
> = [SetupSchemaMap<TSchemas, 'emitted'>] extends [never]
  ? WithDefault<InferEvents<TEmittedSchemaMap>, AnyEventObject>
  : WithDefault<
      InferEvents<SetupSchemaMap<TSchemas, 'emitted'>>,
      AnyEventObject
    >;

type SetupMeta<TSchemas, TMetaSchema extends StandardSchemaV1> = [
  SetupSchema<TSchemas, 'meta'>
] extends [never]
  ? InferOutput<TMetaSchema, MetaObject>
  : InferOutput<SetupSchema<TSchemas, 'meta'>, MetaObject>;

type SetupChildren<
  TSchemas,
  TChildrenSchemaMap extends Record<string, StandardSchemaV1>
> = [SetupSchemaMap<TSchemas, 'children'>] extends [never]
  ? InferChildren<TChildrenSchemaMap>
  : InferChildren<SetupSchemaMap<TSchemas, 'children'>>;

type SetupActions<TSchemas, TActionMap extends Sources['actions']> = [
  SetupActionSchemaMap<TSchemas>
] extends [never]
  ? TActionMap
  : MergeSourceMaps<InferActions<SetupActionSchemaMap<TSchemas>>, TActionMap>;

type SetupGuards<TSchemas, TGuardMap extends Sources['guards']> = [
  SetupGuardSchemaMap<TSchemas>
] extends [never]
  ? TGuardMap
  : MergeSourceMaps<InferGuards<SetupGuardSchemaMap<TSchemas>>, TGuardMap>;

type MergeChildren<
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActor extends ProvidedActor
> = [keyof TChildren] extends [never]
  ? Compute<ToChildren<TActor>>
  : Compute<TChildren>;

type MergeSourceMaps<
  TBase extends Record<string, unknown>,
  TExtension extends Record<string, unknown>
> = Compute<TBase & TExtension>;

type MergeSetupStateSchemaField<
  TBase extends SetupStateSchema,
  TExtension extends SetupStateSchema,
  TKey extends 'schemas' | 'states'
> = TKey extends keyof TExtension
  ? TKey extends keyof TBase
    ? TKey extends 'schemas'
      ? {
          [K in TKey]: MergeRecord<
            NonNullable<TBase[TKey]>,
            NonNullable<TExtension[TKey]>
          >;
        }
      : NonNullable<TBase[TKey]> extends Record<string, SetupStateSchema>
        ? NonNullable<TExtension[TKey]> extends Record<string, SetupStateSchema>
          ? {
              [K in TKey]: MergeSetupStateSchemas<
                NonNullable<TBase[TKey]>,
                NonNullable<TExtension[TKey]>
              >;
            }
          : Pick<TExtension, TKey>
        : Pick<TExtension, TKey>
    : Pick<TExtension, TKey>
  : TKey extends keyof TBase
    ? Pick<TBase, TKey>
    : {};

type MergeSetupStateSchema<
  TBase extends SetupStateSchema,
  TExtension extends SetupStateSchema
> = Omit<TBase, keyof TExtension> &
  Omit<TExtension, 'schemas' | 'states'> &
  MergeSetupStateSchemaField<TBase, TExtension, 'schemas'> &
  MergeSetupStateSchemaField<TBase, TExtension, 'states'>;

type MergeSetupStateSchemas<
  TBase extends Record<string, SetupStateSchema>,
  TExtension extends Record<string, SetupStateSchema>
> = {
  [K in keyof TBase | keyof TExtension]: K extends keyof TExtension
    ? K extends keyof TBase
      ? MergeSetupStateSchema<TBase[K], TExtension[K]>
      : TExtension[K]
    : K extends keyof TBase
      ? TBase[K]
      : never;
};

type DelayNamesFromConfigOrString<TConfig> = TConfig extends {
  delays: infer TDelays;
}
  ? Extract<keyof TDelays, string>
  : string;

type DelayNamesFromConfig<TConfig> = TConfig extends { delays: infer TDelays }
  ? Extract<keyof TDelays, string>
  : never;

type InvalidDelayReferences<TConfig, TDelays extends string> =
  | (TConfig extends { after: infer TAfter }
      ? Exclude<Extract<keyof TAfter, string>, TDelays>
      : never)
  | (TConfig extends { timeout: infer TTimeout }
      ? TTimeout extends string
        ? TTimeout extends TDelays
          ? never
          : TTimeout
        : never
      : never)
  | (TConfig extends { states: infer TStates }
      ? TStates extends Record<string, unknown>
        ? {
            [K in keyof TStates]: InvalidDelayReferences<TStates[K], TDelays>;
          }[keyof TStates]
        : never
      : never);

type ValidateSetupDelayReferences<
  TConfig,
  TSetupDelays extends string
> = string extends (
  [TSetupDelays] extends [never]
    ? DelayNamesFromConfigOrString<TConfig>
    : TSetupDelays | DelayNamesFromConfig<TConfig>
)
  ? unknown
  : InvalidDelayReferences<
        TConfig,
        [TSetupDelays] extends [never]
          ? DelayNamesFromConfigOrString<TConfig>
          : TSetupDelays | DelayNamesFromConfig<TConfig>
      > extends never
    ? unknown
    : never;

/** Extracts input type from a state schema */
type StateInput<TStateSchema extends SetupStateSchema> =
  TStateSchema['schemas'] extends { input: infer TInputSchema }
    ? TInputSchema extends StandardSchemaV1
      ? StandardSchemaV1.InferOutput<TInputSchema>
      : undefined
    : undefined;

/** Extracts the completion output type from a state schema. */
type StateOutput<
  TStateSchema extends SetupStateSchema,
  TFallback
> = TStateSchema['schemas'] extends { output: infer TOutputSchema }
  ? TOutputSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TOutputSchema>
    : TFallback
  : TFallback;

type StateCompletionOutput<TStateSchema extends SetupStateSchema> = StateOutput<
  TStateSchema,
  unknown
>;

type StateContext<
  TStateSchema extends SetupStateSchema,
  TFallbackContext extends MachineContext
> = TStateSchema['schemas'] extends { context: infer TContextSchema }
  ? TContextSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TContextSchema> &
        MachineContext &
        RootContextMarker<TFallbackContext>
    : RootContext<TFallbackContext>
  : RootContext<TFallbackContext>;

declare const rootContext: unique symbol;

type RootContextMarker<TContext> = {
  readonly [rootContext]?: RootContext<TContext>;
};

type RootContext<TContext> = typeof rootContext extends keyof TContext
  ? TContext[typeof rootContext]
  : TContext;

type StateContextShape<
  TStateSchema extends SetupStateSchema,
  TFallbackContext
> = TStateSchema['schemas'] extends { context: infer TContextSchema }
  ? TContextSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TContextSchema> &
        RootContextMarker<TFallbackContext>
    : RootContext<TFallbackContext>
  : RootContext<TFallbackContext>;

type WithNestedStates<TConfig, TNestedStates> = TConfig extends {
  type: 'choice';
}
  ? TConfig
  : Omit<TConfig, 'states'> & { states?: TNestedStates };

type HasStateInputSchema<TStateSchema extends SetupStateSchema> =
  TStateSchema['schemas'] extends { input: infer TInputSchema }
    ? TInputSchema extends StandardSchemaV1
      ? true
      : false
    : false;

type RequiresStateInput<TStateSchema extends SetupStateSchema> =
  HasStateInputSchema<TStateSchema> extends true
    ? undefined extends StateInput<TStateSchema>
      ? false
      : true
    : false;

type HasRequiredStateInput<TStates extends Record<string, SetupStateSchema>> =
  true extends {
    [K in keyof TStates]: RequiresStateInput<TStates[K]>;
  }[keyof TStates]
    ? true
    : false;

type SetupStateSchemaForChild<
  TStateSchema extends SetupStateSchema,
  TTarget extends string
> = TStateSchema['states'] extends infer TStates extends Record<
  string,
  SetupStateSchema
>
  ? TTarget extends keyof TStates & string
    ? TStates[TTarget]
    : {}
  : {};

type SetupStateInputConfig<
  TStateSchema extends SetupStateSchema,
  TContext extends MachineContext,
  TEvent extends EventObject,
  TInputArgs extends { context: TContext; event: TEvent } = {
    context: TContext;
    event: TEvent;
  }
> =
  HasStateInputSchema<TStateSchema> extends true
    ? undefined extends StateInput<TStateSchema>
      ? {
          input?:
            | StateInput<TStateSchema>
            | ((args: TInputArgs) => StateInput<TStateSchema>);
        }
      : {
          input:
            | StateInput<TStateSchema>
            | ((args: TInputArgs) => StateInput<TStateSchema>);
        }
    : {
        input?:
          | Record<string, unknown>
          | ((args: TInputArgs) => Record<string, unknown>);
      };

type SetupChoiceTargetConfig<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TEvent extends EventObject
> =
  | {
      [K in KnownSetupStateTarget<TStateSchemas>]: {
        target: K;
      } & SetupStateInputConfig<
        SetupStateSchemaAtTarget<TStateSchemas, K>,
        TContext,
        TEvent
      >;
    }[KnownSetupStateTarget<TStateSchemas>]
  | (TStateSchemas extends { readonly [strictSetupStateTargets]: true }
      ? {
          target: KnownSetupStateTarget<TStateSchemas>[];
          input?: Record<string, unknown>;
        }
      : {
          target: SetupStateTarget<TStateSchemas>[];
          input?: Record<string, unknown>;
        });

type SetupChoiceFunction<
  TChoice,
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TEvent extends EventObject
> = TChoice extends (...args: infer TArgs) => infer TResult
  ? (
      ...args: TArgs
    ) =>
      | (TResult extends { target: unknown }
          ? Omit<TResult, 'target' | 'input'> &
              SetupChoiceTargetConfig<TStateSchemas, TContext, TEvent>
          : TResult)
      | void
  : never;

type SetupChoiceTargetArrayInputConstraint<
  TChoice,
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TEvent extends EventObject
> = TChoice extends (...args: infer TArgs) => infer TResult
  ? (
      ...args: TArgs
    ) => TResult &
      SetupTargetArrayInputConstraint<TResult, TStateSchemas, TContext, TEvent>
  : never;

type SetupTargetInput<TStateSchema extends SetupStateSchema> =
  HasStateInputSchema<TStateSchema> extends true
    ? Exclude<StateInput<TStateSchema>, undefined>
    : Record<string, unknown>;

type SetupUnionToIntersection<T> = (
  T extends any ? (value: T) => void : never
) extends (value: infer I) => void
  ? I
  : never;

type SetupTargetArrayInput<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TTargets extends readonly string[]
> = SetupUnionToIntersection<
  SetupTargetInputForTarget<TStateSchemas, TTargets[number]>
>;

type SetupTargetInputForTarget<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TTarget extends string
> =
  SetupStateSchemaAtTarget<TStateSchemas, TTarget> extends infer TStateSchema
    ? TStateSchema extends SetupStateSchema
      ? SetupTargetInput<TStateSchema>
      : Record<string, unknown>
    : Record<string, unknown>;

type SetupTargetArrayRequiresInput<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TTargets extends readonly string[]
> = true extends {
  [K in TTargets[number]]: RequiresStateInput<
    SetupStateSchemaAtTarget<TStateSchemas, K>
  >;
}[TTargets[number]]
  ? true
  : false;

type SetupTargetArrayInputConfig<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TTargets extends readonly string[],
  TContext extends MachineContext = MachineContext,
  TEvent extends EventObject = EventObject
> =
  SetupTargetArrayRequiresInput<TStateSchemas, TTargets> extends true
    ? {
        input:
          | SetupTargetArrayInput<TStateSchemas, TTargets>
          | ((args: {
              context: TContext;
              event: TEvent;
            }) => SetupTargetArrayInput<TStateSchemas, TTargets>);
      }
    : {
        input?:
          | SetupTargetArrayInput<TStateSchemas, TTargets>
          | ((args: {
              context: TContext;
              event: TEvent;
            }) => SetupTargetArrayInput<TStateSchemas, TTargets>);
      };

/**
 * The runtime applies one transition input to every target in a target set.
 * Keep the array's input correlated to its literal targets by requiring the
 * intersection of their direct input types. Widened string arrays remain
 * permissive for compatibility.
 */
type SetupTargetArrayInputConstraint<
  TTransition,
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext = MachineContext,
  TEvent extends EventObject = EventObject
> = TTransition extends (...args: infer TArgs) => infer TResult
  ? (
      ...args: TArgs
    ) => TResult &
      SetupTargetArrayInputConstraint<TResult, TStateSchemas, TContext, TEvent>
  : [TTransition] extends [{ target: infer TTargets extends readonly string[] }]
    ? string extends TTargets[number]
      ? unknown
      : [TTargets[number]] extends [never]
        ? unknown
        : KnownSetupStateTarget<TStateSchemas> extends never
          ? unknown
          : Exclude<
                TTargets[number],
                KnownSetupStateTarget<TStateSchemas>
              > extends never
            ? SetupTargetArrayInputConfig<
                TStateSchemas,
                TTargets,
                TContext,
                TEvent
              >
            : never
    : unknown;

type SetupTransitionValueTargetArrayInputConstraint<
  TValue,
  TStateSchemas extends Record<string, SetupStateSchema>
> = [TValue] extends [readonly unknown[]]
  ? {
      [K in keyof TValue]: TValue[K] &
        SetupTransitionValueTargetArrayInputConstraint<
          TValue[K],
          TStateSchemas
        >;
    }
  : SetupTargetArrayInputConstraint<TValue, TStateSchemas>;

type SetupTransitionMapTargetArrayInputConstraint<
  TValue,
  TStateSchemas extends Record<string, SetupStateSchema>
> = [TValue] extends [Record<string, unknown>]
  ? {
      [K in keyof TValue]?: TValue[K] &
        SetupTransitionValueTargetArrayInputConstraint<
          TValue[K],
          TStateSchemas
        >;
    }
  : unknown;

type SetupTransitionPropertyTargetArrayInputConstraint<
  TConfig,
  TKey extends PropertyKey,
  TStateSchemas extends Record<string, SetupStateSchema>,
  TIsMap extends boolean = false
> = TKey extends keyof TConfig
  ? {
      [K in TKey]?: TConfig[K] &
        (TIsMap extends true
          ? SetupTransitionMapTargetArrayInputConstraint<
              TConfig[K],
              TStateSchemas
            >
          : SetupTransitionValueTargetArrayInputConstraint<
              TConfig[K],
              TStateSchemas
            >);
    }
  : unknown;

type SetupInvokeTargetArrayInputConstraint<
  TInvoke,
  TStateSchemas extends Record<string, SetupStateSchema>
> = [TInvoke] extends [readonly unknown[]]
  ? {
      [K in keyof TInvoke]: TInvoke[K] &
        SetupInvokeTargetArrayInputConstraint<TInvoke[K], TStateSchemas>;
    }
  : [TInvoke] extends [Record<string, unknown>]
    ? SetupTransitionPropertyTargetArrayInputConstraint<
        TInvoke,
        'onDone',
        TStateSchemas
      > &
        SetupTransitionPropertyTargetArrayInputConstraint<
          TInvoke,
          'onError',
          TStateSchemas
        > &
        SetupTransitionPropertyTargetArrayInputConstraint<
          TInvoke,
          'onSnapshot',
          TStateSchemas
        > &
        SetupTransitionPropertyTargetArrayInputConstraint<
          TInvoke,
          'onTimeout',
          TStateSchemas
        >
    : unknown;

type SetupStateNodeTargetArrayInputConstraint<
  TConfig,
  TSiblingStateSchemas extends Record<string, SetupStateSchema>,
  TStateSchema extends SetupStateSchema,
  TChildStateSchemas extends Record<string, SetupStateSchema>
> = SetupTransitionPropertyTargetArrayInputConstraint<
  TConfig,
  'on',
  SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>,
  true
> &
  SetupTransitionPropertyTargetArrayInputConstraint<
    TConfig,
    'always',
    SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>
  > &
  SetupTransitionPropertyTargetArrayInputConstraint<
    TConfig,
    'after',
    SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>,
    true
  > &
  SetupTransitionPropertyTargetArrayInputConstraint<
    TConfig,
    'onDone',
    SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>
  > &
  SetupTransitionPropertyTargetArrayInputConstraint<
    TConfig,
    'onError',
    SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>
  > &
  SetupTransitionPropertyTargetArrayInputConstraint<
    TConfig,
    'onTimeout',
    SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>
  > &
  SetupTransitionPropertyTargetArrayInputConstraint<
    TConfig,
    'choice',
    SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>
  > &
  (TConfig extends { invoke: infer TInvoke }
    ? {
        invoke?: TConfig['invoke'] &
          SetupInvokeTargetArrayInputConstraint<
            TInvoke,
            SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>
          >;
      }
    : unknown) &
  (TConfig extends {
    states: infer TChildren extends Record<string, unknown>;
  }
    ? {
        states?: {
          [K in keyof TChildren]?: TChildren[K] &
            SetupStateNodeTargetArrayInputConstraint<
              TChildren[K],
              TChildStateSchemas,
              K extends keyof TChildStateSchemas
                ? TChildStateSchemas[K]
                : SetupStateSchema,
              SetupStateChildSchemas<
                K extends keyof TChildStateSchemas
                  ? TChildStateSchemas[K]
                  : SetupStateSchema
              >
            >;
        };
      }
    : unknown);

type ValidateSetupTargetArrayInputs<
  TConfig,
  TRootStateSchemas extends Record<string, SetupStateSchema>
> = SetupStateNodeTargetArrayInputConstraint<
  TConfig,
  TRootStateSchemas,
  SetupStateSchema,
  TRootStateSchemas
>;

type ValidateSetupStateContracts<
  TConfig,
  TStateSchemas extends Record<string, SetupStateSchema>
> =
  HasExplicitSetupStateContracts<TStateSchemas> extends true
    ? ValidateSetupHistoryInputs<TConfig, TStateSchemas> &
        ValidateHistoryDefaults<MergeSetupConfig<TConfig, TStateSchemas>> &
        ValidateStateTargets<MergeSetupConfig<TConfig, TStateSchemas>> &
        NoInfer<ValidateSetupTargetArrayInputs<TConfig, TStateSchemas>>
    : unknown;

type SetupInitialTransitionConfig<
  TStateSchema extends SetupStateSchema,
  TTarget extends string,
  TConfig,
  TContext extends MachineContext,
  TEvent extends EventObject
> =
  Extract<
    SetupConfigInitial<TConfig>,
    { target: TTarget }
  > extends infer TInitial
    ? [TInitial] extends [never]
      ? { target: TTarget } & SetupStateInputConfig<
          SetupStateSchemaForChild<TStateSchema, TTarget>,
          TContext,
          TEvent
        >
      : Omit<TInitial, 'target' | 'input'> & {
          target: TTarget;
        } & SetupStateInputConfig<
            SetupStateSchemaForChild<TStateSchema, TTarget>,
            TContext,
            TEvent
          >
    : never;

type SetupConfigInitial<TConfig> = TConfig extends {
  initial?: infer TInitial;
}
  ? NonNullable<TInitial>
  : never;

type SetupInitialTransition<
  TStateSchema extends SetupStateSchema,
  TTarget extends string = string,
  TConfig = unknown,
  TContext extends MachineContext = MachineContext,
  TEvent extends EventObject = EventObject
> =
  | (RequiresStateInput<
      SetupStateSchemaForChild<TStateSchema, TTarget>
    > extends true
      ? never
      : TTarget)
  | SetupInitialTransitionConfig<
      TStateSchema,
      TTarget,
      TConfig,
      TContext,
      TEvent
    >;

type SetupInitialTransitionForStates<
  TStateSchema extends SetupStateSchema,
  TConfig,
  TContext extends MachineContext,
  TEvent extends EventObject
> = TStateSchema['states'] extends infer TStates extends Record<
  string,
  SetupStateSchema
>
  ? {
      [K in keyof TStates & string]: SetupInitialTransition<
        TStateSchema,
        K,
        TConfig,
        TContext,
        TEvent
      >;
    }[keyof TStates & string]
  : never;

type SetupInitialTransitionForOtherStates<
  TStateSchema extends SetupStateSchema,
  TInitial extends string,
  TContext extends MachineContext,
  TEvent extends EventObject
> = TStateSchema['states'] extends infer TStates extends Record<
  string,
  SetupStateSchema
>
  ? {
      [K in Exclude<keyof TStates & string, TInitial>]: SetupInitialTransition<
        TStateSchema,
        K,
        unknown,
        TContext,
        TEvent
      >;
    }[Exclude<keyof TStates & string, TInitial>]
  : never;

type SetupStateInitial<
  TStateSchema extends SetupStateSchema,
  TContext extends MachineContext,
  TEvent extends EventObject
> = TStateSchema extends { initial: infer TInitial extends string }
  ? RequiresStateInput<
      SetupStateSchemaForChild<TStateSchema, TInitial>
    > extends true
    ? {
        initial:
          | SetupInitialTransition<
              TStateSchema,
              TInitial,
              unknown,
              TContext,
              TEvent
            >
          | SetupInitialTransitionForOtherStates<
              TStateSchema,
              TInitial,
              TContext,
              TEvent
            >;
      }
    : {
        initial?:
          | SetupInitialTransition<
              TStateSchema,
              TInitial,
              unknown,
              TContext,
              TEvent
            >
          | SetupInitialTransitionForOtherStates<
              TStateSchema,
              TInitial,
              TContext,
              TEvent
            >;
      }
  : TStateSchema['states'] extends Record<string, SetupStateSchema>
    ? HasRequiredStateInput<TStateSchema['states']> extends true
      ? {
          initial: SetupInitialTransitionForStates<
            TStateSchema,
            unknown,
            TContext,
            TEvent
          >;
        }
      : {
          initial:
            | string
            | {
                target: string;
                input?: Record<string, unknown>;
              };
        }
    : {
        initial:
          | string
          | {
              target: string;
              input?: Record<string, unknown>;
            };
      };

type SetupStateNodeContract<
  TStateSchema extends SetupStateSchema,
  TConfig,
  TContext extends MachineContext = MachineContext,
  TEvent extends EventObject = EventObject,
  TSiblingStateSchemas extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >
> = TStateSchema extends { type: infer TType }
  ? TType extends 'atomic'
    ? Omit<TConfig, 'type' | 'states' | 'initial' | 'history' | 'target'> & {
        type?: 'atomic';
        states?: never;
        initial?: never;
        history?: never;
        target?: never;
      }
    : TType extends 'compound'
      ? Omit<TConfig, 'type' | 'initial'> &
          ({ type?: 'compound' } & SetupStateChildrenContract<
            TStateSchema,
            TConfig
          > &
            SetupStateInitial<TStateSchema, TContext, TEvent>)
      : TType extends 'parallel'
        ? Omit<TConfig, 'type' | 'initial'> & {
            type?: 'parallel';
            initial?: never;
            states: NonNullable<
              TConfig extends { states?: infer TStates } ? TStates : unknown
            >;
          }
        : TType extends 'final'
          ? Omit<
              TConfig,
              | 'type'
              | 'states'
              | 'initial'
              | 'history'
              | 'target'
              | 'invoke'
              | 'on'
              | 'always'
              | 'after'
              | 'timeout'
              | 'onTimeout'
              | 'onDone'
              | 'onError'
            > & {
              type?: 'final';
              states?: never;
              initial?: never;
              history?: never;
              target?: never;
              invoke?: never;
              on?: never;
              always?: never;
              after?: never;
              timeout?: never;
              onTimeout?: never;
              onDone?: never;
              onError?: never;
            }
          : TType extends 'history'
            ? SetupHistoryStateContract<
                TStateSchema,
                TConfig,
                TSiblingStateSchemas
              >
            : TType extends 'choice'
              ? Omit<
                  TConfig,
                  | 'type'
                  | 'states'
                  | 'initial'
                  | 'history'
                  | 'target'
                  | 'invoke'
                  | 'on'
                  | 'entry'
                  | 'exit'
                  | 'onDone'
                  | 'onError'
                  | 'after'
                  | 'timeout'
                  | 'onTimeout'
                  | 'always'
                > & {
                  type?: 'choice';
                  choice: Extract<
                    TConfig,
                    { choice: (...args: any[]) => any }
                  > extends { choice: infer TChoice }
                    ? SetupChoiceFunction<
                        TChoice,
                        SetupStateTransitionSchemas<
                          TSiblingStateSchemas,
                          TStateSchema
                        >,
                        TContext,
                        TEvent
                      > &
                        SetupChoiceTargetArrayInputConstraint<
                          TChoice,
                          SetupStateTransitionSchemas<
                            TSiblingStateSchemas,
                            TStateSchema
                          >,
                          TContext,
                          TEvent
                        >
                    : (...args: any[]) => any;
                  states?: never;
                  initial?: never;
                  history?: never;
                  target?: never;
                  invoke?: never;
                  on?: never;
                  entry?: never;
                  exit?: never;
                  onDone?: never;
                  onError?: never;
                  after?: never;
                  timeout?: never;
                  onTimeout?: never;
                  always?: never;
                }
              : TStateSchema extends { history: unknown }
                ? SetupHistoryStateContract<
                    TStateSchema,
                    TConfig,
                    TSiblingStateSchemas
                  >
                : TConfig
  : TConfig;

type SetupHistoryStateContract<
  TStateSchema extends SetupStateSchema,
  TConfig,
  TSiblingStateSchemas extends Record<string, SetupStateSchema>
> = Omit<TConfig, 'type' | 'states' | 'initial' | 'target'> & {
  type?: 'history';
  states?: never;
  initial?: never;
} & (TStateSchema extends {
    target: infer TTarget extends string | readonly [string, ...string[]];
  }
    ? {
        target?:
          | TTarget
          | KnownSetupStateTarget<TSiblingStateSchemas>
          | readonly KnownSetupStateTarget<TSiblingStateSchemas>[];
      }
    : {
        target:
          | KnownSetupStateTarget<TSiblingStateSchemas>
          | readonly KnownSetupStateTarget<TSiblingStateSchemas>[];
      });

type SetupStateChildrenContract<
  TStateSchema extends SetupStateSchema,
  TConfig
> = TStateSchema extends {
  states: Record<string, SetupStateSchema>;
}
  ? {
      states: NonNullable<
        TConfig extends { states?: infer TStates } ? TStates : unknown
      >;
    }
  : {};

type HistoryTargetRequiresInput<
  TSiblingStateSchemas extends Record<string, SetupStateSchema>,
  TTarget extends string | readonly string[]
> = TTarget extends readonly (infer TTargets extends string)[]
  ? true extends {
      [K in TTargets]: RequiresStateInput<
        SetupStateSchemaAtTarget<TSiblingStateSchemas, K>
      >;
    }[TTargets]
    ? true
    : false
  : TTarget extends string
    ? RequiresStateInput<
        SetupStateSchemaAtTarget<TSiblingStateSchemas, TTarget>
      >
    : false;

type SetupHistoryTarget<
  TStateSchema extends SetupStateSchema,
  TConfig
> = TConfig extends {
  target: infer TTarget extends string | readonly [string, ...string[]];
}
  ? TTarget
  : TStateSchema extends {
        target: infer TTarget extends string | readonly [string, ...string[]];
      }
    ? TTarget
    : never;

type ValidateSetupHistoryStateInput<
  TConfig,
  TStateSchema extends SetupStateSchema,
  TSiblingStateSchemas extends Record<string, SetupStateSchema>
> = TStateSchema extends { type: 'history' } | { history: unknown }
  ? SetupHistoryTarget<TStateSchema, TConfig> extends infer TTarget
    ? [TTarget] extends [never]
      ? unknown
      : TTarget extends string | readonly [string, ...string[]]
        ? HistoryTargetRequiresInput<TSiblingStateSchemas, TTarget> extends true
          ? never
          : unknown
        : unknown
    : unknown
  : unknown;

type ValidateSetupHistoryInputs<
  TConfig,
  TStateSchemas extends Record<string, SetupStateSchema>,
  TRootStateSchemas extends Record<string, SetupStateSchema> = TStateSchemas
> = TConfig extends { states: infer TStates extends Record<string, unknown> }
  ? {
      states: {
        [K in keyof TStates & string]: K extends keyof TStateSchemas
          ? TStates[K] &
              ValidateSetupHistoryStateInput<
                TStates[K],
                TStateSchemas[K],
                WithRootSetupStateSchemas<TStateSchemas, TRootStateSchemas>
              > &
              (TStateSchemas[K]['states'] extends Record<
                string,
                SetupStateSchema
              >
                ? ValidateSetupHistoryInputs<
                    TStates[K],
                    TStateSchemas[K]['states'],
                    TRootStateSchemas
                  >
                : unknown)
          : TStates[K];
      };
    }
  : unknown;

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

type SetupStateSchemaMetadata<TSetupSchema extends SetupStateSchema> =
  (TSetupSchema extends { type: infer TType } ? { type: TType } : {}) &
    (TSetupSchema extends { id: infer TId } ? { id: TId } : {}) &
    (TSetupSchema extends { initial: infer TInitial }
      ? { initial: TInitial }
      : {}) &
    (TSetupSchema extends { history: infer THistory }
      ? { history: THistory }
      : {}) &
    (TSetupSchema extends { target: infer TTarget }
      ? { target: TTarget }
      : {}) &
    (TSetupSchema extends { route: infer TRoute } ? { route: TRoute } : {});

/**
 * Converts SetupStateSchema to StateSchema with input types included. This
 * allows getInputs() to be strongly typed.
 */
type SetupStateSchemaToStateSchema<TSetupSchema extends SetupStateSchema> = {
  input: StateInput<TSetupSchema>;
  contextSchema: TSetupSchema['schemas'] extends {
    context: infer TContextSchema;
  }
    ? TContextSchema extends StandardSchemaV1
      ? TContextSchema
      : undefined
    : undefined;
  outputSchema: TSetupSchema['schemas'] extends {
    output: infer TOutputSchema;
  }
    ? TOutputSchema extends StandardSchemaV1
      ? TOutputSchema
      : undefined
    : undefined;
  states: TSetupSchema['states'] extends Record<string, SetupStateSchema>
    ? {
        [K in keyof TSetupSchema['states'] &
          string]: SetupStateSchemaToStateSchema<TSetupSchema['states'][K]>;
      }
    : undefined;
} & SetupStateSchemaMetadata<TSetupSchema>;

/** Converts the root setup states config to a StateSchema. */
type SetupStatesToStateSchema<
  TStates extends Record<string, SetupStateSchema>
> = {
  states: {
    [K in keyof TStates & string]: SetupStateSchemaToStateSchema<TStates[K]>;
  };
};

type EmptyStateSchema = {
  input: undefined;
  states: undefined;
};

type StateSchemaInput<
  TConfig extends StateSchema,
  TSetup extends StateSchema
> = TSetup extends { input: infer TInput }
  ? TInput
  : TConfig extends { input: infer TInput }
    ? TInput
    : undefined;

type StateSchemaContextSchema<
  TConfig extends StateSchema,
  TSetup extends StateSchema
> = TSetup extends { contextSchema: infer TContextSchema }
  ? TContextSchema extends StandardSchemaV1
    ? TContextSchema
    : undefined
  : TConfig extends { contextSchema: infer TContextSchema }
    ? TContextSchema extends StandardSchemaV1
      ? TContextSchema
      : undefined
    : undefined;

type StateSchemaOutputSchema<
  TConfig extends StateSchema,
  TSetup extends StateSchema
> = TSetup extends { outputSchema: infer TOutputSchema }
  ? TOutputSchema extends StandardSchemaV1
    ? TOutputSchema
    : undefined
  : TConfig extends { outputSchema: infer TOutputSchema }
    ? TOutputSchema extends StandardSchemaV1
      ? TOutputSchema
      : undefined
    : undefined;

type StateSchemaChild<
  TSetup extends StateSchema,
  K extends string
> = TSetup extends { states: infer TStates }
  ? K extends keyof TStates
    ? Cast<TStates[K], StateSchema>
    : EmptyStateSchema
  : EmptyStateSchema;

type StateMetadataField<
  TConfig,
  TSetup extends StateSchema,
  TKey extends keyof StateSchema
> =
  TConfig extends Record<TKey, infer TValue>
    ? { [K in TKey]: TValue }
    : TSetup extends Record<TKey, infer TValue>
      ? { [K in TKey]: TValue }
      : {};

type MergeStateSchemaMetadata<
  TConfig extends StateSchema,
  TSetup extends StateSchema
> = StateMetadataField<TConfig, TSetup, 'id'> &
  StateMetadataField<TConfig, TSetup, 'route'> &
  StateMetadataField<TConfig, TSetup, 'type'> &
  StateMetadataField<TConfig, TSetup, 'initial'> &
  StateMetadataField<TConfig, TSetup, 'history'> &
  StateMetadataField<TConfig, TSetup, 'target'>;

/** Adds setup-declared topology to authored config for structural validation. */
type MergeSetupConfigState<TConfig, TSetup extends StateSchema> = Omit<
  TConfig,
  'id' | 'route' | 'type' | 'initial' | 'history' | 'target' | 'states'
> &
  StateMetadataField<TConfig, TSetup, 'id'> &
  StateMetadataField<TConfig, TSetup, 'route'> &
  StateMetadataField<TConfig, TSetup, 'type'> &
  StateMetadataField<TConfig, TSetup, 'initial'> &
  StateMetadataField<TConfig, TSetup, 'history'> &
  StateMetadataField<TConfig, TSetup, 'target'> &
  (TConfig extends { states: infer TStates }
    ? TStates extends Record<string, unknown>
      ? {
          states: {
            [K in keyof TStates & string]: MergeSetupConfigState<
              TStates[K],
              StateSchemaChild<TSetup, K>
            >;
          };
        }
      : { states: TStates }
    : {});

type MergeSetupConfig<
  TConfig,
  TStates extends Record<string, SetupStateSchema>
> = MergeSetupConfigState<TConfig, SetupStatesToStateSchema<TStates>>;

type MergeStateSchema<
  TConfig extends StateSchema,
  TSetup extends StateSchema
> = Omit<TConfig, 'contextSchema' | 'input' | 'states'> & {
  contextSchema: StateSchemaContextSchema<TConfig, TSetup>;
  outputSchema: StateSchemaOutputSchema<TConfig, TSetup>;
  input: StateSchemaInput<TConfig, TSetup>;
  states: TConfig extends { states: infer TStates }
    ? TStates extends Record<string, StateSchema>
      ? {
          [K in keyof TStates & string]: MergeStateSchema<
            TStates[K],
            StateSchemaChild<TSetup, K>
          >;
        }
      : undefined
    : undefined;
} & MergeStateSchemaMetadata<TConfig, TSetup>;

type SetupMachineStateSchema<
  TConfig,
  TStateSchemas extends Record<string, SetupStateSchema>
> =
  HasExplicitSetupStateContracts<TStateSchemas> extends true
    ? MergeStateSchema<
        Cast<TConfig, StateSchema>,
        SetupStatesToStateSchema<TStateSchemas>
      >
    : Cast<TConfig, StateSchema>;

/** Machine config without setup-declared state contracts. */
type SetupMachineConfigBase<
  _TStateSchemas extends Record<string, SetupStateSchema>,
  TStateKeys extends string,
  TSchemas extends SetupSchemas,
  TContextSchema extends StandardSchemaV1,
  TEventSchemaMap extends Record<string, StandardSchemaV1>,
  TInternalEventSchemaMap extends Record<string, StandardSchemaV1>,
  TEmittedSchemaMap extends Record<string, StandardSchemaV1>,
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TMetaSchema extends StandardSchemaV1,
  TTagSchema extends StandardSchemaV1,
  TChildrenSchemaMap extends Record<string, StandardSchemaV1>,
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TDelays extends string,
  TTag extends string,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry,
  TContextRequired extends boolean,
  TRootDelays extends string = TDelays,
  TRootActionMap extends Sources['actions'] = TActionMap,
  TRootActorMap extends Sources['actors'] = TActorMap,
  TRootGuardMap extends Sources['guards'] = TGuardMap
> = Omit<
  Next_MachineConfig<
    SetupOrConfigSchema<TSchemas, 'context', TContextSchema>,
    SetupOrConfigSchemaMap<TSchemas, 'events', TEventSchemaMap>,
    SetupOrConfigSchemaMap<TSchemas, 'internalEvents', TInternalEventSchemaMap>,
    SetupOrConfigSchemaMap<TSchemas, 'emitted', TEmittedSchemaMap>,
    SetupOrConfigSchema<TSchemas, 'input', TInputSchema>,
    SetupOrConfigSchema<TSchemas, 'output', TOutputSchema>,
    SetupOrConfigSchema<TSchemas, 'meta', TMetaSchema>,
    SetupOrConfigSchema<TSchemas, 'tags', TTagSchema>,
    SetupOrConfigSchemaMap<TSchemas, 'children', TChildrenSchemaMap>,
    TContext,
    TEvent,
    TChildren,
    TDelays,
    TTag,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TContextRequired,
    TSystemRegistry
  >,
  | 'states'
  | 'initial'
  | 'on'
  | 'always'
  | 'invoke'
  | 'actions'
  | 'actors'
  | 'guards'
  | 'delays'
> & {
  actions?: TRootActionMap;
  actors?: TRootActorMap;
  guards?: TRootGuardMap & GuardSourceMap<TContext, TEvent>;
  delays?: {
    [K in TRootDelays | number]?:
      | number
      | (({
          context,
          event,
          stateNode
        }: {
          context: TContext;
          event: TEvent;
          stateNode: AnyStateNode;
        }) => number);
  };
  initial?:
    | string
    | {
        target: string;
        input?: unknown;
      }
    | undefined;
  on?: StateTransitions<
    UncheckedSetupStateSchemas,
    TContext,
    SetupContextShape<TSchemas, TContextSchema, TContext>,
    TEvent,
    TEmitted,
    TChildren,
    TMeta,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TSystemRegistry
  >;
  always?: StateTransitionConfigOrTarget<
    UncheckedSetupStateSchemas,
    TContext,
    SetupContextShape<TSchemas, TContextSchema, TContext>,
    TEvent,
    TEvent,
    TEmitted,
    TChildren,
    TMeta,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TSystemRegistry
  >;
  invoke?: SingleOrArray<
    SetupInvokeConfig<
      UncheckedSetupStateSchemas,
      TContext,
      SetupContextShape<TSchemas, TContextSchema, TContext>,
      TEvent,
      TEmitted,
      TChildren,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TSystemRegistry,
      SetupInput<TSchemas, TInputSchema>
    >
  >;
  states?: StatesWithInput<
    UncheckedSetupStateSchemas,
    UncheckedSetupStateSchemas,
    TContext,
    SetupContextShape<TSchemas, TContextSchema, TContext>,
    TEvent,
    TChildren,
    TDelays,
    TTag,
    SetupOutput<TSchemas, TOutputSchema>,
    TEmitted,
    TMeta,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TSystemRegistry,
    TStateKeys
  >;
};

/** Machine config with typed state input */
type SetupMachineConfig<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TStateKeys extends string,
  TSchemas extends SetupSchemas,
  TContextSchema extends StandardSchemaV1,
  TEventSchemaMap extends Record<string, StandardSchemaV1>,
  TInternalEventSchemaMap extends Record<string, StandardSchemaV1>,
  TEmittedSchemaMap extends Record<string, StandardSchemaV1>,
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TMetaSchema extends StandardSchemaV1,
  TTagSchema extends StandardSchemaV1,
  TChildrenSchemaMap extends Record<string, StandardSchemaV1>,
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TDelays extends string,
  TTag extends string,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry,
  TContextRequired extends boolean,
  TRootDelays extends string = TDelays,
  TRootActionMap extends Sources['actions'] = TActionMap,
  TRootActorMap extends Sources['actors'] = TActorMap,
  TRootGuardMap extends Sources['guards'] = TGuardMap
> =
  HasExplicitSetupStateContracts<TStateSchemas> extends true
    ? Omit<
        SetupMachineConfigBase<
          TStateSchemas,
          TStateKeys,
          TSchemas,
          TContextSchema,
          TEventSchemaMap,
          TInternalEventSchemaMap,
          TEmittedSchemaMap,
          TInputSchema,
          TOutputSchema,
          TMetaSchema,
          TTagSchema,
          TChildrenSchemaMap,
          TContext,
          TEvent,
          TChildren,
          TDelays,
          TTag,
          TEmitted,
          TMeta,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap,
          TSystemRegistry,
          TContextRequired,
          TRootDelays,
          TRootActionMap,
          TRootActorMap,
          TRootGuardMap
        >,
        'states' | 'initial' | 'on' | 'always' | 'invoke'
      > & {
        initial?:
          | SetupInitialStateKey<TStateSchemas, TStateKeys>
          | RootInitialTransitionWithInput<TStateSchemas, TContext, TEvent>
          | undefined;
        on?: StateTransitions<
          TStateSchemas,
          TContext,
          SetupContextShape<TSchemas, TContextSchema, TContext>,
          TEvent,
          TEmitted,
          TChildren,
          TMeta,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap,
          TSystemRegistry,
          undefined,
          RootSetupStateTarget<TStateSchemas>,
          RootSetupStateTarget<TStateSchemas>
        >;
        always?: StateTransitionConfigOrTarget<
          TStateSchemas,
          TContext,
          SetupContextShape<TSchemas, TContextSchema, TContext>,
          TEvent,
          TEvent,
          TEmitted,
          TChildren,
          TMeta,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap,
          TSystemRegistry,
          undefined,
          RootSetupStateTarget<TStateSchemas>,
          RootSetupStateTarget<TStateSchemas>
        >;
        invoke?: SingleOrArray<
          SetupInvokeConfig<
            RootSetupStateTransitionSchemas<TStateSchemas>,
            TContext,
            SetupContextShape<TSchemas, TContextSchema, TContext>,
            TEvent,
            TEmitted,
            TChildren,
            TMeta,
            TActionMap,
            TActorMap,
            TGuardMap,
            TDelayMap,
            TSystemRegistry,
            SetupInput<TSchemas, TInputSchema>
          >
        >;
        states?: StatesWithInput<
          TStateSchemas,
          TStateSchemas,
          TContext,
          SetupContextShape<TSchemas, TContextSchema, TContext>,
          TEvent,
          TChildren,
          TDelays,
          TTag,
          SetupOutput<TSchemas, TOutputSchema>,
          TEmitted,
          TMeta,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap,
          TSystemRegistry,
          TStateKeys
        >;
      }
    : SetupMachineConfigBase<
        TStateSchemas,
        TStateKeys,
        TSchemas,
        TContextSchema,
        TEventSchemaMap,
        TInternalEventSchemaMap,
        TEmittedSchemaMap,
        TInputSchema,
        TOutputSchema,
        TMetaSchema,
        TTagSchema,
        TChildrenSchemaMap,
        TContext,
        TEvent,
        TChildren,
        TDelays,
        TTag,
        TEmitted,
        TMeta,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TSystemRegistry,
        TContextRequired,
        TRootDelays,
        TRootActionMap,
        TRootActorMap,
        TRootGuardMap
      >;

/** States config type that provides typed input for known states */
type StatesWithInput<
  TRootStateSchemas extends Record<string, SetupStateSchema>,
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TContextShape,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TDelays extends string,
  TTag extends string,
  TOutput,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry,
  TStateKeys extends string = SetupStateKey<TStateSchemas>
> = {
  [K in TStateKeys]?: StateNodeConfigWithNestedInput<
    StateSchemasWithKeys<TRootStateSchemas, TStateKeys>,
    K extends keyof TStateSchemas ? TStateSchemas[K] : {},
    TContext,
    TContextShape,
    TEvent,
    TChildren,
    TDelays,
    TTag,
    TOutput,
    TEmitted,
    TMeta,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TSystemRegistry
  >;
};

/** State node config that recursively applies typed input for nested states */
type StateNodeConfigWithNestedInputBase<
  TSiblingStateSchemas extends Record<string, SetupStateSchema>,
  TStateSchema extends SetupStateSchema,
  TContext extends MachineContext,
  TContextShape,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TDelays extends string,
  TTag extends string,
  TOutput,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry
> = WithNestedStates<
  DistributiveOmit<
    Next_StateNodeConfig<
      StateContext<TStateSchema, TContext>,
      TEvent,
      TDelays,
      TTag,
      StateOutput<TStateSchema, TOutput>,
      TEmitted,
      TMeta,
      TChildren,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      StateInput<TStateSchema>,
      Record<string, unknown>,
      TSystemRegistry,
      StateCompletionOutput<TStateSchema>
    >,
    | 'on'
    | 'always'
    | 'initial'
    | 'invoke'
    | 'onDone'
    | 'onError'
    | 'onTimeout'
    | 'after'
  > & {
    initial?: TStateSchema['states'] extends Record<string, SetupStateSchema>
      ?
          | SetupStateKey<TStateSchema['states']>
          | (string & {})
          | InitialTransitionWithInput<
              TStateSchema['states'],
              StateContext<TStateSchema, TContext>,
              TEvent
            >
      :
          | string
          | {
              target: string;
              input?: Record<string, unknown>;
            }
          | undefined;
  } & {
    on?: StateTransitions<
      SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>,
      StateContext<TStateSchema, TContext>,
      StateContextShape<TStateSchema, TContextShape>,
      TEvent,
      TEmitted,
      TChildren,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TSystemRegistry,
      StateInput<TStateSchema>
    >;
    always?: StateTransitionConfigOrTarget<
      SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>,
      StateContext<TStateSchema, TContext>,
      StateContextShape<TStateSchema, TContextShape>,
      TEvent,
      TEvent,
      TEmitted,
      TChildren,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TSystemRegistry,
      StateInput<TStateSchema>
    >;
    invoke?: SingleOrArray<
      SetupInvokeConfig<
        SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>,
        StateContext<TStateSchema, TContext>,
        StateContextShape<TStateSchema, TContextShape>,
        TEvent,
        TEmitted,
        TChildren,
        TMeta,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TSystemRegistry,
        StateInput<TStateSchema>
      >
    >;
    onDone?: StateTransitionConfigOrTarget<
      SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>,
      StateContext<TStateSchema, TContext>,
      StateContextShape<TStateSchema, TContextShape>,
      DoneStateEvent<StateCompletionOutput<TStateSchema>>,
      TEvent,
      TEmitted,
      TChildren,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TSystemRegistry,
      StateInput<TStateSchema>
    >;
    onError?: StateTransitionConfigOrTarget<
      SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>,
      StateContext<TStateSchema, TContext>,
      StateContextShape<TStateSchema, TContextShape>,
      ErrorEvent,
      TEvent,
      TEmitted,
      TChildren,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TSystemRegistry,
      StateInput<TStateSchema>
    >;
    onTimeout?: StateTransitionConfigOrTarget<
      SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>,
      StateContext<TStateSchema, TContext>,
      StateContextShape<TStateSchema, TContextShape>,
      TimeoutEvent,
      TEvent,
      TEmitted,
      TChildren,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TSystemRegistry,
      StateInput<TStateSchema>
    >;
    after?: {
      [K in NoInfer<TDelays> | number]?: StateTransitionConfigOrTarget<
        SetupStateTransitionSchemas<TSiblingStateSchemas, TStateSchema>,
        StateContext<TStateSchema, TContext>,
        StateContextShape<TStateSchema, TContextShape>,
        AfterEvent,
        TEvent,
        TEmitted,
        TChildren,
        TMeta,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TSystemRegistry,
        StateInput<TStateSchema>
      >;
    };
  },
  TStateSchema['states'] extends Record<string, SetupStateSchema>
    ? StatesWithInput<
        SetupStateSchemasWithParentType<
          WithRootSetupStateSchemas<
            TStateSchema['states'],
            RootSetupStateSchemas<TSiblingStateSchemas>
          >,
          TStateSchema extends { type: infer TType extends SetupStateType }
            ? TType
            : never
        >,
        TStateSchema['states'],
        TContext,
        StateContextShape<TStateSchema, TContextShape>,
        TEvent,
        TChildren,
        TDelays,
        TTag,
        TOutput,
        TEmitted,
        TMeta,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TSystemRegistry
      >
    : {
        [K in string]?: Next_StateNodeConfig<
          TContext,
          TEvent,
          TDelays,
          TTag,
          TOutput,
          TEmitted,
          TMeta,
          TChildren,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap,
          undefined,
          Record<string, unknown>,
          TSystemRegistry
        >;
      }
>;

type StateNodeConfigWithNestedInput<
  TSiblingStateSchemas extends Record<string, SetupStateSchema>,
  TStateSchema extends SetupStateSchema,
  TContext extends MachineContext,
  TContextShape,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TDelays extends string,
  TTag extends string,
  TOutput,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry
> = SetupStateNodeContract<
  TStateSchema,
  StateNodeConfigWithNestedInputBase<
    TSiblingStateSchemas,
    TStateSchema,
    TContext,
    TContextShape,
    TEvent,
    TChildren,
    TDelays,
    TTag,
    TOutput,
    TEmitted,
    TMeta,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TSystemRegistry
  >,
  TContext,
  TEvent,
  TSiblingStateSchemas
>;

type StateTransitions<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TContextShape,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TMeta extends MetaObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry,
  TInput = undefined,
  TTarget extends string = SetupStateTarget<TStateSchemas>,
  TKnownTarget extends string = KnownSetupStateTarget<TStateSchemas>
> = {
  [K in EventDescriptor<TEvent>]?: StateTransitionConfigOrTarget<
    TStateSchemas,
    TContext,
    TContextShape,
    ExtractEvent<TEvent, K>,
    TEvent,
    TEmitted,
    TChildren,
    TMeta,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TSystemRegistry,
    TInput,
    TTarget,
    TKnownTarget
  >;
};

type InvokeDoneEvent<TInvoke> = TInvoke extends {
  onDone?: Next_TransitionConfigOrTarget<
    infer _TContext,
    infer TDoneEvent,
    infer _TEvent,
    infer _TEmitted,
    infer _TActionMap,
    infer _TActorMap,
    infer _TGuardMap,
    infer _TDelayMap,
    infer _TMeta
  >;
}
  ? Cast<TDoneEvent, EventObject>
  : DoneActorEvent;

type SetupInvokeConfig<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TContextShape,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TMeta extends MetaObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry,
  TStateInput = undefined
> =
  Next_InvokeConfig<
    TContext,
    TEvent,
    TEmitted,
    TChildren,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TMeta,
    TSystemRegistry,
    TStateInput
  > extends infer TInvoke
    ? TInvoke extends any
      ? DistributiveOmit<
          TInvoke,
          'onDone' | 'onError' | 'onSnapshot' | 'onTimeout'
        > & {
          // Inline (unregistered-logic) invoke branches have no function-form
          // `onDone` when actors are registered (see InlineInvokeOnDone), and
          // that must be preserved when rebuilding `onDone` here: when a
          // registered logic value is passed as `src`, TypeScript narrows the
          // invoke union to the matching registered branch plus the inline
          // branch, and contextual typing of `onDone` callbacks (and their
          // per-actor `event.output`) only works if the registered branch
          // provides the union's only call signature.
          onDone?: TInvoke extends {
            onDone?: infer TOnDone;
          }
            ? [
                Extract<NonNullable<TOnDone>, (...args: any[]) => unknown>
              ] extends [never]
              ?
                  | undefined
                  | StateTransitionObjectConfig<
                      TStateSchemas,
                      TContext,
                      TContextShape,
                      DoneActorEvent,
                      TChildren,
                      TMeta,
                      TActionMap,
                      TActorMap,
                      TGuardMap,
                      TDelayMap,
                      TSystemRegistry,
                      false
                    >
              : StateTransitionConfigOrTarget<
                  TStateSchemas,
                  TContext,
                  TContextShape,
                  InvokeDoneEvent<TInvoke>,
                  TEvent,
                  TEmitted,
                  TChildren,
                  TMeta,
                  TActionMap,
                  TActorMap,
                  TGuardMap,
                  TDelayMap,
                  TSystemRegistry
                >
            : never;
          onError?: StateTransitionConfigOrTarget<
            TStateSchemas,
            TContext,
            TContextShape,
            ErrorActorEvent,
            TEvent,
            TEmitted,
            TChildren,
            TMeta,
            TActionMap,
            TActorMap,
            TGuardMap,
            TDelayMap,
            TSystemRegistry
          >;
          onSnapshot?: StateTransitionConfigOrTarget<
            TStateSchemas,
            TContext,
            TContextShape,
            SnapshotEvent<any>,
            TEvent,
            TEmitted,
            TChildren,
            TMeta,
            TActionMap,
            TActorMap,
            TGuardMap,
            TDelayMap,
            TSystemRegistry
          >;
          onTimeout?: StateTransitionConfigOrTarget<
            TStateSchemas,
            TContext,
            TContextShape,
            TEvent,
            TEvent,
            TEmitted,
            TChildren,
            TMeta,
            TActionMap,
            TActorMap,
            TGuardMap,
            TDelayMap,
            TSystemRegistry
          >;
        }
      : never
    : never;

type StateTransitionConfigOrTarget<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TContextShape,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TMeta extends MetaObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry,
  TInput = undefined,
  TTarget extends string = SetupStateTarget<TStateSchemas>,
  TKnownTarget extends string = KnownSetupStateTarget<TStateSchemas>
> =
  | undefined
  | StateTransitionObjectConfig<
      TStateSchemas,
      TContext,
      TContextShape,
      TExpressionEvent,
      TChildren,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TSystemRegistry,
      true,
      TTarget,
      TKnownTarget
    >
  | StateTransitionFunction<
      TStateSchemas,
      TContext,
      TContextShape,
      TExpressionEvent,
      TEvent,
      TEmitted,
      TChildren,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TSystemRegistry,
      TInput,
      TTarget,
      TKnownTarget
    >;

type StateTransitionObjectConfig<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TContextShape,
  TExpressionEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TMeta extends MetaObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry,
  TAllowContextMapper extends boolean = true,
  TTarget extends string = SetupStateTarget<TStateSchemas>,
  TKnownTarget extends string = KnownSetupStateTarget<TStateSchemas>
> =
  | (StateTransitionResult<
      TStateSchemas,
      TContext,
      TContextShape,
      TMeta,
      TExpressionEvent,
      TChildren,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TSystemRegistry,
      TAllowContextMapper,
      TTarget,
      TKnownTarget
    > & {
      description?: string;
    })
  | {
      target: TTarget[];
      context?: StateTransitionContext<
        TAllowContextMapper,
        TContext,
        TContextShape,
        TContextShape,
        TContext,
        TExpressionEvent,
        TChildren,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TSystemRegistry
      >;
      description?: string;
      reenter?: boolean;
      meta?: TMeta;
      input?:
        | Record<string, unknown>
        | ((
            args: {
              context: TContext;
              event: TExpressionEvent;
            } & OutputArg<TExpressionEvent>
          ) => Record<string, unknown>);
    };

type StateTransitionContextMapper<
  TContext extends MachineContext,
  TContextShape,
  TTargetContextShape,
  TResolvedTargetContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry
> = (
  args: {
    context: TContext;
    event: TExpressionEvent;
    self: AnyActorRef;
    parent: AnyActorRef | undefined;
    value: StateValue;
    children: TChildren;
    system: SystemRuntime<TSystemRegistry>;
    actions: TActionMap;
    actors: TActorMap;
    guards: TGuardMap;
    delays: TDelayMap;
  } & OutputArg<TExpressionEvent>
) => ContextPatch<TContextShape, TTargetContextShape, TResolvedTargetContext>;

type StateTransitionContextOrMapper<
  TContext extends MachineContext,
  TContextShape,
  TTargetContextShape,
  TResolvedTargetContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry
> =
  | ContextPatch<TContextShape, TTargetContextShape, TResolvedTargetContext>
  | StateTransitionContextMapper<
      TContext,
      TContextShape,
      TTargetContextShape,
      TResolvedTargetContext,
      TExpressionEvent,
      TChildren,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TSystemRegistry
    >;

type StateTransitionContext<
  TAllowMapper extends boolean,
  TContext extends MachineContext,
  TContextShape,
  TTargetContextShape,
  TResolvedTargetContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry
> = TAllowMapper extends true
  ? StateTransitionContextOrMapper<
      TContext,
      TContextShape,
      TTargetContextShape,
      TResolvedTargetContext,
      TExpressionEvent,
      TChildren,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TSystemRegistry
    >
  : ContextPatch<TContextShape, TTargetContextShape, TResolvedTargetContext>;

type StateTransitionFunction<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TContextShape,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TMeta extends MetaObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry,
  TInput = undefined,
  TTarget extends string = SetupStateTarget<TStateSchemas>,
  TKnownTarget extends string = KnownSetupStateTarget<TStateSchemas>
> = (
  args: {
    context: TContext;
    event: TExpressionEvent;
    self: AnyActorRef;
    parent: AnyActorRef | undefined;
    value: StateValue;
    children: TChildren;
    system: SystemRuntime<TSystemRegistry>;
    actions: TActionMap;
    actors: TActorMap;
    guards: TGuardMap;
    delays: TDelayMap;
    input: TInput;
  } & OutputArg<TExpressionEvent>,
  enq: EnqueueObject<TEvent, TEmitted, TSystemRegistry, TActorMap>
) => StateTransitionResult<
  TStateSchemas,
  TContext,
  TContextShape,
  TMeta,
  TExpressionEvent,
  TChildren,
  TActionMap,
  TActorMap,
  TGuardMap,
  TDelayMap,
  TSystemRegistry,
  false,
  TTarget,
  TKnownTarget
> | void;

type StateTransitionResult<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TContextShape,
  TMeta extends MetaObject,
  TExpressionEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TSystemRegistry extends SystemRegistry,
  TAllowContextMapper extends boolean,
  TTarget extends string = SetupStateTarget<TStateSchemas>,
  TKnownTarget extends string = KnownSetupStateTarget<TStateSchemas>
> =
  | {
      target?: never;
      context?: StateTransitionContext<
        TAllowContextMapper,
        TContext,
        TContextShape,
        TContextShape,
        TContext,
        TExpressionEvent,
        TChildren,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TSystemRegistry
      >;
      reenter?: boolean;
      meta?: TMeta;
    }
  | {
      [K in TKnownTarget]: {
        target: K;
        reenter?: boolean;
        meta?: TMeta;
      } & SetupStateInputConfig<
        SetupStateSchemaAtTarget<TStateSchemas, K>,
        TContext,
        TExpressionEvent,
        {
          context: TContext;
          event: TExpressionEvent;
        } & OutputArg<TExpressionEvent>
      > &
        ([TContextShape] extends [
          StateContextShape<
            SetupStateSchemaAtTarget<TStateSchemas, K>,
            TContextShape
          >
        ]
          ? {
              context?: StateTransitionContext<
                TAllowContextMapper,
                TContext,
                TContextShape,
                StateContextShape<
                  SetupStateSchemaAtTarget<TStateSchemas, K>,
                  TContextShape
                >,
                StateContext<
                  SetupStateSchemaAtTarget<TStateSchemas, K>,
                  TContext
                >,
                TExpressionEvent,
                TChildren,
                TActionMap,
                TActorMap,
                TGuardMap,
                TDelayMap,
                TSystemRegistry
              >;
            }
          : {
              context: StateTransitionContext<
                TAllowContextMapper,
                TContext,
                TContextShape,
                StateContextShape<
                  SetupStateSchemaAtTarget<TStateSchemas, K>,
                  TContextShape
                >,
                StateContext<
                  SetupStateSchemaAtTarget<TStateSchemas, K>,
                  TContext
                >,
                TExpressionEvent,
                TChildren,
                TActionMap,
                TActorMap,
                TGuardMap,
                TDelayMap,
                TSystemRegistry
              >;
            });
    }[TKnownTarget]
  | {
      target: TStateSchemas extends {
        readonly [strictSetupStateTargets]: true;
      }
        ? never
        : Exclude<TTarget, TKnownTarget>;
      context?: StateTransitionContext<
        TAllowContextMapper,
        TContext,
        TContextShape,
        TContextShape,
        TContext,
        TExpressionEvent,
        TChildren,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TSystemRegistry
      >;
      reenter?: boolean;
      meta?: TMeta;
    };

type ContextPatch<
  TCurrentContext,
  TTargetContext,
  TResolvedTargetContext extends MachineContext
> = Compute<
  Partial<TResolvedTargetContext> &
    Pick<
      TResolvedTargetContext,
      Extract<RequiredContextKeys<TCurrentContext, TTargetContext>, string>
    > & {
      call?: never;
      apply?: never;
      bind?: never;
    }
>;

type RequiredContextKeys<TCurrentContext, TTargetContext> = {
  [K in keyof TTargetContext]-?: K extends keyof TCurrentContext
    ? [TCurrentContext[K]] extends [TTargetContext[K]]
      ? never
      : K
    : K;
}[keyof TTargetContext];

/** Initial transition with typed input based on target state */
type SetupInitialStateKey<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TStateKeys extends string
> = {
  [K in TStateKeys]: K extends keyof TStateSchemas
    ? TStateSchemas[K] extends { type: SetupStateType }
      ? RequiresStateInput<TStateSchemas[K]> extends true
        ? never
        : K
      : K
    : K;
}[TStateKeys];

type InitialTransitionWithInput<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in keyof TStateSchemas & string]: {
    target: K;
  } & SetupStateInputConfig<TStateSchemas[K], TContext, TEvent>;
}[keyof TStateSchemas & string];

type RootInitialTransitionWithInput<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TEvent extends EventObject
> =
  | InitialTransitionWithInput<TStateSchemas, TContext, TEvent>
  | {
      [K in RootSetupStateIdTarget<TStateSchemas>]: {
        target: K;
      } & SetupStateInputConfig<
        SetupStateSchemaAtTarget<TStateSchemas, K>,
        TContext,
        TEvent
      >;
    }[RootSetupStateIdTarget<TStateSchemas>];

/** Return type of setup() */
export interface SetupReturn<
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
  TSystemRegistry extends SystemRegistry = SystemRegistry,
  TValidator extends ActorLogicValidator | undefined = undefined
> {
  /** Extends the setup configuration */
  extend<
    const TExtendSchemas extends SetupSchemas = {},
    const TExtendStates extends Record<string, SetupStateSchema> = {},
    TExtendActionMap extends Sources['actions'] = {},
    TExtendActorMap extends Sources['actors'] = {},
    TExtendGuardMap extends Sources['guards'] = {},
    TExtendDelayMap extends Sources['delays'] = {},
    const TExtendValidator extends
      | ActorLogicValidator
      | undefined
      | InheritedValidator = InheritedValidator
  >(
    config: SetupExtensionConfig<
      TSchemas,
      TStates,
      TValidator,
      TExtendSchemas,
      TExtendStates,
      TExtendActionMap,
      TExtendActorMap,
      TExtendGuardMap,
      TExtendDelayMap,
      TExtendValidator
    >
  ): SetupReturn<
    MergeSetupStateSchemas<TStates, TExtendStates>,
    MergeSourceMaps<TSchemas, TExtendSchemas>,
    MergeSourceMaps<TSetupActionMap, TExtendActionMap>,
    MergeSourceMaps<TSetupActorMap, TExtendActorMap>,
    MergeSourceMaps<TSetupGuardMap, TExtendGuardMap>,
    MergeSourceMaps<TSetupDelayMap, TExtendDelayMap>,
    TSetupDelays | Extract<keyof TExtendDelayMap, string>,
    TSystemRegistry,
    ResolveExtendedValidator<TValidator, TExtendValidator>
  >;

  /** Creates a state machine with the setup configuration */
  createMachine<
    TContextSchema extends StandardSchemaV1 = StandardSchemaV1,
    const TEventSchemaMap extends Record<string, StandardSchemaV1> = Record<
      string,
      StandardSchemaV1
    >,
    const TInternalEventSchemaMap extends Record<string, StandardSchemaV1> = {},
    TEmittedSchemaMap extends Record<string, StandardSchemaV1> = Record<
      string,
      StandardSchemaV1
    >,
    TInputSchema extends StandardSchemaV1 = StandardSchemaV1,
    TOutputSchema extends StandardSchemaV1 = StandardSchemaV1,
    TMetaSchema extends StandardSchemaV1 = StandardSchemaV1,
    TTagSchema extends StandardSchemaV1 = StandardSchemaV1,
    const TChildrenSchemaMap extends Record<string, StandardSchemaV1> = Record<
      string,
      StandardSchemaV1
    >,
    const TActionSchemaMap extends ActionSchemas = {},
    const TGuardSchemaMap extends GuardSchemas = {},
    _TEvent extends EventObject = EventObject,
    TActor extends ProvidedActor = ProvidedActor,
    TActionMap extends Sources['actions'] = {},
    TActorMap extends Sources['actors'] = {},
    TGuardMap extends Sources['guards'] = {},
    TDelayMap extends Sources['delays'] = {},
    TDelays extends string = Extract<keyof TDelayMap, string>,
    TTag extends SetupTags<TSchemas, TTagSchema> = SetupTags<
      TSchemas,
      TTagSchema
    >,
    TInput = unknown,
    const TStateKeys extends string = SetupStateKey<TStates>,
    TConfig extends SetupMachineConfig<
      TStates,
      TStateKeys,
      TSchemas,
      TContextSchema,
      TEventSchemaMap,
      TInternalEventSchemaMap,
      TEmittedSchemaMap,
      TInputSchema,
      TOutputSchema,
      TMetaSchema,
      TTagSchema,
      TChildrenSchemaMap,
      SetupContext<TSchemas, TContextSchema>,
      SetupEvents<TSchemas, TEventSchemaMap, TInternalEventSchemaMap>,
      Cast<
        MergeChildren<SetupChildren<TSchemas, TChildrenSchemaMap>, TActor>,
        Record<string, AnyActorRef | undefined>
      >,
      TSetupDelays | TDelays,
      TTag,
      SetupEmitted<TSchemas, TEmittedSchemaMap>,
      SetupMeta<TSchemas, TMetaSchema>,
      MergeSourceMaps<
        SetupActions<TSchemas, TSetupActionMap>,
        MergeSourceMaps<InferActions<TActionSchemaMap>, TActionMap>
      >,
      MergeSourceMaps<TSetupActorMap, TActorMap>,
      MergeSourceMaps<
        SetupGuards<TSchemas, TSetupGuardMap>,
        MergeSourceMaps<InferGuards<TGuardSchemaMap>, TGuardMap>
      >,
      MergeSourceMaps<TSetupDelayMap, TDelayMap>,
      TSystemRegistry,
      SetupContextRequired<TSchemas, TContextSchema>,
      TDelays,
      TActionMap,
      TActorMap,
      TGuardMap
    > = SetupMachineConfig<
      TStates,
      TStateKeys,
      TSchemas,
      TContextSchema,
      TEventSchemaMap,
      TInternalEventSchemaMap,
      TEmittedSchemaMap,
      TInputSchema,
      TOutputSchema,
      TMetaSchema,
      TTagSchema,
      TChildrenSchemaMap,
      SetupContext<TSchemas, TContextSchema>,
      SetupEvents<TSchemas, TEventSchemaMap, TInternalEventSchemaMap>,
      Cast<
        MergeChildren<SetupChildren<TSchemas, TChildrenSchemaMap>, TActor>,
        Record<string, AnyActorRef | undefined>
      >,
      TSetupDelays | TDelays,
      TTag,
      SetupEmitted<TSchemas, TEmittedSchemaMap>,
      SetupMeta<TSchemas, TMetaSchema>,
      MergeSourceMaps<
        SetupActions<TSchemas, TSetupActionMap>,
        MergeSourceMaps<InferActions<TActionSchemaMap>, TActionMap>
      >,
      MergeSourceMaps<TSetupActorMap, TActorMap>,
      MergeSourceMaps<
        SetupGuards<TSchemas, TSetupGuardMap>,
        MergeSourceMaps<InferGuards<TGuardSchemaMap>, TGuardMap>
      >,
      MergeSourceMaps<TSetupDelayMap, TDelayMap>,
      TSystemRegistry,
      SetupContextRequired<TSchemas, TContextSchema>,
      TDelays,
      TActionMap,
      TActorMap,
      TGuardMap
    >
  >(
    config: {
      schemas?: {
        events?: TEventSchemaMap;
        internalEvents?: TInternalEventSchemaMap;
        context?: TContextSchema;
        emitted?: TEmittedSchemaMap;
        actions?: TActionSchemaMap;
        guards?: TGuardSchemaMap;
        input?: TInputSchema;
        output?: TOutputSchema;
        meta?: TMetaSchema;
        tags?: TTagSchema;
        children?: TChildrenSchemaMap;
      } & ([TValidator] extends [ActorLogicValidator]
        ? ValidateSetupSchemas<
            InlineMachineSchemas<
              TContextSchema,
              TEventSchemaMap,
              TInternalEventSchemaMap,
              TEmittedSchemaMap,
              TActionSchemaMap,
              TGuardSchemaMap,
              TInputSchema,
              TOutputSchema,
              TMetaSchema,
              TTagSchema,
              TChildrenSchemaMap
            >
          >
        : unknown);
      actions?: TActionMap;
      actors?: TActorMap;
      guards?: TGuardMap;
      delays?: TDelayMap;
      states?: Record<TStateKeys, unknown>;
    } & TConfig &
      RuntimeValidationConstraint<
        NoInfer<MachineConfigSchemas<TConfig>>,
        NoInfer<MachineConfigStates<TConfig>>,
        TValidator
      > &
      ValidateSetupDelayReferences<TConfig, TSetupDelays> &
      ValidateSetupStateContracts<TConfig, TStates> &
      ValidateRegistryKeys<
        TConfig,
        TSystemRegistry,
        MergeSourceMaps<TSetupActorMap, TActorMap>
      >
  ): StateMachine<
    SetupContext<TSchemas, TContextSchema>,
    | SetupEvents<TSchemas, TEventSchemaMap, TInternalEventSchemaMap>
    | ([RoutableStateId<SetupMachineStateSchema<TConfig, TStates>>] extends [
        never
      ]
        ? never
        : {
            type: 'xstate.route';
            to: RoutableStateId<SetupMachineStateSchema<TConfig, TStates>>;
          }),
    Cast<
      MergeChildren<SetupChildren<TSchemas, TChildrenSchemaMap>, TActor>,
      Record<string, AnyActorRef | undefined>
    >,
    StateValueFromStateSchema<SetupMachineStateSchema<TConfig, TStates>>,
    TTag & string,
    [SetupSchema<TSchemas, 'input'>] extends [never]
      ? TInput
      : SetupInput<TSchemas, TInputSchema>,
    SetupOrConfigOutput<TSchemas, TOutputSchema, TConfig>,
    SetupEmitted<TSchemas, TEmittedSchemaMap>,
    SetupMeta<TSchemas, TMetaSchema>,
    SetupMachineStateSchema<TConfig, TStates>,
    MergeSourceMaps<
      SetupActions<TSchemas, TSetupActionMap>,
      MergeSourceMaps<InferActions<TActionSchemaMap>, TActionMap>
    >,
    MergeSourceMaps<TSetupActorMap, TActorMap>,
    MergeSourceMaps<
      SetupGuards<TSchemas, TSetupGuardMap>,
      MergeSourceMaps<InferGuards<TGuardSchemaMap>, TGuardMap>
    >,
    DelayMapFromNames<
      TSetupDelays | TDelays,
      MergeSourceMaps<TSetupDelayMap, TDelayMap>
    >,
    SetupInternalEvents<TSchemas, TInternalEventSchemaMap>
  > &
    MachineIdentity<TConfig>;

  /**
   * Creates a state node config bound to a specific setup-declared state,
   * addressed by a dotted path (e.g. `'loading'` or `'parent.child'`). The
   * addressed state's own `input` schema is typed inside `entry`/`exit` args.
   */
  createStateConfig<
    const TPath extends StatePaths<TStates>,
    const TConfig extends SetupStateNodeConfig<
      StrictSetupStateSchemas<
        ResolveStateSiblingsForPath<TStates, TPath>,
        SetupStateTransitionChildSchemas<ResolveStatePath<TStates, TPath>>,
        TStates,
        SetupStateSelfSchema<ResolveStatePath<TStates, TPath>>
      >,
      ResolveStatePath<TStates, TPath>,
      TSchemas,
      TSetupActionMap,
      TSetupActorMap,
      TSetupGuardMap,
      TSetupDelayMap,
      TSystemRegistry
    >
  >(
    path: TPath,
    config: TConfig &
      NoInfer<
        SetupStateNodeTargetArrayInputConstraint<
          TConfig,
          StrictSetupStateSchemas<
            ResolveStateSiblingsForPath<TStates, TPath>,
            SetupStateTransitionChildSchemas<ResolveStatePath<TStates, TPath>>,
            TStates,
            SetupStateSelfSchema<ResolveStatePath<TStates, TPath>>
          >,
          ResolveStatePath<TStates, TPath>,
          SetupStateChildSchemas<ResolveStatePath<TStates, TPath>>
        >
      > &
      NoInfer<SetupStateTargetSetLegality<TConfig, TStates, TPath>> &
      ValidateSetupHistoryStateInput<
        TConfig,
        ResolveStatePath<TStates, TPath>,
        WithRootSetupStateSchemas<
          ResolveStateSiblingsForPath<TStates, TPath>,
          TStates
        >
      >
  ): TConfig;

  /** Creates a state node config with the setup configuration */
  createStateConfig<
    const TConfig extends SetupStateNodeConfig<
      TStates,
      SetupStateSchema,
      TSchemas,
      TSetupActionMap,
      TSetupActorMap,
      TSetupGuardMap,
      TSetupDelayMap,
      TSystemRegistry
    >
  >(
    config: TConfig
  ): TConfig;

  /** State input schemas from setup config */
  states: TStates;

  /** Schemas from setup config */
  schemas: TSchemas;
}

type SetupConfigSchemas<TConfig> = TConfig extends { schemas?: infer TSchemas }
  ? TSchemas extends SetupSchemas
    ? TSchemas
    : {}
  : {};

type SetupConfigStates<TConfig> = TConfig extends { states?: infer TStates }
  ? TStates extends Record<string, SetupStateSchema>
    ? TStates
    : Record<string, SetupStateSchema>
  : Record<string, SetupStateSchema>;

type SetupConfigActions<TConfig> = TConfig extends { actions?: infer TActions }
  ? TActions extends Sources['actions']
    ? MergeSourceMaps<SetupActions<SetupConfigSchemas<TConfig>, {}>, TActions>
    : SetupActions<SetupConfigSchemas<TConfig>, {}>
  : SetupActions<SetupConfigSchemas<TConfig>, {}>;

type SetupConfigActors<TConfig> = TConfig extends {
  actors?: infer TActors;
}
  ? TActors extends Sources['actors']
    ? TActors
    : {}
  : {};

type SetupConfigGuards<TConfig> = TConfig extends { guards?: infer TGuards }
  ? TGuards extends Sources['guards']
    ? MergeSourceMaps<SetupGuards<SetupConfigSchemas<TConfig>, {}>, TGuards>
    : SetupGuards<SetupConfigSchemas<TConfig>, {}>
  : SetupGuards<SetupConfigSchemas<TConfig>, {}>;

type SetupConfigDelays<TConfig> = TConfig extends { delays?: infer TDelays }
  ? TDelays extends Sources['delays']
    ? TDelays
    : {}
  : {};

export type SetupReturnFromConfig<
  TConfig extends AnySetupConfig,
  TSystemRegistry extends SystemRegistry = SystemRegistry
> = SetupReturn<
  SetupConfigStates<TConfig>,
  SetupConfigSchemas<TConfig>,
  SetupConfigActions<TConfig>,
  SetupConfigActors<TConfig>,
  SetupConfigGuards<TConfig>,
  SetupConfigDelays<TConfig>,
  Extract<keyof SetupConfigDelays<TConfig>, string>,
  TSystemRegistry,
  TConfig extends { validator: infer TValidator extends ActorLogicValidator }
    ? TValidator
    : undefined
>;

type SetupFunction<TSystemRegistry extends SystemRegistry = SystemRegistry> = {
  (): SetupReturn<
    Record<string, SetupStateSchema>,
    {},
    {},
    {},
    {},
    {},
    never,
    TSystemRegistry
  >;
  <
    const TSchemas extends SetupSchemas = {},
    const TStates extends Record<string, SetupStateSchema> = Record<
      string,
      SetupStateSchema
    >,
    TActionMap extends Sources['actions'] = {},
    TActorMap extends Sources['actors'] = {},
    TGuardMap extends Sources['guards'] = {},
    TDelayMap extends Sources['delays'] = {},
    const TValidator extends ActorLogicValidator | undefined = undefined
  >(
    config: SetupConfig<
      TSchemas,
      TStates,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TValidator
    > &
      RuntimeValidationConstraint<
        NoInfer<TSchemas>,
        NoInfer<TStates>,
        TValidator
      >
  ): SetupReturn<
    TStates,
    TSchemas,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    Extract<keyof TDelayMap, string>,
    TSystemRegistry,
    TValidator
  >;
  <const TConfig extends AnySetupConfig>(
    config: TConfig &
      SetupSourceCompanions<SetupConfigSchemas<TConfig>> &
      RuntimeValidationConstraint<
        NoInfer<SetupConfigSchemas<TConfig>>,
        NoInfer<SetupConfigStates<TConfig>>,
        TConfig extends { validator: infer TValidator } ? TValidator : undefined
      >
  ): SetupReturnFromConfig<TConfig, TSystemRegistry>;
};

/**
 * Sets up a state machine with state input schemas and other configuration.
 *
 * @example
 *
 * ```ts
 * import { setup } from 'xstate';
 * import z from 'zod';
 *
 * const s = setup({
 *   states: {
 *     loading: {
 *       schemas: {
 *         input: z.object({
 *           userId: z.string()
 *         })
 *       }
 *     }
 *   }
 * });
 *
 * const machine = s.createMachine({
 *   initial: {
 *     target: 'loading',
 *     input: { userId: '123' }
 *   },
 *   states: {
 *     loading: {
 *       entry: ({ input }) => {
 *         console.log(input.userId);
 *       }
 *     }
 *   }
 * });
 * ```
 */
export const setup = function setupImplementation<
  const TSchemas extends SetupSchemas = {},
  const TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >,
  TActionMap extends Sources['actions'] = {},
  TActorMap extends Sources['actors'] = {},
  TGuardMap extends Sources['guards'] = {},
  TDelayMap extends Sources['delays'] = {},
  TValidator extends ActorLogicValidator | undefined =
    | ActorLogicValidator
    | undefined
>(
  config: SetupConfig<
    TSchemas,
    TStates,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TValidator
  > = {}
): SetupReturn<
  TStates,
  TSchemas,
  TActionMap,
  TActorMap,
  TGuardMap,
  TDelayMap,
  Extract<keyof TDelayMap, string>,
  SystemRegistry,
  TValidator
> {
  const {
    validator,
    states = {} as TStates,
    schemas,
    actions,
    actors,
    guards,
    delays
  } = config;

  return {
    extend<
      const TExtendSchemas extends SetupSchemas = {},
      const TExtendStates extends Record<string, SetupStateSchema> = {},
      TExtendActionMap extends Sources['actions'] = {},
      TExtendActorMap extends Sources['actors'] = {},
      TExtendGuardMap extends Sources['guards'] = {},
      TExtendDelayMap extends Sources['delays'] = {},
      const TExtendValidator extends
        | ActorLogicValidator
        | undefined
        | InheritedValidator = InheritedValidator
    >(
      extension: SetupExtensionConfig<
        TSchemas,
        TStates,
        TValidator,
        TExtendSchemas,
        TExtendStates,
        TExtendActionMap,
        TExtendActorMap,
        TExtendGuardMap,
        TExtendDelayMap,
        TExtendValidator
      >
    ) {
      return setup(
        mergeSetupConfigs(config, extension as AnySetupConfig) as any
      ) as unknown as SetupReturn<
        MergeSetupStateSchemas<TStates, TExtendStates>,
        MergeSourceMaps<TSchemas, TExtendSchemas>,
        MergeSourceMaps<TActionMap, TExtendActionMap>,
        MergeSourceMaps<TActorMap, TExtendActorMap>,
        MergeSourceMaps<TGuardMap, TExtendGuardMap>,
        MergeSourceMaps<TDelayMap, TExtendDelayMap>,
        | Extract<keyof TDelayMap, string>
        | Extract<keyof TExtendDelayMap, string>,
        SystemRegistry,
        ResolveExtendedValidator<TValidator, TExtendValidator>
      >;
    },
    createMachine(machineConfig) {
      const configSchemas = machineConfig.schemas;
      const mergedSchemas = mergeSchemas(configSchemas, schemas);
      const mergedStates = mergeStateSchemas(machineConfig.states, states);
      const mergedActions = mergeMaps(actions, machineConfig.actions);
      const mergedActors = mergeMaps(actors, machineConfig.actors);
      const mergedGuards = mergeMaps(guards, machineConfig.guards);
      const mergedDelays = mergeMaps(delays, machineConfig.delays);

      return new StateMachine(
        {
          ...machineConfig,
          ...(mergedSchemas ? { schemas: mergedSchemas } : undefined),
          ...(mergedStates ? { states: mergedStates } : undefined),
          ...(mergedActions ? { actions: mergedActions } : undefined),
          ...(mergedActors ? { actors: mergedActors } : undefined),
          ...(mergedGuards ? { guards: mergedGuards } : undefined),
          ...(mergedDelays ? { delays: mergedDelays } : undefined)
        } as any,
        undefined,
        validator
      ) as any;
    },
    createStateConfig(...args: unknown[]) {
      return args.length > 1 ? args[1] : args[0];
    },
    states,
    schemas: schemas ?? ({} as TSchemas)
  };
} as SetupFunction;

type SystemBuilder<TSystemRegistry extends SystemRegistry> = {
  createActor<TLogic extends AnyActorLogic>(
    logic: TLogic,
    options?: Omit<ActorOptions<TLogic>, 'registryKey'> & {
      registryKey?: RegistryKeyForLogic<TLogic, TSystemRegistry>;
    } & {
      [K in RequiredActorOptionsKeys<TLogic>]: unknown;
    }
  ): Actor<TLogic>;
  get: SystemRuntime<TSystemRegistry>['get'];
  getAll: SystemRuntime<TSystemRegistry>['getAll'];
  inspect(
    observer:
      | Observer<InspectionEvent>
      | ((inspectionEvent: InspectionEvent) => void)
  ): Subscription;
  setup: SetupFunction<TSystemRegistry>;
};

export function createSystem<const TSystemRegistry extends SystemRegistry = {}>(
  _config: SystemConfig<TSystemRegistry> = {}
): SystemBuilder<TSystemRegistry> {
  const runtimeRef: { current?: AnyActorSystem } = {};
  const pendingObservers: Array<{
    observer: Parameters<AnyActorSystem['inspect']>[0];
    subscription?: Subscription;
    active: boolean;
  }> = [];

  const flushObservers = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    for (const entry of pendingObservers) {
      if (entry.active && !entry.subscription) {
        entry.subscription = runtime.inspect(entry.observer);
      }
    }
  };

  return {
    createActor(logic, options) {
      const actor = createActorFromLogic(logic, {
        ...options,
        _systemRef: runtimeRef
      } as any);
      flushObservers();
      return actor as any;
    },
    get(key) {
      return runtimeRef.current?.get(key as any);
    },
    getAll() {
      return (runtimeRef.current?.getAll() ?? {}) as Partial<
        SystemActorMap<TSystemRegistry>
      >;
    },
    inspect(observer) {
      const runtime = runtimeRef.current;

      if (runtime) {
        return runtime.inspect(observer as any);
      }

      const entry: (typeof pendingObservers)[number] = {
        observer: observer as Parameters<AnyActorSystem['inspect']>[0],
        active: true
      };
      pendingObservers.push(entry);

      return {
        unsubscribe() {
          entry.active = false;
          entry.subscription?.unsubscribe();
        }
      };
    },
    setup: setup as SetupFunction<TSystemRegistry>
  };
}

function mergeMaps<TLeft, TRight>(
  left: TLeft | undefined,
  right: TRight | undefined
): (TLeft & TRight) | undefined {
  return left || right ? ({ ...left, ...right } as TLeft & TRight) : undefined;
}

function mergeSetupStateSchemas(
  left: Record<string, SetupStateSchema> | undefined,
  right: Record<string, SetupStateSchema> | undefined
): Record<string, SetupStateSchema> | undefined {
  if (!left && !right) {
    return undefined;
  }

  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return Object.fromEntries(
    Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).map(
      (key) => {
        const leftState = left[key];
        const rightState = right[key];

        if (!leftState) {
          return [key, rightState];
        }

        if (!rightState) {
          return [key, leftState];
        }

        const schemas = mergeSchemas(leftState.schemas, rightState.schemas);
        const states = mergeSetupStateSchemas(
          leftState.states,
          rightState.states
        );

        return [
          key,
          {
            ...leftState,
            ...rightState,
            ...(schemas ? { schemas } : undefined),
            ...(states ? { states } : undefined)
          }
        ];
      }
    )
  );
}

function mergeSchemas(
  left: SetupSchemas | undefined,
  right: SetupSchemas | undefined
): SetupSchemas | undefined {
  if (!left && !right) {
    return undefined;
  }

  return {
    ...left,
    ...right,
    events: mergeMaps(left?.events, right?.events),
    internalEvents: mergeMaps(left?.internalEvents, right?.internalEvents),
    actions: mergeMaps(left?.actions, right?.actions),
    guards: mergeMaps(left?.guards, right?.guards),
    emitted: mergeMaps(left?.emitted, right?.emitted),
    children: mergeMaps(left?.children, right?.children)
  };
}

/**
 * Setup schemas win over inline config schemas (same precedence as root
 * `mergeSchemas`); setup states with no matching config state are skipped.
 */
function mergeStateSchemas(
  configStates: Record<string, SetupStateSchema> | undefined,
  setupStates: Record<string, SetupStateSchema> | undefined
): Record<string, SetupStateSchema> | undefined {
  if (!configStates || !setupStates) {
    return configStates;
  }

  return Object.fromEntries(
    Object.entries(configStates).map(([key, configState]) => {
      const setupState = setupStates[key];

      if (!setupState) {
        return [key, configState];
      }

      const schemas = mergeMaps(configState.schemas, setupState.schemas);
      const states = mergeStateSchemas(configState.states, setupState.states);

      const structuralFields = [
        'type',
        'id',
        'initial',
        'history',
        'target',
        'route'
      ] as const;
      const structural = Object.fromEntries(
        structuralFields.flatMap((field) =>
          configState[field] === undefined && setupState[field] !== undefined
            ? [[field, setupState[field]]]
            : []
        )
      );

      return [
        key,
        {
          ...configState,
          ...structural,
          ...(schemas ? { schemas } : undefined),
          ...(states ? { states } : undefined)
        }
      ];
    })
  );
}

function mergeSetupConfigs<
  TBase extends SetupConfig<any, any, any, any, any, any>,
  TExtension extends SetupConfig<any, any, any, any, any, any>
>(base: TBase, extension: TExtension): TBase & TExtension {
  return {
    ...base,
    ...extension,
    schemas: mergeSchemas(base.schemas, extension.schemas),
    states: mergeSetupStateSchemas(base.states, extension.states),
    actions: mergeMaps(base.actions, extension.actions),
    actors: mergeMaps(base.actors, extension.actors),
    guards: mergeMaps(base.guards, extension.guards),
    delays: mergeMaps(base.delays, extension.delays)
  } as TBase & TExtension;
}
