import { StandardSchemaV1 } from './schema.types.ts';
import { StateMachine } from './StateMachine.ts';
import {
  AnyActorRef,
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
  Cast
} from './types.ts';
import {
  DelayMapFromNames,
  Implementations,
  InferOutput,
  InferEvents,
  Next_MachineConfig,
  Next_StateNodeConfig,
  ValidateDelayReferences,
  WithDefault
} from './types.v6.ts';

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
  TKey extends 'events' | 'emitted'
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
  TKey extends 'events' | 'emitted',
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
  TContext extends MachineContext,
  TEvent extends EventObject,
  TDelays extends string,
  TTag extends string,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TContextRequired extends boolean
> = Omit<
  Next_MachineConfig<
    SetupOrConfigSchema<TSchemas, 'context', TContextSchema>,
    SetupOrConfigSchemaMap<TSchemas, 'events', TEventSchemaMap>,
    SetupOrConfigSchemaMap<TSchemas, 'emitted', TEmittedSchemaMap>,
    SetupOrConfigSchema<TSchemas, 'input', TInputSchema>,
    SetupOrConfigSchema<TSchemas, 'output', TOutputSchema>,
    SetupOrConfigSchema<TSchemas, 'meta', TMetaSchema>,
    SetupOrConfigSchema<TSchemas, 'tags', TTagSchema>,
    TContext,
    TEvent,
    TDelays,
    TTag,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TContextRequired
  >,
  'states' | 'initial'
> & {
  initial?:
    | SetupStateKey<TStateSchemas>
    | InitialTransitionWithInput<TStateSchemas, TContext, TEvent>
    | undefined;
  states?: StatesWithInput<
    TStateSchemas,
    TStateSchemas,
    TContext,
    TEvent,
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
  TEvent extends EventObject,
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
    TEvent,
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
  TEvent extends EventObject,
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
      TEvent,
      TEmitted,
      TMeta
    >;
    always?: StateTransitionConfigOrTarget<
      TSiblingStateSchemas,
      StateContext<TStateSchema, TContext>,
      TEvent,
      TEvent,
      TEmitted,
      TMeta
    >;
  },
  TStateSchema['states'] extends Record<string, SetupStateSchema>
    ? StatesWithInput<
        TStateSchema['states'],
        TStateSchema['states'],
        TContext,
        TEvent,
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
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TMeta extends MetaObject
> = {
  [K in EventDescriptor<TEvent>]?: StateTransitionConfigOrTarget<
    TStateSchemas,
    TContext,
    ExtractEvent<TEvent, K>,
    TEvent,
    TEmitted,
    TMeta
  >;
};

type StateTransitionConfigOrTarget<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TMeta extends MetaObject
> =
  | SetupStateTarget<TStateSchemas>
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
      TExpressionEvent,
      TEvent,
      TEmitted,
      TMeta
    >;

type StateTransitionFunction<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  _TEvent extends EventObject,
  _TEmitted extends EventObject,
  TMeta extends MetaObject
> = (
  args: {
    context: TContext;
    event: TExpressionEvent;
    self: AnyActorRef;
    parent: AnyActorRef | undefined;
    value: StateValue;
    children: Record<string, AnyActorRef>;
    actions: Implementations['actions'];
    actors: Implementations['actors'];
    guards: Implementations['guards'];
    delays: Implementations['delays'];
  },
  enq: any
) => StateTransitionResult<TStateSchemas, TContext, TMeta> | void;

type StateTransitionResult<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TMeta extends MetaObject
> =
  | {
      target?: never;
      context?: TContext;
      reenter?: boolean;
      meta?: TMeta;
    }
  | {
      [K in keyof TStateSchemas & string]: {
        target: K;
        context: StateContext<TStateSchemas[K], TContext>;
        reenter?: boolean;
        meta?: TMeta;
        input?:
          | StateInput<TStateSchemas[K]>
          | ((args: {
              context: TContext;
              event: EventObject;
            }) => StateInput<TStateSchemas[K]>);
      };
    }[keyof TStateSchemas & string];

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
  TSchemas extends SetupSchemas = {}
> {
  /** Creates a state machine with the setup configuration */
  createMachine<
    TContextSchema extends StandardSchemaV1,
    const TEventSchemaMap extends Record<string, StandardSchemaV1>,
    TEmittedSchemaMap extends Record<string, StandardSchemaV1>,
    TInputSchema extends StandardSchemaV1,
    TOutputSchema extends StandardSchemaV1,
    TMetaSchema extends StandardSchemaV1,
    TTagSchema extends StandardSchemaV1,
    _TEvent extends EventObject,
    TActor extends ProvidedActor,
    TActionMap extends Implementations['actions'],
    TActorMap extends Implementations['actors'],
    TGuardMap extends Implementations['guards'],
    TDelayMap extends Implementations['delays'],
    TDelays extends string,
    TTag extends SetupTags<TSchemas, TTagSchema>,
    TInput,
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
      SetupContext<TSchemas, TContextSchema>,
      SetupEvents<TSchemas, TEventSchemaMap>,
      TDelays,
      TTag,
      SetupEmitted<TSchemas, TEmittedSchemaMap>,
      SetupMeta<TSchemas, TMetaSchema>,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      SetupContextRequired<TSchemas, TContextSchema>
    >
  >(
    config: TConfig &
      ValidateSetupStateKeys<TConfig, TStates> &
      ValidateNestedSetupStateKeys<TConfig, TStates> &
      ValidateDelayReferences<TConfig> & {
        schemas?: {
          events?: TEventSchemaMap;
          context?: TContextSchema;
          emitted?: TEmittedSchemaMap;
          input?: TInputSchema;
          output?: TOutputSchema;
          meta?: TMetaSchema;
          tags?: TTagSchema;
        };
      }
  ): StateMachine<
    SetupContext<TSchemas, TContextSchema>,
    | SetupEvents<TSchemas, TEventSchemaMap>
    | ([RoutableStateId<Cast<TConfig, StateSchema>>] extends [never]
        ? never
        : {
            type: 'xstate.route';
            to: RoutableStateId<Cast<TConfig, StateSchema>>;
          }),
    Cast<ToChildren<TActor>, Record<string, AnyActorRef | undefined>>,
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
    TActionMap,
    TActorMap,
    TGuardMap,
    DelayMapFromNames<TDelays, TDelayMap>
  >;

  /** Creates a state node config with the setup configuration */
  createStateConfig<
    const TConfig extends StateNodeConfigWithNestedInput<
      TStates,
      SetupStateSchema,
      SetupContext<TSchemas, StandardSchemaV1>,
      SetupEvents<TSchemas, Record<string, StandardSchemaV1>>,
      string,
      SetupTags<TSchemas, StandardSchemaV1>,
      SetupEmitted<TSchemas, Record<string, StandardSchemaV1>>,
      SetupMeta<TSchemas, StandardSchemaV1>,
      Implementations['actions'],
      Implementations['actors'],
      Implementations['guards'],
      Implementations['delays']
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
  >
>(
  config: { schemas?: TSchemas; states?: TStates } = {}
): SetupReturn<TStates, TSchemas> {
  const { states = {} as TStates, schemas } = config;

  return {
    createMachine(machineConfig) {
      const configSchemas = (machineConfig as any).schemas;
      const mergedSchemas =
        schemas || configSchemas
          ? {
              ...configSchemas,
              ...schemas
            }
          : undefined;

      return new StateMachine(
        mergedSchemas
          ? ({
              ...machineConfig,
              schemas: mergedSchemas
            } as any)
          : (machineConfig as any)
      ) as any;
    },
    createStateConfig(stateConfig) {
      return stateConfig;
    },
    states
  };
}
