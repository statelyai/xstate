export enum InterpreterStatus {
  NotStarted = 0,
  Running = 1,
  Stopped = 2
}

export type SingleOrArray<T> = T[] | T;
export interface EventObject {
  type: string;
}

export namespace StateMachine {
  export type Action<TContext, TEvent extends EventObject> =
    | string
    | StateMachine.AssignActionObject<TContext, TEvent>
    | StateMachine.ActionObject<TContext, TEvent>
    | ((context: TContext, event: TEvent) => void);

  export interface ActionObject<TContext, TEvent extends EventObject> {
    type: string;
    exec?: (context: TContext, event: TEvent) => void;
    [key: string]: any;
  }

  export type ActionFunction<TContext, TEvent extends EventObject> = (
    context: TContext,
    event: TEvent
  ) => void;

  export type AssignAction = 'xstate.assign';

  export interface AssignActionObject<TContext, TEvent extends EventObject>
    extends ActionObject<TContext, TEvent> {
    type: AssignAction;
    assignment: Assigner<TContext, TEvent> | PropertyAssigner<TContext, TEvent>;
  }

  export type Transition<TContext, TEvent extends EventObject> =
    | string
    | {
        target?: string;
        actions?: SingleOrArray<Action<TContext, TEvent>>;
        cond?: (context: TContext, event: TEvent) => boolean;
      };
  export interface State<
    TContext,
    TEvent extends EventObject,
    TState extends Typestate<TContext>
  > {
    value: string;
    context: TContext;
    actions: Array<ActionObject<TContext, TEvent>>;
    changed?: boolean | undefined;
    matches: <TSV extends TState['value']>(
      value: TSV
    ) => this is TState extends { value: TSV } ? TState : never;
  }

  export interface Config<TContext, TEvent extends EventObject> {
    id?: string;
    initial: string;
    context?: TContext;
    states: {
      [key: string]: {
        on?: {
          [K in TEvent['type']]?: SingleOrArray<
            StateMachine.Transition<
              TContext,
              TEvent extends { type: K } ? TEvent : never
            >
          >;
        };
        exit?: SingleOrArray<StateMachine.Action<TContext, TEvent>>;
        entry?: SingleOrArray<StateMachine.Action<TContext, TEvent>>;
      };
    };
  }

  export interface Machine<
    TContext,
    TEvent extends EventObject,
    TState extends Typestate<TContext>
  > {
    initialState: StateMachine.State<TContext, TEvent, TState>;
    transition: (
      state: string | StateMachine.State<TContext, TEvent, TState>,
      event: TEvent['type'] | TEvent
    ) => StateMachine.State<TContext, TEvent, TState>;
  }

  export type StateListener<T extends StateMachine.State<any, any, any>> = (
    state: T
  ) => void;

  export interface Service<
    TContext,
    TEvent extends EventObject,
    TState extends Typestate<TContext> = any
  > {
    send: (event: TEvent | TEvent['type']) => void;
    subscribe: (
      listener: StateListener<State<TContext, TEvent, TState>>
    ) => {
      unsubscribe: () => void;
    };
    start: () => Service<TContext, TEvent, TState>;
    stop: () => Service<TContext, TEvent, TState>;
    readonly status: InterpreterStatus;
  }

  export type Assigner<TContext, TEvent extends EventObject> = (
    context: TContext,
    event: TEvent
  ) => Partial<TContext>;

  export type PropertyAssigner<TContext, TEvent extends EventObject> = {
    [K in keyof TContext]?:
      | ((context: TContext, event: TEvent) => TContext[K])
      | TContext[K];
  };
}

export interface Typestate<TContext> {
  value: string;
  context: TContext;
}
