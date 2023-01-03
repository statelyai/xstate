export type SingleOrArray<T> = T[] | T;

export interface EventObject {
  type: string;
}

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
  send: (event: any) => void;
  stop: () => void;
  getSnapshot: () => SnapshotFrom<TBehavior>;
  parent?: ActorRef<any>;
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
}

export type Action<T extends MachineTypes> =
  | string
  | (() => void)
  | BaseActionObject
  | DynamicActionObject<T>;

export type TransitionStringOrObject<
  T extends MachineTypes,
  K extends T['events']['type']
> =
  | string
  | {
      target?: string;
      guard?: (
        context: T['context'],
        event: T['events'] & { type: K }
      ) => boolean;
      actions?: SingleOrArray<Action<T>>;
    };

export interface BaseActionObject {
  type: string;
  params?: Record<string, any>;
  execute?: () => void;
}

export interface DynamicActionObject<T extends MachineTypes> {
  type: string;
  params: Record<string, any>;
  resolve: (
    state: MachineState<T>,
    event: EventObject
    // actorCtx: ActorContext
  ) => [MachineState<T>, BaseActionObject];
}

export type Implementations<T extends MachineTypes> = {
  actions?: {
    [key: string]: Action<T>;
  };
};

export type MachineBehavior<T extends MachineTypes> = Behavior<
  T['events'],
  MachineState<T>,
  MachineState<T>
> & {
  config: StateMachineConfig<T>;
  provide: (implementations: {
    actions?: {
      [key: string]: Action<T>;
    };
  }) => MachineBehavior<T>;
  implementations: Implementations<T>;
};

export interface StateMachineConfig<T extends MachineTypes> {
  initial: string;
  context?: T['context'];
  states?: {
    [key: string]: {
      invoke?: {
        src: AnyBehavior;
        onDone: TransitionStringOrObject<T, any>;
      };
      entry?: SingleOrArray<Action<T>>;
      exit?: SingleOrArray<Action<T>>;
      on?: {
        [K in T['events']['type']]?: TransitionStringOrObject<T, K>;
      };
    };
  };
}

export interface Observer<T> {
  next?: (value: T) => void;
  error?: (err: any) => void;
  complete?: () => void;
}
