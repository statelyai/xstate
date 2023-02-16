export type SingleOrArray<T> = T[] | T;

export interface EventObject {
  type: string;
}

export type AnyEventObject = {
  type: string;
  [key: string]: any;
};

export interface MachineTypes {
  context: Record<string, any>;
  events: EventObject;
}

export interface ActorRef<TBehavior extends AnyBehavior> {
  start: (persistedState?: InternalStateFrom<TBehavior>) => any;
  subscribe: (
    observerOrFn:
      | Observer<SnapshotFrom<TBehavior>>
      | ((snapshot: SnapshotFrom<TBehavior>) => void)
  ) => {
    unsubscribe: () => void;
  };
  send: (event: EventFrom<TBehavior>) => void;
  stop: () => void;
  getSnapshot: () => SnapshotFrom<TBehavior>;
  parent?: ActorRef<Behavior<AnyEventObject, unknown, unknown>>;
}

export interface ActorContext<TBehavior extends AnyBehavior> {
  self: ActorRef<TBehavior>;
}

export interface Behavior<
  TEvent extends EventObject,
  TSnapshot,
  TInternalState
> {
  transition: (
    state: TInternalState,
    event: TEvent,
    actorCtx?: ActorContext<this>
  ) => TInternalState;
  initialState: TInternalState;
  start?: (
    state: TInternalState,
    actorCtx: ActorContext<this>
  ) => TInternalState;
  stop?: (state: TInternalState) => void;
  execute?: (state: TInternalState) => void;
  getSnapshot: (state: TInternalState) => TSnapshot;
}

export type SnapshotFrom<T extends AnyBehavior> = T extends Behavior<
  infer _TEvent,
  infer TSnapshot,
  infer _TInternalState
>
  ? TSnapshot
  : never;

export type InternalStateFrom<T extends AnyBehavior> = T extends Behavior<
  infer _TEvent,
  infer _TSnapshot,
  infer TInternalState
>
  ? TInternalState
  : never;

export type AnyBehavior = Behavior<any, any, any>;

export type EventFrom<T extends AnyBehavior> = T extends Behavior<
  infer TEvent,
  any,
  any
>
  ? TEvent
  : never;

export interface MachineState<T extends MachineTypes> {
  value: string;
  context: T['context'];
  actions: BaseActionObject[];
  changed: boolean;
  children: any;
}

export type Action<T extends MachineTypes, TE extends EventObject> =
  | string
  | ((ctx: T['context'], event: TE) => void)
  | BaseActionObject
  | DynamicActionObject<T, TE>;

export type TransitionStringOrObject<
  T extends MachineTypes,
  TS,
  TE extends EventObject
> =
  | keyof TS
  | {
      target?: keyof TS;
      guard?: (context: T['context'], event: TE) => boolean;
      actions?: SingleOrArray<Action<T, TE>>;
    };

export interface BaseActionObject {
  type: string;
  params?: Record<string, any>;
  execute?: () => void;
}

export interface DynamicActionObject<
  T extends MachineTypes,
  TE extends EventObject
> {
  type: string;
  params: Record<string, any>;
  resolve: (
    state: MachineState<T>,
    event: TE
    // actorCtx: ActorContext
  ) => [MachineState<T>, BaseActionObject];
}

export type Implementations<T extends MachineTypes> = {
  actions?: {
    [key: string]: Action<T, T['events']>;
  };
};

export type MachineBehavior<T extends MachineTypes> = Behavior<
  T['events'],
  MachineState<T>,
  MachineState<T>
> & {
  config: StateMachineConfig<T, any>;
  provide: (implementations: {
    actions?: {
      [key: string]: Action<T, T['events']>;
    };
  }) => MachineBehavior<T>;
  implementations: Implementations<T>;
};

export interface StateMachineConfig<TTypes extends MachineTypes, TStates> {
  initial: keyof TStates & string;
  types?: TTypes;
  context?: TTypes['context'];
  states?: {
    [K in keyof TStates]: {
      invoke?: {
        src: TStates[K] & AnyBehavior;
        // onDone?: TransitionStringOrObject<TTypes, any>;
        onDone?: TransitionStringOrObject<
          TTypes,
          TStates,
          {
            type: 'done';
            data: TStates[K] extends AnyBehavior
              ? Exclude<SnapshotFrom<TStates[K]>, undefined>
              : never;
          }
        >;
        onError?: TransitionStringOrObject<TTypes, TStates, { type: 'error' }>;
      };
      entry?: SingleOrArray<Action<TTypes, TTypes['events']>>;
      exit?: SingleOrArray<Action<TTypes, TTypes['events']>>;
      on?: {
        [K in TTypes['events']['type']]?: TransitionStringOrObject<
          TTypes,
          TStates,
          TTypes['events'] & { type: K }
        >;
      };
    };
  };
}

export interface Observer<T> {
  next?: (value: T) => void;
  error?: (err: any) => void;
  complete?: () => void;
}
