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
  WithDefault
} from './types.v6.ts';

/** State schema with optional inputSchema and nested states */
export interface SetupStateSchema {
  inputSchema?: StandardSchemaV1;
  states?: Record<string, SetupStateSchema>;
}

/** Configuration for setup() */
export interface SetupConfig<
  TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >
> {
  types?: unknown;
  states?: TStates;
}

/** Extracts input type from a state schema */
export type StateInput<TStateSchema extends SetupStateSchema> =
  TStateSchema['inputSchema'] extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TStateSchema['inputSchema']>
    : undefined;

/**
 * Flattens nested state schemas into a flat map of state keys to input types.
 * This includes both top-level states and nested states.
 */
export type FlattenStateInputMap<
  TStates extends Record<string, SetupStateSchema>
> = {
  [K in keyof TStates & string]: StateInput<TStates[K]>;
} & UnionToIntersection<
  {
    [K in keyof TStates & string]: TStates[K]['states'] extends Record<
      string,
      SetupStateSchema
    >
      ? FlattenStateInputMap<TStates[K]['states']>
      : {};
  }[keyof TStates & string]
>;

/** Helper type to convert union to intersection */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/**
 * Converts SetupStateSchema to StateSchema with input types included. This
 * allows getInputs() to be strongly typed.
 */
export type SetupStateSchemaToStateSchema<
  TSetupSchema extends SetupStateSchema
> = {
  input: StateInput<TSetupSchema>;
  states: TSetupSchema['states'] extends Record<string, SetupStateSchema>
    ? {
        [K in keyof TSetupSchema['states'] &
          string]: SetupStateSchemaToStateSchema<TSetupSchema['states'][K]>;
      }
    : undefined;
};

/** Converts the root setup states config to a StateSchema. */
export type SetupStatesToStateSchema<
  TStates extends Record<string, SetupStateSchema>
> = {
  states: {
    [K in keyof TStates & string]: SetupStateSchemaToStateSchema<TStates[K]>;
  };
};

/** Get input type for a state key from the flattened input map */
type GetStateInput<
  TInputMap extends Record<string, unknown>,
  K extends string
> = K extends keyof TInputMap ? TInputMap[K] : undefined;

/** Machine config with typed state input */
export type SetupMachineConfig<
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
> = Omit<
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
  'states'
> & {
  states?: TStateSchema['states'] extends Record<string, SetupStateSchema>
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
      };
};

/** Initial transition with typed input based on target state */
export type InitialTransitionWithInput<
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
  >
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
    TTag extends StandardSchemaV1.InferOutput<TTagSchema> & string,
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
      InferOutput<TContextSchema, MachineContext>,
      InferEvents<TEventSchemaMap>,
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
    InferOutput<TContextSchema, MachineContext>,
    | InferEvents<TEventSchemaMap>
    | ([RoutableStateId<Cast<TConfig, StateSchema>>] extends [never]
        ? never
        : {
            type: 'xstate.route';
            to: RoutableStateId<Cast<TConfig, StateSchema>>;
          }),
    Cast<ToChildren<TActor>, Record<string, AnyActorRef | undefined>>,
    StateValue,
    TTag & string,
    TInput,
    InferOutput<TOutputSchema, unknown>,
    WithDefault<InferEvents<TEmittedSchemaMap>, AnyEventObject>,
    InferOutput<TMetaSchema, MetaObject>,
    SetupStatesToStateSchema<TStates>,
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
 *       inputSchema: z.object({
 *         userId: z.string()
 *       })
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
  >
>(config: SetupConfig<TStates> = {}): SetupReturn<TStates> {
  const { states = {} as TStates } = config;

  return {
    createMachine(machineConfig) {
      // TODO: merge state input schemas into machine config
      return new StateMachine(machineConfig as any) as any;
    },
    states
  };
}
