import type { EventObject, MachineContext } from './types.ts';
import type { StandardSchemaV1 } from './schema.types.ts';
import type { SetupSchemas, SetupStateSchema } from './setup.ts';
import type { InferEvents } from './types.v6.ts';

export type FSMArgs<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  context: TContext;
  event: TEvent;
};

export type FSMContextPatch<TContext extends MachineContext> =
  Partial<TContext>;

export type FSMTransitionConfig<
  TContext extends MachineContext,
  TState extends string
> = {
  target?: TState;
  context?: FSMContextPatch<TContext>;
};

export type FSMTransitionFunction<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TTransitionContext extends MachineContext = TContext
> = (
  args: FSMArgs<TContext, TEvent>
) => FSMTransitionConfig<TTransitionContext, TState> | undefined;

type EventForType<TEvent extends EventObject, TType extends string> = [
  Extract<TEvent, { type: TType }>
] extends [never]
  ? TEvent
  : Extract<TEvent, { type: TType }>;

export type FSMTransition<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TTransitionContext extends MachineContext = TContext
> =
  | TState
  | FSMTransitionConfig<TTransitionContext, TState>
  | FSMTransitionFunction<TContext, TEvent, TState, TTransitionContext>;

type FSMOn<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TTransitionContext extends MachineContext = TContext
> = {
  [TType in TEvent['type'] & string]?: FSMTransition<
    TContext,
    EventForType<TEvent, TType>,
    TState,
    TTransitionContext
  >;
};

export type FSMStateConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TTransitionContext extends MachineContext = TContext
> = {
  on?: FSMOn<TContext, TEvent, TState, TTransitionContext>;
};

export type FSMConfig<
  TContext extends MachineContext = {},
  TEvent extends EventObject = EventObject,
  TState extends string = string
> = {
  id?: string;
  initial: TState;
  context?: TContext;
  states: { [K in TState]: FSMStateConfig<TContext, TEvent, TState> };
};

type FSMConfigForStates<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TStates extends Record<string, unknown>
> = Omit<
  FSMConfig<TContext, TEvent, keyof TStates & string>,
  'initial' | 'states'
> & {
  initial: keyof TStates & string;
  states: {
    [K in keyof TStates]: FSMStateConfig<
      TContext,
      TEvent,
      keyof TStates & string
    >;
  };
};

export type FSMSnapshot<
  TContext extends MachineContext,
  TState extends string
> = {
  value: TState;
  context: TContext;
};

export type FSM<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TSnapshot extends { value: TState; context: MachineContext } = FSMSnapshot<
    TContext,
    TState
  >,
  TConfig = FSMConfig<TContext, TEvent, TState>
> = {
  readonly id: string | undefined;
  readonly config: TConfig;
  readonly initialState: TSnapshot;
  transition(snapshot: TSnapshot, event: TEvent): TSnapshot;
};

type FSMSetupSchemas = Pick<SetupSchemas, 'context' | 'events'>;
type FSMSetupStates = Record<string, SetupStateSchema>;

type FSMSetupContext<TSchemas extends FSMSetupSchemas> = TSchemas extends {
  context: infer TSchema extends StandardSchemaV1;
}
  ? StandardSchemaV1.InferOutput<TSchema> & MachineContext
  : MachineContext;

type FSMSetupEvents<TSchemas extends FSMSetupSchemas> = TSchemas extends {
  events: infer TEventSchemas extends Record<string, StandardSchemaV1>;
}
  ? InferEvents<TEventSchemas>
  : EventObject;

type FSMStateContext<
  TStateSchema,
  TGlobalContext extends MachineContext
> = TStateSchema extends { schemas?: infer TSchemas }
  ? TSchemas extends {
      context?: infer TSchema extends StandardSchemaV1;
    }
    ? StandardSchemaV1.InferOutput<TSchema> & MachineContext
    : TGlobalContext
  : TGlobalContext;

type FSMContextFromStates<
  TStates extends FSMSetupStates,
  TGlobalContext extends MachineContext
> = [keyof TStates] extends [never]
  ? TGlobalContext
  : {
      [K in keyof TStates & string]: FSMStateContext<
        TStates[K],
        TGlobalContext
      >;
    }[keyof TStates & string];

type FSMSetupSnapshot<
  TStates extends FSMSetupStates,
  TGlobalContext extends MachineContext,
  TMachineStates extends Record<string, unknown>
> = {
  [K in keyof TMachineStates & string]: {
    value: K;
    context: FSMStateContext<
      K extends keyof TStates ? TStates[K] : {},
      TGlobalContext
    >;
  };
}[keyof TMachineStates & string];

type FSMSetupMachineConfig<
  TSchemas extends FSMSetupSchemas,
  TStates extends FSMSetupStates,
  TMachineStates extends Record<string, unknown>
> = {
  id?: string;
  initial: keyof TMachineStates & string;
  context?: NoInfer<FSMContextFromStates<TStates, FSMSetupContext<TSchemas>>>;
  states: {
    [K in keyof TMachineStates]: FSMStateConfig<
      FSMStateContext<
        K extends keyof TStates ? TStates[K] : {},
        FSMSetupContext<TSchemas>
      >,
      FSMSetupEvents<TSchemas>,
      keyof TMachineStates & string,
      FSMContextFromStates<TStates, FSMSetupContext<TSchemas>>
    >;
  };
};

export type FSMSetupConfig<
  TSchemas extends FSMSetupSchemas = {},
  TStates extends FSMSetupStates = {}
> = {
  schemas?: TSchemas;
  states?: TStates;
};

export type FSMSetupReturn<
  TSchemas extends FSMSetupSchemas,
  TStates extends FSMSetupStates
> = {
  createFSM<
    const TMachineStates extends Record<string, unknown> = Record<
      string,
      unknown
    >
  >(
    config: FSMSetupMachineConfig<TSchemas, TStates, TMachineStates>
  ): FSM<
    FSMContextFromStates<TStates, FSMSetupContext<TSchemas>>,
    FSMSetupEvents<TSchemas>,
    keyof TMachineStates & string,
    FSMSetupSnapshot<TStates, FSMSetupContext<TSchemas>, TMachineStates>,
    FSMSetupMachineConfig<TSchemas, TStates, TMachineStates>
  >;
};

export function setup<
  const TSchemas extends FSMSetupSchemas = {},
  const TStates extends FSMSetupStates = {}
>(
  _config: FSMSetupConfig<TSchemas, TStates> = {}
): FSMSetupReturn<TSchemas, TStates> {
  return {
    createFSM: (config: FSMConfig) => createFSM(config)
  } as unknown as FSMSetupReturn<TSchemas, TStates>;
}

export function createFSM<
  TContext extends MachineContext = {},
  TEvent extends EventObject = EventObject,
  const TStates extends Record<string, unknown> = Record<string, unknown>
>(
  config: FSMConfigForStates<TContext, TEvent, TStates>
): FSM<TContext, TEvent, keyof TStates & string> {
  type TState = keyof TStates & string;
  const initialState: FSMSnapshot<TContext, TState> = {
    value: config.initial,
    context: config.context ?? ({} as TContext)
  };

  return {
    id: config.id,
    config,
    initialState,
    transition(snapshot, event) {
      const stateConfig = config.states[snapshot.value];
      const transitions = stateConfig?.on as
        | Record<string, FSMTransition<TContext, TEvent, TState> | undefined>
        | undefined;
      const transition =
        transitions && Object.hasOwn(transitions, event.type)
          ? transitions[event.type]
          : undefined;

      if (transition === undefined) {
        return snapshot;
      }

      const args = { context: snapshot.context, event };
      const result =
        typeof transition === 'function'
          ? transition(args)
          : typeof transition === 'string'
            ? { target: transition }
            : transition;

      if (!result) {
        return snapshot;
      }

      const contextPatch = result.context;
      const context = contextPatch
        ? { ...snapshot.context, ...contextPatch }
        : snapshot.context;
      const value = result.target ?? snapshot.value;

      if (value === snapshot.value && context === snapshot.context) {
        return snapshot;
      }

      return { value, context };
    }
  };
}
