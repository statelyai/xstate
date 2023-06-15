type AnyFunction = (...args: any[]) => any;
type ReturnTypeOrValue<T> = T extends AnyFunction ? ReturnType<T> : T;

export enum InterpreterStatus {
  NotStarted = 0,
  Running = 1,
  Stopped = 2
}

export type SingleOrArray<T> = T[] | T;
export interface EventObject {
  type: string;
}

export type InitEvent = { type: 'xstate.init' };

export type ContextFrom<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends StateMachine.Machine<infer TContext, any, any>
    ? TContext
    : R extends StateMachine.Service<infer TContext, any, any>
    ? TContext
    : never
  : never;

export type EventFrom<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends StateMachine.Machine<any, infer TEvent, any>
    ? TEvent
    : R extends StateMachine.Service<any, infer TEvent, any>
    ? TEvent
    : never
  : never;

export type StateFrom<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends StateMachine.Machine<infer TContext, infer TEvent, infer TState>
    ? StateMachine.State<TContext, TEvent, TState>
    : R extends StateMachine.Service<infer TContext, infer TEvent, infer TState>
    ? StateMachine.State<TContext, TEvent, TState>
    : never
  : never;

export type ServiceFrom<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends StateMachine.Machine<infer TContext, infer TEvent, infer TState>
    ? StateMachine.Service<TContext, TEvent, TState>
    : never
  : never;

export type MachineImplementationsFrom<
  TMachine extends StateMachine.AnyMachine
> = {
  actions?: StateMachine.ActionMap<ContextFrom<TMachine>, EventFrom<TMachine>>;
};

export namespace StateMachine {
  export type Action<TContext extends object, TEvent extends EventObject> =
    | string
    | AssignActionObject<TContext, TEvent>
    | ActionObject<TContext, TEvent>
    | ActionFunction<TContext, TEvent>;

  export type ActionMap<
    TContext extends object,
    TEvent extends EventObject
  > = Record<string, Exclude<Action<TContext, TEvent>, string>>;

  export interface ActionObject<
    TContext extends object,
    TEvent extends EventObject
  > {
    type: string;
    exec?: ActionFunction<TContext, TEvent>;
    [key: string]: any;
  }

  export type ActionFunction<
    TContext extends object,
    TEvent extends EventObject
  > = (context: TContext, event: TEvent | InitEvent) => void;

  export type AssignAction = 'xstate.assign';

  export interface AssignActionObject<
    TContext extends object,
    TEvent extends EventObject
  > extends ActionObject<TContext, TEvent> {
    type: AssignAction;
    assignment: Assigner<TContext, TEvent> | PropertyAssigner<TContext, TEvent>;
  }

  export type Transition<
    TContext extends object,
    TEvent extends EventObject,
    TStateValue extends string = string
  > =
    | TStateValue
    | {
        target?: TStateValue;
        actions?: SingleOrArray<Action<TContext, TEvent>>;
        cond?: (context: TContext, event: TEvent) => boolean;
      };
  export interface State<
    TContext extends object,
    TEvent extends EventObject,
    TState extends Typestate<TContext>
  > {
    value: TState['value'];
    context: TContext;
    actions: Array<ActionObject<TContext, TEvent>>;
    changed?: boolean | undefined;
    matches: <TSV extends TState['value']>(
      value: TSV
    ) => this is State<
      (TState extends any
        ? { value: TSV; context: any } extends TState
          ? TState
          : never
        : never)['context'],
      TEvent,
      TState
    > & { value: TSV };
  }

  export type AnyMachine = StateMachine.Machine<any, any, any>;

  export type AnyService = StateMachine.Service<any, any, any>;

  export type AnyState = State<any, any, any>;

  export interface Config<
    TContext extends object,
    TEvent extends EventObject,
    TState extends Typestate<TContext> = Typestate<TContext>
  > {
    id?: string;
    initial: TState['value'];
    context?: TContext;
    states: {
      [key in TState['value']]: {
        on?: {
          [K in TEvent['type'] | '*']?: SingleOrArray<
            K extends '*'
              ? Transition<TContext, TEvent, TState['value']>
              : Transition<
                  TContext,
                  TEvent extends { type: K } ? TEvent : never,
                  TState['value']
                >
          >;
        };
        exit?: SingleOrArray<Action<TContext, TEvent>>;
        entry?: SingleOrArray<Action<TContext, TEvent>>;
      };
    };
  }

  export interface Machine<
    TContext extends object,
    TEvent extends EventObject,
    TState extends Typestate<TContext>
  > {
    config: StateMachine.Config<TContext, TEvent, TState>;
    initialState: State<TContext, TEvent, TState>;
    transition: (
      state: string | State<TContext, TEvent, TState>,
      event: TEvent['type'] | TEvent
    ) => State<TContext, TEvent, TState>;
  }

  export type StateListener<T extends AnyState> = (state: T) => void;

  export interface Service<
    TContext extends object,
    TEvent extends EventObject,
    TState extends Typestate<TContext> = { value: any; context: TContext }
  > {
    send: (event: TEvent | TEvent['type']) => void;
    subscribe: (listener: StateListener<State<TContext, TEvent, TState>>) => {
      unsubscribe: () => void;
    };
    start: (
      initialState?:
        | TState['value']
        | { context: TContext; value: TState['value'] }
    ) => Service<TContext, TEvent, TState>;
    stop: () => Service<TContext, TEvent, TState>;
    readonly status: InterpreterStatus;
    readonly state: State<TContext, TEvent, TState>;
  }

  export type Assigner<TContext extends object, TEvent extends EventObject> = (
    context: TContext,
    event: TEvent
  ) => Partial<TContext>;

  export type PropertyAssigner<
    TContext extends object,
    TEvent extends EventObject
  > = {
    [K in keyof TContext]?:
      | ((context: TContext, event: TEvent) => TContext[K])
      | TContext[K];
  };
}

export interface Typestate<TContext extends object> {
  value: string;
  context: TContext;
}

export type ExtractEvent<
  TEvent extends EventObject,
  TEventType extends TEvent['type']
> = TEvent extends { type: TEventType } ? TEvent : never;
