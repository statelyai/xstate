import { StandardSchemaV1 } from './schema.types.ts';
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
  SingleOrArray
} from './types.ts';
import { AnyActorSystem } from './system.ts';
import { InspectionEvent } from './inspection.ts';
import {
  ActionSchemas,
  DelayMapFromNames,
  GuardSchemas,
  InferChildren,
  InferActions,
  InferGuards,
  Implementations,
  InferOutput,
  InferEvents,
  Next_MachineConfig,
  Next_InvokeConfig,
  Next_StateNodeConfig,
  Next_TransitionConfigOrTarget,
  WithDefault
} from './types.v6.ts';

export type SetupConfig<
  TSchemas extends SetupSchemas,
  TStates extends Record<string, SetupStateSchema>,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> = {
  schemas?: TSchemas & SetupSchemas;
  states?: TStates;
  actions?: TActionMap;
  actorSources?: TActorMap;
  guards?: TGuardMap;
  delays?: TDelayMap;
};

export type AnySetupConfig = SetupConfig<
  SetupSchemas,
  Record<string, SetupStateSchema>,
  Implementations['actions'],
  Implementations['actorSources'],
  Implementations['guards'],
  Implementations['delays']
>;

export type SystemConfig<TSystemRegistry extends SystemRegistry> = {
  registry?: TSystemRegistry;
};

export type SystemActorMap<TSystemRegistry extends SystemRegistry> = {
  [K in keyof TSystemRegistry & string]: ActorRefFromLogic<TSystemRegistry[K]>;
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
  TActorMap extends Implementations['actorSources']
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
  TActorMap extends Implementations['actorSources']
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
  TActorMap extends Implementations['actorSources']
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

export type SetupStateSchemas = {
  context?: StandardSchemaV1;
  input?: StandardSchemaV1;
};

export type SetupSchemas = {
  context?: StandardSchemaV1;
  events?: Record<string, StandardSchemaV1>;
  actions?: ActionSchemas;
  guards?: GuardSchemas;
  emitted?: Record<string, StandardSchemaV1>;
  input?: StandardSchemaV1;
  output?: StandardSchemaV1;
  meta?: StandardSchemaV1;
  tags?: StandardSchemaV1;
  children?: Record<string, StandardSchemaV1>;
};

/** State schema with optional schemas.input and nested states */
export interface SetupStateSchema {
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
  TKey extends 'events' | 'emitted' | 'children'
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
  TKey extends 'events' | 'emitted' | 'children',
  TConfigSchemaMap extends Record<string, StandardSchemaV1>
> = [SetupSchemaMap<TSchemas, TKey>] extends [never]
  ? TConfigSchemaMap
  : SetupSchemaMap<TSchemas, TKey>;

type SetupStateKeys<TStateSchemas extends Record<string, SetupStateSchema>> =
  keyof TStateSchemas & string;

type SetupStateKey<TStateSchemas extends Record<string, SetupStateSchema>> =
  string extends SetupStateKeys<TStateSchemas>
    ? string
    : [SetupStateKeys<TStateSchemas>] extends [never]
      ? string
      : SetupStateKeys<TStateSchemas>;

type SetupStateTarget<TStateSchemas extends Record<string, SetupStateSchema>> =
  string extends SetupStateKeys<TStateSchemas>
    ? string
    : [SetupStateKeys<TStateSchemas>] extends [never]
      ? string
      : SetupStateKeys<TStateSchemas> | `.${string}` | `#${string}`;

/**
 * The sibling state schemas of a dotted path: the children of the path's
 * parent. A bare transition target resolves relative to the parent, so the
 * valid targets for a path's config are its siblings. For a dotless (top-level)
 * path the siblings are the root states.
 */
type ResolveStateSiblings<
  TStates extends Record<string, SetupStateSchema>,
  TPath extends string
> = TPath extends `${infer Head}.${infer Rest}`
  ? Head extends keyof TStates
    ? TStates[Head]['states'] extends Record<string, SetupStateSchema>
      ? ResolveStateSiblings<TStates[Head]['states'], Rest>
      : never
    : never
  : TStates; // dotless path: siblings are the current level's states

/**
 * Resolves a dotted state path (e.g. `'parent.child'`) into the leaf
 * `SetupStateSchema` it addresses, or `never` if any segment is missing.
 */
type ResolveStatePath<
  TStates extends Record<string, SetupStateSchema>,
  TPath extends string
> = TPath extends `${infer Head}.${infer Rest}`
  ? Head extends keyof TStates
    ? TStates[Head]['states'] extends Record<string, SetupStateSchema>
      ? ResolveStatePath<TStates[Head]['states'], Rest>
      : never
    : never
  : TPath extends keyof TStates
    ? TStates[TPath]
    : never;

/** Union of every addressable dotted path into a setup states tree */
type StatePathsInner<TStates extends Record<string, SetupStateSchema>> = {
  [K in SetupStateKeys<TStates>]:
    | K
    | (TStates[K]['states'] extends Record<string, SetupStateSchema>
        ? `${K}.${StatePathsInner<TStates[K]['states']>}`
        : never);
}[SetupStateKeys<TStates>];

type StatePaths<TStates extends Record<string, SetupStateSchema>> =
  string extends SetupStateKeys<TStates>
    ? string
    : [SetupStateKeys<TStates>] extends [never]
      ? string
      : StatePathsInner<TStates>;

/**
 * Shared body of both `createStateConfig` overloads: the
 * `StateNodeConfigWithNestedInput` instantiation whose only varying parts are
 * the leading sibling-schemas and state-schema arguments.
 */
type SetupStateNodeConfig<
  TStates extends Record<string, SetupStateSchema>,
  TStateSchema extends SetupStateSchema,
  TSchemas extends SetupSchemas,
  TSetupActionMap extends Implementations['actions'],
  TSetupActorMap extends Implementations['actorSources'],
  TSetupGuardMap extends Implementations['guards'],
  TSetupDelayMap extends Implementations['delays'],
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

type InvalidSetupStateKeys<
  TConfig,
  TStateSchemas extends Record<string, SetupStateSchema>
> =
  string extends SetupStateKeys<TStateSchemas>
    ? never
    : [SetupStateKeys<TStateSchemas>] extends [never]
      ? never
      : TConfig extends { states: infer TStates }
        ? Exclude<keyof TStates & string, SetupStateKeys<TStateSchemas>>
        : never;

type ValidateSetupStateKeys<
  TConfig,
  TStateSchemas extends Record<string, SetupStateSchema>
> = [InvalidSetupStateKeys<TConfig, TStateSchemas>] extends [never]
  ? unknown
  : {
      states: {
        [K in InvalidSetupStateKeys<TConfig, TStateSchemas>]: never;
      };
    };

type ValidateNestedSetupStateKeys<
  TConfig,
  TStateSchemas extends Record<string, SetupStateSchema>
> = TConfig extends { states: infer TConfigStates }
  ? TConfigStates extends Record<string, unknown>
    ? {
        states: {
          [K in keyof TConfigStates &
            keyof TStateSchemas &
            string]: TStateSchemas[K] extends {
            states: infer TChildStateSchemas;
          }
            ? TChildStateSchemas extends Record<string, SetupStateSchema>
              ? TConfigStates[K] &
                  ValidateSetupStateKeys<TConfigStates[K], TChildStateSchemas> &
                  ValidateNestedSetupStateKeys<
                    TConfigStates[K],
                    TChildStateSchemas
                  >
              : TConfigStates[K]
            : TConfigStates[K];
        };
      }
    : unknown
  : unknown;

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

type SetupEvents<
  TSchemas,
  TEventSchemaMap extends Record<string, StandardSchemaV1>
> = [SetupSchemaMap<TSchemas, 'events'>] extends [never]
  ? InferEvents<TEventSchemaMap>
  : InferEvents<SetupSchemaMap<TSchemas, 'events'>>;

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

type SetupActions<TSchemas, TActionMap extends Implementations['actions']> = [
  SetupActionSchemaMap<TSchemas>
] extends [never]
  ? TActionMap
  : MergeImplementationMaps<
      InferActions<SetupActionSchemaMap<TSchemas>>,
      TActionMap
    >;

type SetupGuards<TSchemas, TGuardMap extends Implementations['guards']> = [
  SetupGuardSchemaMap<TSchemas>
] extends [never]
  ? TGuardMap
  : MergeImplementationMaps<
      InferGuards<SetupGuardSchemaMap<TSchemas>>,
      TGuardMap
    >;

type MergeChildren<
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActor extends ProvidedActor
> = [keyof TChildren] extends [never]
  ? Compute<ToChildren<TActor>>
  : Compute<TChildren>;

type MergeImplementationMaps<
  TBase extends Record<string, unknown>,
  TExtension extends Record<string, unknown>
> = Compute<TBase & TExtension>;

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

type StateContext<
  TStateSchema extends SetupStateSchema,
  TFallbackContext extends MachineContext
> = TStateSchema['schemas'] extends { context: infer TContextSchema }
  ? TContextSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TContextSchema> & MachineContext
    : TFallbackContext
  : TFallbackContext;

type StateContextShape<
  TStateSchema extends SetupStateSchema,
  TFallbackContext
> = TStateSchema['schemas'] extends { context: infer TContextSchema }
  ? TContextSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TContextSchema>
    : TFallbackContext
  : TFallbackContext;

type WithNestedStates<TConfig, TNestedStates> = TConfig extends {
  type: 'choice';
}
  ? TConfig
  : Omit<TConfig, 'states'> & { states?: TNestedStates };

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

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
  states: TSetupSchema['states'] extends Record<string, SetupStateSchema>
    ? {
        [K in keyof TSetupSchema['states'] &
          string]: SetupStateSchemaToStateSchema<TSetupSchema['states'][K]>;
      }
    : undefined;
};

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

type StateSchemaChild<
  TSetup extends StateSchema,
  K extends string
> = TSetup extends { states: infer TStates }
  ? K extends keyof TStates
    ? Cast<TStates[K], StateSchema>
    : EmptyStateSchema
  : EmptyStateSchema;

type MergeStateSchema<
  TConfig extends StateSchema,
  TSetup extends StateSchema
> = Omit<TConfig, 'contextSchema' | 'input' | 'states'> & {
  contextSchema: StateSchemaContextSchema<TConfig, TSetup>;
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
};

/** Machine config with typed state input */
type SetupMachineConfig<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TSchemas extends SetupSchemas,
  TContextSchema extends StandardSchemaV1,
  TEventSchemaMap extends Record<string, StandardSchemaV1>,
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
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TSystemRegistry extends SystemRegistry,
  TContextRequired extends boolean,
  TRootDelays extends string = TDelays,
  TRootActionMap extends Implementations['actions'] = TActionMap,
  TRootActorMap extends Implementations['actorSources'] = TActorMap,
  TRootGuardMap extends Implementations['guards'] = TGuardMap
> = Omit<
  Next_MachineConfig<
    SetupOrConfigSchema<TSchemas, 'context', TContextSchema>,
    SetupOrConfigSchemaMap<TSchemas, 'events', TEventSchemaMap>,
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
  | 'actorSources'
  | 'guards'
  | 'delays'
> & {
  actions?: TRootActionMap;
  actorSources?: TRootActorMap;
  guards?: TRootGuardMap;
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
    | SetupStateKey<TStateSchemas>
    | InitialTransitionWithInput<TStateSchemas, TContext, TEvent>
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
    TSystemRegistry
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
    TSystemRegistry
  >;
  invoke?: SingleOrArray<
    SetupInvokeConfig<
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
      TSystemRegistry
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
    TSystemRegistry
  >;
};

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
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TSystemRegistry extends SystemRegistry
> = {
  [K in keyof TStateSchemas & string]?: StateNodeConfigWithNestedInput<
    TRootStateSchemas,
    TStateSchemas[K],
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
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TSystemRegistry extends SystemRegistry
> = WithNestedStates<
  Omit<
    Next_StateNodeConfig<
      StateContext<TStateSchema, TContext>,
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
      StateInput<TStateSchema>,
      Record<string, unknown>,
      TSystemRegistry
    >,
    'on' | 'always' | 'initial' | 'invoke' | 'onDone'
  > & {
    initial?: TStateSchema['states'] extends Record<string, SetupStateSchema>
      ?
          | SetupStateKey<TStateSchema['states']>
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
    on?: StateTransitions<
      TSiblingStateSchemas,
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
      TSystemRegistry
    >;
    always?: StateTransitionConfigOrTarget<
      TSiblingStateSchemas,
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
      TSystemRegistry
    >;
    invoke?: SingleOrArray<
      SetupInvokeConfig<
        TSiblingStateSchemas,
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
        TSystemRegistry
      >
    >;
    onDone?: StateTransitionConfigOrTarget<
      TSiblingStateSchemas,
      StateContext<TStateSchema, TContext>,
      StateContextShape<TStateSchema, TContextShape>,
      DoneStateEvent,
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
  },
  TStateSchema['states'] extends Record<string, SetupStateSchema>
    ? StatesWithInput<
        TStateSchema['states'],
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

type StateTransitions<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TContextShape,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TSystemRegistry extends SystemRegistry
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
    TSystemRegistry
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
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TSystemRegistry extends SystemRegistry
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
    TSystemRegistry
  > extends infer TInvoke
    ? TInvoke extends any
      ? DistributiveOmit<
          TInvoke,
          'onDone' | 'onError' | 'onSnapshot' | 'onTimeout'
        > & {
          onDone?: StateTransitionConfigOrTarget<
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
          >;
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
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TSystemRegistry extends SystemRegistry
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
      TSystemRegistry
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
      TSystemRegistry
    >;

type StateTransitionObjectConfig<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TContextShape,
  TExpressionEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TSystemRegistry extends SystemRegistry
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
      true
    > & {
      description?: string;
    })
  | {
      target: SetupStateTarget<TStateSchemas>[];
      context?: StateTransitionContext<
        true,
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
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
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
    actorSources: TActorMap;
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
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
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
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
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
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
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
    actorSources: TActorMap;
    guards: TGuardMap;
    delays: TDelayMap;
  } & OutputArg<TExpressionEvent>,
  enq: EnqueueObject<TEvent, TEmitted, TSystemRegistry>
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
  false
> | void;

type StateTransitionResult<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TContextShape,
  TMeta extends MetaObject,
  TExpressionEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TSystemRegistry extends SystemRegistry,
  TAllowContextMapper extends boolean
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
      [K in keyof TStateSchemas & string]: {
        target: K;
        reenter?: boolean;
        meta?: TMeta;
        input?:
          | StateInput<TStateSchemas[K]>
          | ((
              args: {
                context: TContext;
                event: EventObject;
              } & OutputArg<EventObject>
            ) => StateInput<TStateSchemas[K]>);
      } & ([TContextShape] extends [
        StateContextShape<TStateSchemas[K], TContextShape>
      ]
        ? {
            context?: StateTransitionContext<
              TAllowContextMapper,
              TContext,
              TContextShape,
              StateContextShape<TStateSchemas[K], TContextShape>,
              StateContext<TStateSchemas[K], TContext>,
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
              StateContextShape<TStateSchemas[K], TContextShape>,
              StateContext<TStateSchemas[K], TContext>,
              TExpressionEvent,
              TChildren,
              TActionMap,
              TActorMap,
              TGuardMap,
              TDelayMap,
              TSystemRegistry
            >;
          });
    }[keyof TStateSchemas & string]
  | {
      target: Exclude<
        SetupStateTarget<TStateSchemas>,
        keyof TStateSchemas & string
      >;
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
type InitialTransitionWithInput<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in keyof TStateSchemas & string]: {
    target: K;
    input?:
      | StateInput<TStateSchemas[K]>
      | ((args: {
          context: TContext;
          event: TEvent;
        }) => StateInput<TStateSchemas[K]>);
  };
}[keyof TStateSchemas & string];

/** Return type of setup() */
export interface SetupReturn<
  TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >,
  TSchemas extends SetupSchemas = {},
  TSetupActionMap extends Implementations['actions'] = {},
  TSetupActorMap extends Implementations['actorSources'] = {},
  TSetupGuardMap extends Implementations['guards'] = {},
  TSetupDelayMap extends Implementations['delays'] = {},
  TSetupDelays extends string = Extract<keyof TSetupDelayMap, string>,
  TSystemRegistry extends SystemRegistry = SystemRegistry
> {
  /** Extends the setup configuration */
  extend<
    const TExtendSchemas extends SetupSchemas = {},
    const TExtendStates extends Record<string, SetupStateSchema> = {},
    TExtendActionMap extends Implementations['actions'] = {},
    TExtendActorMap extends Implementations['actorSources'] = {},
    TExtendGuardMap extends Implementations['guards'] = {},
    TExtendDelayMap extends Implementations['delays'] = {}
  >(
    config: SetupConfig<
      TExtendSchemas,
      TExtendStates,
      TExtendActionMap,
      TExtendActorMap,
      TExtendGuardMap,
      TExtendDelayMap
    >
  ): SetupReturn<
    MergeImplementationMaps<TStates, TExtendStates>,
    MergeImplementationMaps<TSchemas, TExtendSchemas>,
    MergeImplementationMaps<TSetupActionMap, TExtendActionMap>,
    MergeImplementationMaps<TSetupActorMap, TExtendActorMap>,
    MergeImplementationMaps<TSetupGuardMap, TExtendGuardMap>,
    MergeImplementationMaps<TSetupDelayMap, TExtendDelayMap>,
    TSetupDelays | Extract<keyof TExtendDelayMap, string>,
    TSystemRegistry
  >;

  /** Creates a state machine with the setup configuration */
  createMachine<
    TContextSchema extends StandardSchemaV1 = StandardSchemaV1,
    const TEventSchemaMap extends Record<string, StandardSchemaV1> = Record<
      string,
      StandardSchemaV1
    >,
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
    TActionMap extends Implementations['actions'] = {},
    TActorMap extends Implementations['actorSources'] = {},
    TGuardMap extends Implementations['guards'] = {},
    TDelayMap extends Implementations['delays'] = {},
    TDelays extends string = Extract<keyof TDelayMap, string>,
    TTag extends SetupTags<TSchemas, TTagSchema> = SetupTags<
      TSchemas,
      TTagSchema
    >,
    TInput = unknown,
    TConfig extends SetupMachineConfig<
      TStates,
      TSchemas,
      TContextSchema,
      TEventSchemaMap,
      TEmittedSchemaMap,
      TInputSchema,
      TOutputSchema,
      TMetaSchema,
      TTagSchema,
      TChildrenSchemaMap,
      SetupContext<TSchemas, TContextSchema>,
      SetupEvents<TSchemas, TEventSchemaMap>,
      Cast<
        MergeChildren<SetupChildren<TSchemas, TChildrenSchemaMap>, TActor>,
        Record<string, AnyActorRef | undefined>
      >,
      TSetupDelays | TDelays,
      TTag,
      SetupEmitted<TSchemas, TEmittedSchemaMap>,
      SetupMeta<TSchemas, TMetaSchema>,
      MergeImplementationMaps<
        SetupActions<TSchemas, TSetupActionMap>,
        MergeImplementationMaps<InferActions<TActionSchemaMap>, TActionMap>
      >,
      MergeImplementationMaps<TSetupActorMap, TActorMap>,
      MergeImplementationMaps<
        SetupGuards<TSchemas, TSetupGuardMap>,
        MergeImplementationMaps<InferGuards<TGuardSchemaMap>, TGuardMap>
      >,
      MergeImplementationMaps<TSetupDelayMap, TDelayMap>,
      TSystemRegistry,
      SetupContextRequired<TSchemas, TContextSchema>,
      TDelays,
      TActionMap,
      TActorMap,
      TGuardMap
    > = SetupMachineConfig<
      TStates,
      TSchemas,
      TContextSchema,
      TEventSchemaMap,
      TEmittedSchemaMap,
      TInputSchema,
      TOutputSchema,
      TMetaSchema,
      TTagSchema,
      TChildrenSchemaMap,
      SetupContext<TSchemas, TContextSchema>,
      SetupEvents<TSchemas, TEventSchemaMap>,
      Cast<
        MergeChildren<SetupChildren<TSchemas, TChildrenSchemaMap>, TActor>,
        Record<string, AnyActorRef | undefined>
      >,
      TSetupDelays | TDelays,
      TTag,
      SetupEmitted<TSchemas, TEmittedSchemaMap>,
      SetupMeta<TSchemas, TMetaSchema>,
      MergeImplementationMaps<
        SetupActions<TSchemas, TSetupActionMap>,
        MergeImplementationMaps<InferActions<TActionSchemaMap>, TActionMap>
      >,
      MergeImplementationMaps<TSetupActorMap, TActorMap>,
      MergeImplementationMaps<
        SetupGuards<TSchemas, TSetupGuardMap>,
        MergeImplementationMaps<InferGuards<TGuardSchemaMap>, TGuardMap>
      >,
      MergeImplementationMaps<TSetupDelayMap, TDelayMap>,
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
        context?: TContextSchema;
        emitted?: TEmittedSchemaMap;
        actions?: TActionSchemaMap;
        guards?: TGuardSchemaMap;
        input?: TInputSchema;
        output?: TOutputSchema;
        meta?: TMetaSchema;
        tags?: TTagSchema;
        children?: TChildrenSchemaMap;
      };
      actions?: TActionMap;
      actorSources?: TActorMap;
      guards?: TGuardMap;
      delays?: TDelayMap;
    } & TConfig &
      ValidateSetupStateKeys<TConfig, TStates> &
      ValidateNestedSetupStateKeys<TConfig, TStates> &
      ValidateSetupDelayReferences<TConfig, TSetupDelays> &
      ValidateRegistryKeys<
        TConfig,
        TSystemRegistry,
        MergeImplementationMaps<TSetupActorMap, TActorMap>
      >
  ): StateMachine<
    SetupContext<TSchemas, TContextSchema>,
    | SetupEvents<TSchemas, TEventSchemaMap>
    | ([RoutableStateId<Cast<TConfig, StateSchema>>] extends [never]
        ? never
        : {
            type: 'xstate.route';
            to: RoutableStateId<Cast<TConfig, StateSchema>>;
          }),
    Cast<
      MergeChildren<SetupChildren<TSchemas, TChildrenSchemaMap>, TActor>,
      Record<string, AnyActorRef | undefined>
    >,
    StateValue,
    TTag & string,
    [SetupSchema<TSchemas, 'input'>] extends [never]
      ? TInput
      : SetupInput<TSchemas, TInputSchema>,
    SetupOutput<TSchemas, TOutputSchema>,
    SetupEmitted<TSchemas, TEmittedSchemaMap>,
    SetupMeta<TSchemas, TMetaSchema>,
    MergeStateSchema<
      Cast<TConfig, StateSchema>,
      SetupStatesToStateSchema<TStates>
    >,
    MergeImplementationMaps<
      SetupActions<TSchemas, TSetupActionMap>,
      MergeImplementationMaps<InferActions<TActionSchemaMap>, TActionMap>
    >,
    MergeImplementationMaps<TSetupActorMap, TActorMap>,
    MergeImplementationMaps<
      SetupGuards<TSchemas, TSetupGuardMap>,
      MergeImplementationMaps<InferGuards<TGuardSchemaMap>, TGuardMap>
    >,
    DelayMapFromNames<
      TSetupDelays | TDelays,
      MergeImplementationMaps<TSetupDelayMap, TDelayMap>
    >
  >;

  /**
   * Creates a state node config bound to a specific setup-declared state,
   * addressed by a dotted path (e.g. `'loading'` or `'parent.child'`). The
   * addressed state's own `input` schema is typed inside `entry`/`exit` args.
   */
  createStateConfig<
    const TPath extends StatePaths<TStates>,
    const TConfig extends SetupStateNodeConfig<
      ResolveStateSiblings<TStates, TPath>,
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
    config: TConfig
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
  ? TActions extends Implementations['actions']
    ? MergeImplementationMaps<
        SetupActions<SetupConfigSchemas<TConfig>, {}>,
        TActions
      >
    : SetupActions<SetupConfigSchemas<TConfig>, {}>
  : SetupActions<SetupConfigSchemas<TConfig>, {}>;

type SetupConfigActorSources<TConfig> = TConfig extends {
  actorSources?: infer TActorSources;
}
  ? TActorSources extends Implementations['actorSources']
    ? TActorSources
    : {}
  : {};

type SetupConfigGuards<TConfig> = TConfig extends { guards?: infer TGuards }
  ? TGuards extends Implementations['guards']
    ? MergeImplementationMaps<
        SetupGuards<SetupConfigSchemas<TConfig>, {}>,
        TGuards
      >
    : SetupGuards<SetupConfigSchemas<TConfig>, {}>
  : SetupGuards<SetupConfigSchemas<TConfig>, {}>;

type SetupConfigDelays<TConfig> = TConfig extends { delays?: infer TDelays }
  ? TDelays extends Implementations['delays']
    ? TDelays
    : {}
  : {};

export type SetupReturnFromConfig<TConfig extends AnySetupConfig> = SetupReturn<
  SetupConfigStates<TConfig>,
  SetupConfigSchemas<TConfig>,
  SetupConfigActions<TConfig>,
  SetupConfigActorSources<TConfig>,
  SetupConfigGuards<TConfig>,
  SetupConfigDelays<TConfig>
>;

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
export function setup(): SetupReturn;
export function setup<
  const TSchemas extends SetupSchemas = {},
  const TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >,
  TActionMap extends Implementations['actions'] = {},
  TActorMap extends Implementations['actorSources'] = {},
  TGuardMap extends Implementations['guards'] = {},
  TDelayMap extends Implementations['delays'] = {}
>(
  config: SetupConfig<
    TSchemas,
    TStates,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
  >
): SetupReturn<TStates, TSchemas, TActionMap, TActorMap, TGuardMap, TDelayMap>;
export function setup<const TConfig extends AnySetupConfig>(
  config: TConfig
): SetupReturnFromConfig<TConfig>;
export function setup<
  const TSchemas extends SetupSchemas = {},
  const TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >,
  TActionMap extends Implementations['actions'] = {},
  TActorMap extends Implementations['actorSources'] = {},
  TGuardMap extends Implementations['guards'] = {},
  TDelayMap extends Implementations['delays'] = {}
>(
  config: SetupConfig<
    TSchemas,
    TStates,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
  > = {}
): SetupReturn<TStates, TSchemas, TActionMap, TActorMap, TGuardMap, TDelayMap> {
  const {
    states = {} as TStates,
    schemas,
    actions,
    actorSources,
    guards,
    delays
  } = config;

  return {
    extend<
      const TExtendSchemas extends SetupSchemas = {},
      const TExtendStates extends Record<string, SetupStateSchema> = {},
      TExtendActionMap extends Implementations['actions'] = {},
      TExtendActorMap extends Implementations['actorSources'] = {},
      TExtendGuardMap extends Implementations['guards'] = {},
      TExtendDelayMap extends Implementations['delays'] = {}
    >(
      extension: SetupConfig<
        TExtendSchemas,
        TExtendStates,
        TExtendActionMap,
        TExtendActorMap,
        TExtendGuardMap,
        TExtendDelayMap
      >
    ) {
      return setup(mergeSetupConfigs(config, extension)) as SetupReturn<
        MergeImplementationMaps<TStates, TExtendStates>,
        MergeImplementationMaps<TSchemas, TExtendSchemas>,
        MergeImplementationMaps<TActionMap, TExtendActionMap>,
        MergeImplementationMaps<TActorMap, TExtendActorMap>,
        MergeImplementationMaps<TGuardMap, TExtendGuardMap>,
        MergeImplementationMaps<TDelayMap, TExtendDelayMap>,
        | Extract<keyof TDelayMap, string>
        | Extract<keyof TExtendDelayMap, string>
      >;
    },
    createMachine(machineConfig) {
      const configSchemas = machineConfig.schemas;
      const mergedSchemas = mergeSchemas(configSchemas, schemas);
      const mergedActions = mergeMaps(actions, machineConfig.actions);
      const mergedActorSources = mergeMaps(
        actorSources,
        machineConfig.actorSources
      );
      const mergedGuards = mergeMaps(guards, machineConfig.guards);
      const mergedDelays = mergeMaps(delays, machineConfig.delays);

      return new StateMachine({
        ...machineConfig,
        ...(mergedSchemas ? { schemas: mergedSchemas } : undefined),
        ...(mergedActions ? { actions: mergedActions } : undefined),
        ...(mergedActorSources
          ? { actorSources: mergedActorSources }
          : undefined),
        ...(mergedGuards ? { guards: mergedGuards } : undefined),
        ...(mergedDelays ? { delays: mergedDelays } : undefined)
      } as any);
    },
    createStateConfig(...args: unknown[]) {
      return args.length > 1 ? args[1] : args[0];
    },
    states
  };
}

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
  setup<
    const TSchemas extends SetupSchemas = {},
    const TStates extends Record<string, SetupStateSchema> = Record<
      string,
      SetupStateSchema
    >,
    TActionMap extends Implementations['actions'] = {},
    TActorMap extends Implementations['actorSources'] = {},
    TGuardMap extends Implementations['guards'] = {},
    TDelayMap extends Implementations['delays'] = {}
  >(
    config?: SetupConfig<
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
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    Extract<keyof TDelayMap, string>,
    TSystemRegistry
  >;
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
    setup(config) {
      return (config ? setup(config) : setup()) as any;
    }
  };
}

function mergeMaps<TLeft, TRight>(
  left: TLeft | undefined,
  right: TRight | undefined
): (TLeft & TRight) | undefined {
  return left || right ? ({ ...left, ...right } as TLeft & TRight) : undefined;
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
    emitted: mergeMaps(left?.emitted, right?.emitted),
    children: mergeMaps(left?.children, right?.children)
  };
}

function mergeSetupConfigs<
  TBase extends SetupConfig<any, any, any, any, any, any>,
  TExtension extends SetupConfig<any, any, any, any, any, any>
>(base: TBase, extension: TExtension): TBase & TExtension {
  return {
    ...base,
    ...extension,
    schemas: mergeSchemas(base.schemas, extension.schemas),
    states: mergeMaps(base.states, extension.states),
    actions: mergeMaps(base.actions, extension.actions),
    actorSources: mergeMaps(base.actorSources, extension.actorSources),
    guards: mergeMaps(base.guards, extension.guards),
    delays: mergeMaps(base.delays, extension.delays)
  } as TBase & TExtension;
}
