import { StandardSchemaV1 } from './schema.types.ts';
import { StateMachine } from './StateMachine.ts';
import {
  AnyActorRef,
  EventObject,
  AnyEventObject,
  MachineContext,
  ProvidedActor,
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

/** State schema with optional paramsSchema and nested states */
export interface SetupStateSchema {
  paramsSchema?: StandardSchemaV1;
  states?: Record<string, SetupStateSchema>;
}

/** Configuration for setup() */
export interface SetupConfig<
  TStates extends Record<string, SetupStateSchema> = Record<
    string,
    SetupStateSchema
  >
> {
  states?: TStates;
}

/** Extracts params type from a state schema */
export type StateParams<TStateSchema extends SetupStateSchema> =
  TStateSchema['paramsSchema'] extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TStateSchema['paramsSchema']>
    : undefined;

/**
 * Flattens nested state schemas into a flat map of state keys to params types.
 * This includes both top-level states and nested states.
 */
export type FlattenStateParamsMap<
  TStates extends Record<string, SetupStateSchema>
> = {
  [K in keyof TStates & string]: StateParams<TStates[K]>;
} & UnionToIntersection<
  {
    [K in keyof TStates & string]: TStates[K]['states'] extends Record<
      string,
      SetupStateSchema
    >
      ? FlattenStateParamsMap<TStates[K]['states']>
      : {};
  }[keyof TStates & string]
>;

/** Helper type to convert union to intersection */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/** Get params type for a state key from the flattened params map */
type GetStateParams<
  TParamsMap extends Record<string, unknown>,
  K extends string
> = K extends keyof TParamsMap ? TParamsMap[K] : undefined;

/** Machine config with typed state params */
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
    | InitialTransitionWithParams<TStateSchemas, TContext, TEvent>
    | { target: string; params?: Record<string, unknown> }
    | undefined;
  states?: StatesWithParams<
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

/** States config type that provides typed params for known states */
type StatesWithParams<
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
  [K in keyof TStateSchemas & string]?: StateNodeConfigWithNestedParams<
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

/** State node config that recursively applies typed params for nested states */
type StateNodeConfigWithNestedParams<
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
    StateParams<TStateSchema>
  >,
  'states'
> & {
  states?: TStateSchema['states'] extends Record<string, SetupStateSchema>
    ? StatesWithParams<
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

/** Initial transition with typed params based on target state */
export type InitialTransitionWithParams<
  TStateSchemas extends Record<string, SetupStateSchema>,
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in keyof TStateSchemas & string]: {
    target: K;
    params?:
      | StateParams<TStateSchemas[K]>
      | ((args: {
          context: TContext;
          event: TEvent;
        }) => StateParams<TStateSchemas[K]>);
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
    TEventSchemaMap extends Record<string, StandardSchemaV1>,
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
    TInput
  >(
    config: SetupMachineConfig<
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
  ): StateMachine<
    InferOutput<TContextSchema, MachineContext>,
    InferEvents<TEventSchemaMap>,
    Cast<ToChildren<TActor>, Record<string, AnyActorRef | undefined>>,
    StateValue,
    TTag & string,
    TInput,
    InferOutput<TOutputSchema, unknown>,
    WithDefault<InferEvents<TEmittedSchemaMap>, AnyEventObject>,
    InferOutput<TMetaSchema, MetaObject>,
    any, // TStateSchema
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
  >;

  /** State param schemas from setup config */
  states: TStates;
}

/**
 * Sets up a state machine with state param schemas and other configuration.
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
 *       paramsSchema: z.object({
 *         userId: z.string()
 *       })
 *     }
 *   }
 * });
 *
 * const machine = s.createMachine({
 *   initial: {
 *     target: 'loading',
 *     params: { userId: '123' }
 *   },
 *   states: {
 *     loading: {
 *       entry: ({ params }) => {
 *         console.log(params.userId);
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
      // TODO: merge state param schemas into machine config
      return new StateMachine(machineConfig as any) as any;
    },
    states
  };
}
