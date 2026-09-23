import type {
  EventObject,
  InferEvents,
  MachineContext,
  SetupSchemas,
  SetupStateSchema
} from './base.types.ts';
import type { StandardSchemaV1 } from './schema.types.ts';

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

type FSMContextConfig<TContext extends MachineContext> =
  string extends keyof TContext
    ? { context?: TContext }
    : keyof TContext extends never
      ? { context?: TContext }
      : { context: TContext };

export type FSMConfig<
  TContext extends MachineContext = {},
  TEvent extends EventObject = EventObject,
  TState extends string = string
> = {
  id?: string;
  initial: TState;
  states: { [K in TState]: FSMStateConfig<TContext, TEvent, TState> };
} & FSMContextConfig<TContext>;

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

/**
 * A snapshot of a compact FSM. `status`, `output`, and `error` match the
 * snapshot shape shared by all actor logic, so an FSM can run in
 * `createActor`. An FSM snapshot is always `'active'`.
 *
 * @public
 */
export type FSMSnapshot<
  TContext extends MachineContext,
  TState extends string
> = {
  status: 'active';
  value: TState;
  context: TContext;
  output: undefined;
  error: undefined;
};

/**
 * The result of an FSM transition: `[nextSnapshot, effects]`. FSMs have no
 * effects, so `effects` is always empty. The tuple matches the
 * `(snapshot, event) => [snapshot, effects]` protocol shared with full XState
 * actor logic.
 *
 * @public
 */
export type FSMTransitionResult<TSnapshot> = [
  nextSnapshot: TSnapshot,
  effects: never[]
];

/**
 * Pure logic returned by `createFSM`. It structurally satisfies `ActorLogic`,
 * so it works with `createActor`, `transition`, and `initialTransition` from
 * `xstate`.
 *
 * @public
 */
export type FSM<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TSnapshot extends FSMSnapshot<MachineContext, TState> = FSMSnapshot<
    TContext,
    TState
  >,
  TConfig = FSMConfig<TContext, TEvent, TState>
> = {
  readonly id: string | undefined;
  readonly config: TConfig;
  readonly initialState: TSnapshot;
  transition(
    snapshot: TSnapshot,
    event: TEvent
  ): FSMTransitionResult<TSnapshot>;
  initialTransition(input?: unknown): FSMTransitionResult<TSnapshot>;
  getInitialSnapshot(actorScope?: unknown, input?: unknown): TSnapshot;
  getPersistedSnapshot(snapshot: TSnapshot): TSnapshot;
};

type FSMSetupSchemas = Pick<SetupSchemas, 'context' | 'events'>;
type FSMSetupStates = Record<string, SetupStateSchema>;

type FSMSchemaContext<TSchema extends StandardSchemaV1> =
  StandardSchemaV1.InferOutput<TSchema> extends MachineContext
    ? StandardSchemaV1.InferOutput<TSchema>
    : MachineContext;

type FSMSetupContext<TSchemas extends FSMSetupSchemas> = TSchemas extends {
  context: infer TSchema extends StandardSchemaV1;
}
  ? FSMSchemaContext<TSchema>
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
    ? FSMSchemaContext<TSchema> &
        ([MachineContext] extends [TGlobalContext] ? unknown : TGlobalContext)
    : TGlobalContext
  : TGlobalContext;

type FSMContextFromDeclaredStates<
  TStates extends FSMSetupStates,
  TGlobalContext extends MachineContext
> = {
  [K in keyof TStates & string]: FSMStateContext<TStates[K], TGlobalContext>;
}[keyof TStates & string];

type FSMContextFromStates<
  TStates extends FSMSetupStates,
  TGlobalContext extends MachineContext
> = [keyof TStates] extends [never]
  ? TGlobalContext
  : [MachineContext] extends [TGlobalContext]
    ? FSMContextFromDeclaredStates<TStates, TGlobalContext>
    : TGlobalContext | FSMContextFromDeclaredStates<TStates, TGlobalContext>;

type FSMSetupStateContext<
  TState extends string,
  TStates extends FSMSetupStates,
  TGlobalContext extends MachineContext
> = TState extends keyof TStates
  ? FSMStateContext<TStates[TState], TGlobalContext>
  : TGlobalContext;

type FSMSetupSnapshot<
  TStates extends FSMSetupStates,
  TGlobalContext extends MachineContext,
  TMachineStates extends Record<string, unknown>
> = [keyof TStates] extends [never]
  ? FSMSnapshot<TGlobalContext, keyof TMachineStates & string>
  : {
      [K in keyof TMachineStates & string]: FSMSnapshot<
        FSMSetupStateContext<K, TStates, TGlobalContext>,
        K
      >;
    }[keyof TMachineStates & string];

type FSMSetupTargetTransitionConfig<
  TSourceContext extends MachineContext,
  TTarget extends string,
  TTargetContext extends MachineContext
> = [FSMRequiredTargetContextKeys<TSourceContext, TTargetContext>] extends [
  never
]
  ? {
      target: TTarget;
      context?: FSMTargetContextPatch<TSourceContext, TTargetContext>;
    }
  : {
      target: TTarget;
      context: FSMTargetContextPatch<TSourceContext, TTargetContext>;
    };

type FSMRequiredTargetContextKeys<TSourceContext, TTargetContext> = {
  [K in keyof TTargetContext]-?: K extends keyof TSourceContext
    ? [TSourceContext[K]] extends [TTargetContext[K]]
      ? never
      : K
    : K;
}[keyof TTargetContext];

type FSMTargetContextPatch<TSourceContext, TTargetContext> =
  Partial<TTargetContext> &
    Pick<
      TTargetContext,
      Extract<
        FSMRequiredTargetContextKeys<TSourceContext, TTargetContext>,
        string
      >
    >;

type FSMSetupTransitionConfig<
  TSourceContext extends MachineContext,
  TStates extends FSMSetupStates,
  TGlobalContext extends MachineContext
> =
  | { target?: undefined; context?: FSMContextPatch<TSourceContext> }
  | {
      [TTarget in keyof TStates & string]: FSMSetupTargetTransitionConfig<
        TSourceContext,
        TTarget,
        FSMSetupStateContext<TTarget, TStates, TGlobalContext>
      >;
    }[keyof TStates & string];

type FSMSetupStringTransition<
  TSourceContext extends MachineContext,
  TStates extends FSMSetupStates,
  TGlobalContext extends MachineContext
> = {
  [TTarget in keyof TStates & string]: [TSourceContext] extends [
    FSMSetupStateContext<TTarget, TStates, TGlobalContext>
  ]
    ? TTarget
    : never;
}[keyof TStates & string];

type FSMSetupTransitionFunction<
  TSourceContext extends MachineContext,
  TEvent extends EventObject,
  TStates extends FSMSetupStates,
  TGlobalContext extends MachineContext
> = (
  args: FSMArgs<TSourceContext, TEvent>
) =>
  | FSMSetupTransitionConfig<TSourceContext, TStates, TGlobalContext>
  | undefined;

type FSMSetupTransition<
  TSourceContext extends MachineContext,
  TEvent extends EventObject,
  TStates extends FSMSetupStates,
  TGlobalContext extends MachineContext,
  TMachineStates extends Record<string, unknown>
> = [keyof TStates] extends [never]
  ? FSMTransition<TSourceContext, TEvent, keyof TMachineStates & string>
  :
      | FSMSetupStringTransition<TSourceContext, TStates, TGlobalContext>
      | FSMSetupTransitionConfig<TSourceContext, TStates, TGlobalContext>
      | FSMSetupTransitionFunction<
          TSourceContext,
          TEvent,
          TStates,
          TGlobalContext
        >;

type FSMSetupStateConfig<
  TSourceContext extends MachineContext,
  TEvent extends EventObject,
  TStates extends FSMSetupStates,
  TGlobalContext extends MachineContext,
  TMachineStates extends Record<string, unknown>
> = {
  on?: {
    [TType in TEvent['type'] & string]?: FSMSetupTransition<
      TSourceContext,
      EventForType<TEvent, TType>,
      TStates,
      TGlobalContext,
      TMachineStates
    >;
  };
};

type FSMSetupMachineConfig<
  TSchemas extends FSMSetupSchemas,
  TStates extends FSMSetupStates,
  TMachineStates extends Record<string, unknown>
> = {
  id?: string;
  initial: keyof TMachineStates & string;
  states: {
    [K in keyof TMachineStates]: FSMSetupStateConfig<
      FSMStateContext<
        K extends keyof TStates ? TStates[K] : {},
        FSMSetupContext<TSchemas>
      >,
      FSMSetupEvents<TSchemas>,
      TStates,
      FSMSetupContext<TSchemas>,
      TMachineStates
    >;
  };
} & FSMContextConfig<FSMContextFromStates<TStates, FSMSetupContext<TSchemas>>>;

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
  createFSM<const TMachineStates extends Record<string, unknown>>(
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
): FSM<
  TContext,
  TEvent,
  keyof TStates & string,
  FSMSnapshot<TContext, keyof TStates & string>,
  FSMConfigForStates<TContext, TEvent, TStates>
> {
  type TState = keyof TStates & string;
  type TSnapshot = FSMSnapshot<TContext, TState>;
  // `output` and `error` are always `undefined` for an FSM snapshot, so they
  // are left off the runtime object to keep the entry small.
  const initialState = {
    status: 'active',
    value: config.initial,
    context: config.context ?? ({} as TContext)
  } as TSnapshot;

  return {
    id: config.id,
    config,
    initialState,
    initialTransition: () => [initialState, []],
    getInitialSnapshot: () => initialState,
    getPersistedSnapshot: (snapshot) => snapshot,
    transition(snapshot, event) {
      let { value, context } = snapshot;
      const transitions = config.states[value]?.on as
        | Record<string, FSMTransition<TContext, TEvent, TState> | undefined>
        | undefined;
      const transition =
        Object.hasOwn(transitions || {}, event.type) &&
        transitions![event.type];
      const { target = value, context: patch } =
        (typeof transition === 'string'
          ? { target: transition }
          : typeof transition === 'function'
            ? transition({ context, event })
            : transition) || {};
      // Copy only when the patch changes a value, so a no-op patch keeps the
      // current snapshot. After the first copy every key matches.
      for (const key in patch) {
        if (patch[key] !== context[key]) {
          context = { ...context, ...patch };
        }
      }

      return [
        target === value && context === snapshot.context
          ? snapshot
          : ({ status: 'active', value: target, context } as TSnapshot),
        []
      ];
    }
  };
}
