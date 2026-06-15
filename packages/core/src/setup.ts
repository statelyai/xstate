import { StandardSchemaV1 } from './schema.types.ts';
import { StateMachine } from './StateMachine.ts';
import {
  AnyActorRef,
  EventObject,
  AnyEventObject,
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
  Implementations,
  InferOutput,
  InferEvents,
  Next_MachineConfig,
  Next_StateNodeConfig,
  Next_SetupTypes,
  WithDefault
} from './types.v6.ts';

type SetupStateSchemas = {
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
  : InferOutput<TContextSchema, MachineContext>;

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
> = Omit<TConfig, 'input' | 'states'> & {
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
  TDelayMap extends Implementations['delays']
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
    TDelayMap
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
  Next_StateNodeConfig<
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
    StateInput<TStateSchema>
  >,
  TStateSchema['states'] extends Record<string, SetupStateSchema>
    ? StatesWithInput<
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
      TDelayMap
    >
  >(
    config: TConfig
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
    TDelayMap
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
