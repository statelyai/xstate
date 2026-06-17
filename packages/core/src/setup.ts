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
  Next_SetupTypes,
  ValidateDelayReferences,
  WithDefault
} from './types.v6.ts';

type SetupStateSchemas = {
  context?: StandardSchemaV1;
  input?: StandardSchemaV1;
};

/** State schema with optional schemas.input and nested states */
interface SetupStateSchema {
  schemas?: SetupStateSchemas;
  states?: Record<string, SetupStateSchema>;
}

/** Configuration for setup() */
interface SetupConfig<
  TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >,
  TTypes = {}
> {
  types?: TTypes;
  states?: TStates;
}

type SetupContext<
  TTypes,
  TContextSchema extends StandardSchemaV1
> = TTypes extends { context: infer TContext }
  ? TContext & MachineContext
  : unknown extends StandardSchemaV1.InferOutput<TContextSchema>
    ? MachineContext
    : StandardSchemaV1.InferOutput<TContextSchema> & MachineContext;

type SetupContextRequired<
  TTypes,
  TContextSchema extends StandardSchemaV1
> = TTypes extends { context: unknown }
  ? true
  : unknown extends StandardSchemaV1.InferOutput<TContextSchema>
    ? false
    : true;

type SetupEvents<
  TTypes,
  TEventSchemaMap extends Record<string, StandardSchemaV1>
> = TTypes extends { events: infer TEvent }
  ? TEvent & EventObject
  : InferEvents<TEventSchemaMap>;

type SetupTags<TTypes, TTagSchema extends StandardSchemaV1> = TTypes extends {
  tags: infer TTag;
}
  ? TTag & string
  : StandardSchemaV1.InferOutput<TTagSchema> & string;

type SetupInput<
  TTypes,
  TInputSchema extends StandardSchemaV1
> = TTypes extends { input: infer TInput }
  ? TInput
  : InferOutput<TInputSchema, unknown>;

type SetupOutput<
  TTypes,
  TOutputSchema extends StandardSchemaV1
> = TTypes extends { output: infer TOutput }
  ? TOutput
  : InferOutput<TOutputSchema, unknown>;

type SetupEmitted<
  TTypes,
  TEmittedSchemaMap extends Record<string, StandardSchemaV1>
> = TTypes extends { emitted: infer TEmitted }
  ? TEmitted & EventObject
  : WithDefault<InferEvents<TEmittedSchemaMap>, AnyEventObject>;

type SetupMeta<TTypes, TMetaSchema extends StandardSchemaV1> = TTypes extends {
  meta: infer TMeta;
}
  ? TMeta & MetaObject
  : InferOutput<TMetaSchema, MetaObject>;

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
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TContextRequired extends boolean
> = Omit<
  Next_MachineConfig<
    TContextSchema,
    TEventSchemaMap,
    TEmittedSchemaMap,
    TInputSchema,
    TOutputSchema,
    TMetaSchema,
    TTagSchema,
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
    | string
    | InitialTransitionWithInput<TStateSchemas, TContext, TEvent>
    | { target: string; input?: Record<string, unknown> }
    | undefined;
  states?: StatesWithInput<
    TStateSchemas,
    TStateSchemas,
    TContext,
    TEvent,
    TDelays,
    TTag,
    InferEvents<TEmittedSchemaMap> extends EventObject
      ? InferEvents<TEmittedSchemaMap>
      : EventObject,
    InferOutput<TMetaSchema, MetaObject>,
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
  TRootStateSchemas extends Record<string, SetupStateSchema>,
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
    'on' | 'always'
  > & {
    on?: StateTransitions<
      TRootStateSchemas,
      StateContext<TStateSchema, TContext>,
      TEvent,
      TEmitted,
      TMeta
    >;
    always?: StateTransitionConfigOrTarget<
      TRootStateSchemas,
      StateContext<TStateSchema, TContext>,
      TEvent,
      TEvent,
      TEmitted,
      TMeta
    >;
  },
  TStateSchema['states'] extends Record<string, SetupStateSchema>
    ? StatesWithInput<
        TRootStateSchemas,
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
  | string
  | undefined
  | {
      target?: string | string[];
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
  TTypes = {}
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
    TTag extends SetupTags<TTypes, TTagSchema>,
    TInput,
    TConfig extends SetupMachineConfig<
      TStates,
      TContextSchema,
      TEventSchemaMap,
      TEmittedSchemaMap,
      TInputSchema,
      TOutputSchema,
      TMetaSchema,
      TTagSchema,
      SetupContext<TTypes, TContextSchema>,
      SetupEvents<TTypes, TEventSchemaMap>,
      TDelays,
      TTag,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      SetupContextRequired<TTypes, TContextSchema>
    >
  >(
    config: TConfig &
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
    SetupContext<TTypes, TContextSchema>,
    | SetupEvents<TTypes, TEventSchemaMap>
    | ([RoutableStateId<Cast<TConfig, StateSchema>>] extends [never]
        ? never
        : {
            type: 'xstate.route';
            to: RoutableStateId<Cast<TConfig, StateSchema>>;
          }),
    Cast<ToChildren<TActor>, Record<string, AnyActorRef | undefined>>,
    StateValue,
    TTag & string,
    TTypes extends { input: unknown }
      ? SetupInput<TTypes, TInputSchema>
      : TInput,
    SetupOutput<TTypes, TOutputSchema>,
    SetupEmitted<TTypes, TEmittedSchemaMap>,
    SetupMeta<TTypes, TMetaSchema>,
    MergeStateSchema<
      Cast<TConfig, StateSchema>,
      SetupStatesToStateSchema<TStates>
    >,
    TActionMap,
    TActorMap,
    TGuardMap,
    DelayMapFromNames<TDelays, TDelayMap>
  >;

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
  TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >,
  TTypes extends Partial<
    Next_SetupTypes<
      MachineContext,
      EventObject,
      string,
      unknown,
      unknown,
      EventObject,
      MetaObject
    >
  > = {}
>(config: SetupConfig<TStates, TTypes> = {}): SetupReturn<TStates, TTypes> {
  const { states = {} as TStates } = config;

  return {
    createMachine(machineConfig) {
      // TODO: merge state input schemas into machine config
      return new StateMachine(machineConfig as any) as any;
    },
    states
  };
}
