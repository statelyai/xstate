import { StandardSchemaV1 } from './schema.types.ts';
import { StateMachine } from './StateMachine.ts';
import {
  AnyActorRef,
  AnyEventObject,
  AnyStateNode,
  Cast,
  Compute,
  EnqueueObject,
  EventDescriptor,
  EventObject,
  ExtractEvent,
  MachineContext,
  MetaObject,
  ProvidedActor,
  RoutableStateId,
  StateSchema,
  StateValue,
  ToChildren
} from './types.ts';
import {
  DelayMapFromNames,
  Implementations,
  InferChildren,
  InferEvents,
  InferOutput,
  Next_MachineConfig,
  Next_StateNodeConfig,
  WithDefault
} from './types.v6.ts';

type SetupConfig<
  TSchemas extends SetupSchemas,
  TStates extends Record<string, SetupStateSchema>,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> = {
  schemas?: TSchemas & SetupSchemas;
  states?: TStates;
  actions?: TActionMap;
  actors?: TActorMap;
  guards?: TGuardMap;
  delays?: TDelayMap;
};

type SetupStateSchemas = {
  context?: StandardSchemaV1;
  input?: StandardSchemaV1;
};

type SetupSchemas = {
  context?: StandardSchemaV1;
  events?: Record<string, StandardSchemaV1>;
  emitted?: Record<string, StandardSchemaV1>;
  input?: StandardSchemaV1;
  output?: StandardSchemaV1;
  meta?: StandardSchemaV1;
  tags?: StandardSchemaV1;
  children?: Record<string, StandardSchemaV1>;
};

/** State schema with optional schemas.input and nested states */
interface SetupStateSchema {
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

type SetupOrConfigSchema<
  TSchemas,
  TKey extends Exclude<keyof SetupSchemas, 'events' | 'emitted'>,
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
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TContextRequired extends boolean,
  TRootDelays extends string = TDelays,
  TRootActionMap extends Implementations['actions'] = TActionMap,
  TRootActorMap extends Implementations['actors'] = TActorMap,
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
    TContextRequired
  >,
  | 'states'
  | 'initial'
  | 'on'
  | 'always'
  | 'actions'
  | 'actors'
  | 'guards'
  | 'delays'
> & {
  actions?: TRootActionMap;
  actors?: TRootActorMap;
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
    TDelayMap
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
    TDelayMap
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
    TEmitted,
    TMeta,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
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
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
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
    TEmitted,
    TMeta,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
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
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> = WithNestedStates<
  Omit<
    Next_StateNodeConfig<
      StateContext<TStateSchema, TContext>,
      TEvent,
      TDelays,
      TTag,
      any,
      TEmitted,
      TMeta,
      TChildren,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      StateInput<TStateSchema>
    >,
    'on' | 'always' | 'initial'
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
      TDelayMap
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
      TDelayMap
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
        TEmitted,
        TMeta,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap
      >
    : {
        [K in string]?: Next_StateNodeConfig<
          TContext,
          TEvent,
          TDelays,
          TTag,
          any,
          TEmitted,
          TMeta,
          TChildren,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap,
          undefined
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
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
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
    TDelayMap
  >;
};

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
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> =
  | undefined
  | {
      target?:
        | SetupStateTarget<TStateSchemas>
        | SetupStateTarget<TStateSchemas>[];
      description?: string;
      reenter?: boolean;
      meta?: TMeta;
      input?:
        | Record<string, unknown>
        | ((args: {
            context: TContext;
            event: TExpressionEvent;
          }) => Record<string, unknown>);
    }
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
      TDelayMap
    >;

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
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> = (
  args: {
    context: TContext;
    event: TExpressionEvent;
    self: AnyActorRef;
    parent: AnyActorRef | undefined;
    value: StateValue;
    children: TChildren;
    actions: TActionMap;
    actors: TActorMap;
    guards: TGuardMap;
    delays: TDelayMap;
  },
  enq: EnqueueObject<TEvent, TEmitted>
) => StateTransitionResult<
  TStateSchemas,
  TContext,
  TContextShape,
  TMeta
> | void;

type StateTransitionResult<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TContextShape,
  TMeta extends MetaObject
> =
  | {
      target?: never;
      context?: ContextPatch<TContextShape, TContextShape, TContext>;
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
          | ((args: {
              context: TContext;
              event: EventObject;
            }) => StateInput<TStateSchemas[K]>);
      } & ([TContextShape] extends [
        StateContextShape<TStateSchemas[K], TContextShape>
      ]
        ? {
            context?: ContextPatch<
              TContextShape,
              StateContextShape<TStateSchemas[K], TContextShape>,
              StateContext<TStateSchemas[K], TContext>
            >;
          }
        : {
            context: ContextPatch<
              TContextShape,
              StateContextShape<TStateSchemas[K], TContextShape>,
              StateContext<TStateSchemas[K], TContext>
            >;
          });
    }[keyof TStateSchemas & string]
  | {
      target: Exclude<
        SetupStateTarget<TStateSchemas>,
        keyof TStateSchemas & string
      >;
      context?: ContextPatch<TContextShape, TContextShape, TContext>;
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
    >
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
interface SetupReturn<
  TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >,
  TSchemas extends SetupSchemas = {},
  TSetupActionMap extends Implementations['actions'] = {},
  TSetupActorMap extends Implementations['actors'] = {},
  TSetupGuardMap extends Implementations['guards'] = {},
  TSetupDelayMap extends Implementations['delays'] = {},
  TSetupDelays extends string = Extract<keyof TSetupDelayMap, string>
> {
  /** Extends the setup configuration */
  extend<
    const TExtendSchemas extends SetupSchemas = {},
    const TExtendStates extends Record<string, SetupStateSchema> = {},
    TExtendActionMap extends Implementations['actions'] = {},
    TExtendActorMap extends Implementations['actors'] = {},
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
    TSetupDelays | Extract<keyof TExtendDelayMap, string>
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
    _TEvent extends EventObject = EventObject,
    TActor extends ProvidedActor = ProvidedActor,
    TActionMap extends Implementations['actions'] = {},
    TActorMap extends Implementations['actors'] = {},
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
      MergeImplementationMaps<TSetupActionMap, TActionMap>,
      MergeImplementationMaps<TSetupActorMap, TActorMap>,
      MergeImplementationMaps<TSetupGuardMap, TGuardMap>,
      MergeImplementationMaps<TSetupDelayMap, TDelayMap>,
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
      MergeImplementationMaps<TSetupActionMap, TActionMap>,
      MergeImplementationMaps<TSetupActorMap, TActorMap>,
      MergeImplementationMaps<TSetupGuardMap, TGuardMap>,
      MergeImplementationMaps<TSetupDelayMap, TDelayMap>,
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
        input?: TInputSchema;
        output?: TOutputSchema;
        meta?: TMetaSchema;
        tags?: TTagSchema;
        children?: TChildrenSchemaMap;
      };
      actions?: TActionMap;
      actors?: TActorMap;
      guards?: TGuardMap;
      delays?: TDelayMap;
    } & TConfig &
      ValidateSetupStateKeys<TConfig, TStates> &
      ValidateNestedSetupStateKeys<TConfig, TStates> &
      ValidateSetupDelayReferences<TConfig, TSetupDelays>
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
    MergeImplementationMaps<TSetupActionMap, TActionMap>,
    MergeImplementationMaps<TSetupActorMap, TActorMap>,
    MergeImplementationMaps<TSetupGuardMap, TGuardMap>,
    DelayMapFromNames<
      TSetupDelays | TDelays,
      MergeImplementationMaps<TSetupDelayMap, TDelayMap>
    >
  >;

  /** Creates a state node config with the setup configuration */
  createStateConfig<
    const TConfig extends StateNodeConfigWithNestedInput<
      TStates,
      SetupStateSchema,
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
      SetupEmitted<TSchemas, Record<string, StandardSchemaV1>>,
      SetupMeta<TSchemas, StandardSchemaV1>,
      TSetupActionMap,
      TSetupActorMap,
      TSetupGuardMap,
      TSetupDelayMap
    >
  >(
    config: TConfig
  ): TConfig;

  /** State input schemas from setup config */
  states: TStates;
}

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
export function setup<
  const TSchemas extends SetupSchemas = {},
  const TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >,
  TActionMap extends Implementations['actions'] = {},
  TActorMap extends Implementations['actors'] = {},
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
    actors,
    guards,
    delays
  } = config;

  return {
    extend(extension) {
      return setup(mergeSetupConfigs(config, extension));
    },
    createMachine(machineConfig) {
      const configSchemas = machineConfig.schemas;
      const mergedSchemas = mergeSchemas(configSchemas, schemas);
      const mergedActions = mergeMaps(actions, machineConfig.actions);
      const mergedActors = mergeMaps(actors, machineConfig.actors);
      const mergedGuards = mergeMaps(guards, machineConfig.guards);
      const mergedDelays = mergeMaps(delays, machineConfig.delays);

      return new StateMachine({
        ...machineConfig,
        ...(mergedSchemas ? { schemas: mergedSchemas } : undefined),
        ...(mergedActions ? { actions: mergedActions } : undefined),
        ...(mergedActors ? { actors: mergedActors } : undefined),
        ...(mergedGuards ? { guards: mergedGuards } : undefined),
        ...(mergedDelays ? { delays: mergedDelays } : undefined)
      } as any);
    },
    createStateConfig(stateConfig) {
      return stateConfig;
    },
    states
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
    actors: mergeMaps(base.actors, extension.actors),
    guards: mergeMaps(base.guards, extension.guards),
    delays: mergeMaps(base.delays, extension.delays)
  } as TBase & TExtension;
}
