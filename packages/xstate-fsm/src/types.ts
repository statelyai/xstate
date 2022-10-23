import { MachineSchema } from './schema';

export type SingleOrArray<T> = T[] | T;

export interface EventObject {
  type: string;
}

export namespace A {
  export type Cast<T, U> = T extends U ? T : U;
  export type Fallback<T, U> = T extends U ? T : U;
  export type Tuple<T = any> = T[] | [T];
  export type Object = object;
  export type String = string;
  export type Function = (...args: any[]) => any;
  export namespace Get {
    const Returned$$ = Symbol('Returned$$');
    export type Returned$$ = typeof Returned$$;
    const Parameters$$ = Symbol('Parameters$$');
    export type Parameters$$ = typeof Parameters$$;
  }
  type _Get<T, P, F> = P extends []
    ? T extends undefined
      ? F
      : T
    : P extends [infer K1, ...infer Kr]
    ? K1 extends keyof T
      ? _Get<T[K1], Kr, F>
      : K1 extends Get.Returned$$
      ? _Get<T extends (...a: any[]) => infer R ? R : undefined, Kr, F>
      : K1 extends Get.Parameters$$
      ? _Get<T extends (...a: infer Args) => any ? Args : undefined, Kr, F>
      : F
    : never;
  export type Get<T, TProps, TDefault = undefined> = TProps extends any[]
    ? _Get<T, TProps, TDefault>
    : _Get<T, [TProps], TDefault>;
}

export type InferNarrowest<T> = T extends any
  ? T extends A.Function
    ? T
    : T extends A.Object
    ? InferNarrowestObject<T>
    : T
  : never;

export type InferNarrowestObject<T> = {
  readonly [K in keyof T]: InferNarrowest<T[K]>;
};

export interface ActorRef<TEvent extends EventObject, _TEmitted> {
  send: (event: TEvent) => void;
  subscribe: (observer: any) => void;
}

export interface Behavior<TEvent extends EventObject, TEmitted> {
  start: () => ActorRef<TEvent, TEmitted>;
}

export interface AssignActionObject<TMachine, TEvent> {
  __xstate?: true;
  type: 'xstate.assign';
  assignment: Assigner<TMachine, TEvent> | PropertyAssigner<TMachine, TEvent>;
}
export type Assigner<TMachine, TEvent> = (
  context: A.Get<TMachine, 'context'>,
  event: TEvent
) => Partial<A.Get<TMachine, 'context'>>;

export type PropertyAssigner<TMachine, TEvent> = {
  [K in keyof A.Get<TMachine, 'context'>]?:
    | ((
        context: A.Get<TMachine, 'context'>,
        event: TEvent
      ) => A.Get<TMachine, ['context', K]>)
    | A.Get<TMachine, ['context', K]>;
};

export interface BaseActionObject {
  type: string;
}

export type ActionFunction<TMachine> = (
  context: A.Get<TMachine, 'context'>,
  event: A.Get<TMachine, ['schema', 'event'], EventObject>
) => void;

export type ActionsConfig<
  TMachine,
  TEvent = A.Get<TMachine, ['schema', 'event']>
> = SingleOrArray<
  | DynamicActionObject<TMachine, TEvent>
  | ActionFunction<TMachine>
  | BaseActionObject
  | string
>;

export type TransitionConfig<
  _Self,
  TMachine,
  TEvent = A.Get<TMachine, ['schema', 'event']>
> =
  | (string & keyof A.Get<TMachine, 'states'>)
  | {
      target?: string & keyof A.Get<TMachine, 'states'>;
      guard?: (context: A.Get<TMachine, 'context'>, event: TEvent) => boolean;
      actions?: ActionsConfig<TMachine, TEvent>;
      assign?: DynamicActionObject<TMachine, TEvent>;
    };

export type InvokeSrc<T, TMachine> =
  | Behavior<any, T>
  | ((
      context: A.Get<TMachine, 'context'>,
      event: A.Get<TMachine, ['schema', 'event']>
    ) => Behavior<any, T>);

export type DoneTransitionConfig<Self, TMachine, TInvoke> = TransitionConfig<
  Self,
  TMachine,
  A.Get<TInvoke, 'src'> extends InvokeSrc<infer T, infer _>
    ? { type: `done.invoke.${string & A.Get<TInvoke, 'id'>}`; data: T }
    : never
>;

export type Action2<TSchema extends MachineSchema> =
  | {
      type: string;
      _schema?: TSchema;
    }
  | ((ctx: TSchema['context'], ev: TSchema['event']) => void);

export type SnapshotFrom<TBehavior> = TBehavior extends Behavior<
  infer _,
  infer T
>
  ? T
  : unknown;

export interface StateNodeConfig<
  Self,
  TMachine extends MachineConfig<any>,
  TContext = A.Get<TMachine, 'context'>,
  TEvent = A.Get<TMachine, ['schema', 'event']>
> {
  entry?: ActionsConfig<TMachine>;
  exit?: ActionsConfig<TMachine>;
  invoke?: {
    id: string;
    src:
      | Behavior<any, any>
      | ((context: TContext, event: TEvent) => Behavior<any, any>);
    onDone?: DoneTransitionConfig<
      A.Get<Self, ['invoke', 'onDone']>,
      TMachine,
      A.Get<Self, 'invoke'>
    >;
  };
  on?: {
    [EventType in string &
      A.Get<TMachine, ['schema', 'event', 'type'], string>]?: {
      //
      event: A.Get<TMachine, ['schema', 'event']>;
      actions: Action2<TEvent>;
    };
    // | TransitionConfig<
    //     A.Get<Self, ['on', EventType]>,
    //     TMachine,
    //     TEvent extends { type: EventType } ? TEvent : never
    //   >
    // | {
    //     [Index in number]: TransitionConfig<
    //       A.Get<Self, ['on', EventType, Index]>,
    //       TMachine,
    //       TEvent extends { type: EventType } ? TEvent : never
    //     >;
    //   };
  };
}

export interface TransitionObject {
  target?: string;
  guard?: (context: any, eventObject: any) => boolean;
  actions?: Array<{ type: string }>;
}

export interface StateNode {
  entry?: Array<{ type: string }>;
  exit?: Array<{ type: string }>;
  invoke?: {
    id: string;
    src: InvokeSrc<any, any>;
  };
  on?: {
    [EventType in string]: TransitionObject[];
  };
}

export type NoInfer<T> = [T][T extends any ? 0 : any];

export interface MachineConfig<
  Self extends MachineConfig<any>,
  TContext = A.Get<Self, 'context'>
> {
  id?: string;
  key?: string;
  context: TContext;
  schema?: {
    event?: EventObject;
  };
  states?: {
    [StateKey in keyof A.Get<Self, 'states'>]?: StateNodeConfig<
      A.Get<Self, ['states', StateKey]>,
      Self
    >;
  };
  on?: {
    [key: string]: {
      target: `.${string & keyof A.Get<Self, 'states'>}`;
    };
  };
  initial?: keyof A.Get<Self, 'states'>;
}

export interface StateFrom<T extends MachineConfig<any> | StateMachine<any>> {
  value: keyof A.Get<T, 'states'> | null;
  context: A.Get<T, 'context'>;
  actions: any[];
}

export interface ActionImplementionMap<TMachine> {
  [key: string]: ActionFunction<TMachine>;
}

export interface Implementations<TMachine> {
  actions?: ActionImplementionMap<TMachine>;
}

export type Executor<TMachine> = (
  action: BaseActionObject,
  context: any,
  event: EventObject,
  implementations?: Implementations<TMachine>
) => void;

export interface StateMachine<T extends MachineConfig<any>> {
  states: {
    [StateKey: string]: StateNode;
  };
  transition: (
    state: StateFrom<T>,
    event: EventObject & A.Get<T, ['schema', 'event'], EventObject>,
    execute?: Executor<T>
  ) => StateFrom<T>;
  initialState: StateFrom<T>;
  getInitialState: (exec: any) => StateFrom<T>;
}

// Taken from RxJS
export interface Observer<T> {
  next: (value: T) => void;
  error?: (err: any) => void;
  complete?: () => void;
}

export type ObserverOrNext<T> = Observer<T> | Observer<T>['next'];

export interface Interpreter {
  start: (state?: StateFrom<any>) => Interpreter;
  send: (event: EventObject) => void;
  subscribe: (
    obs: ObserverOrNext<StateFrom<any>>
  ) => { unsubscribe: () => void };
  getSnapshot: () => StateFrom<any>;
}

export interface DynamicActionObject<
  TMachine,
  TEvent = A.Get<TMachine, ['schema', 'event']>
> {
  type: `xstate.${string}`;
  (ctx: A.Get<TMachine, 'context'>, eventObject: TEvent): { type: string };
  __xstate: true;
}

type FooAction<TEvent> = {
  type: string;
  _event?: TEvent;
};

function assign<T>(assigner: Record<string, (e: T) => void>): FooAction<T> {}

interface Config {
  action: FooAction<{ type: 'a' }>;
}

function make(c: Config) {}

make({
  action: assign({
    something: (e) => {}
  })
});
