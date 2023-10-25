import type { StateNode } from './StateNode.ts';
import type { State } from './State.ts';
import type { ActorStatus, Clock, Actor } from './interpreter.ts';
import type { MachineSnapshot, StateMachine } from './StateMachine.ts';
import {
  TypegenDisabled,
  ResolveTypegenMeta,
  TypegenConstraint,
  MarkAllImplementationsAsProvided,
  AreAllImplementationsAssumedToBeProvided
} from './typegenTypes.ts';
import { PromiseActorLogic } from './actors/promise.ts';
import { Guard, GuardPredicate, UnknownGuard } from './guards.ts';
import { Spawner } from './spawn.ts';
import { AssignArgs } from './actions/assign.ts';
import { InspectionEvent } from './system.js';

export type HomomorphicPick<T, K extends keyof any> = {
  [P in keyof T as P & K]: T[P];
};
export type HomomorphicOmit<T, K extends keyof any> = {
  [P in keyof T as Exclude<P, K>]: T[P];
};

/**
 *
 * @remarks
 *
 * `T | unknown` reduces to `unknown` and that can be problematic when it comes to contextual typing.
 * It especially is a problem when the union has a function member, like here:
 *
 * ```ts
 * declare function test(cbOrVal: ((arg: number) => unknown) | unknown): void;
 * test((arg) => {}) // oops, implicit any
 * ```
 *
 * This type can be used to avoid this problem. This union represents the same value space as `unknown`.
 */
export type NonReducibleUnknown = {} | null | undefined;
export type AnyFunction = (...args: any[]) => any;

type ReturnTypeOrValue<T> = T extends AnyFunction ? ReturnType<T> : T;

// https://github.com/microsoft/TypeScript/issues/23182#issuecomment-379091887
export type IsNever<T> = [T] extends [never] ? true : false;

export type Compute<A extends any> = { [K in keyof A]: A[K] } & unknown;
export type Prop<T, K> = K extends keyof T ? T[K] : never;
export type Values<T> = T[keyof T];
export type Merge<M, N> = Omit<M, keyof N> & N;
export type IndexByProp<T extends Record<P, string>, P extends keyof T> = {
  [E in T as E[P]]: E;
};

export type IndexByType<T extends { type: string }> = IndexByProp<T, 'type'>;

export type Equals<A1 extends any, A2 extends any> = (<A>() => A extends A2
  ? true
  : false) extends <A>() => A extends A1 ? true : false
  ? true
  : false;
export type IsAny<T> = Equals<T, any>;
export type Cast<A, B> = A extends B ? A : B;
export type NoInfer<T> = [T][T extends any ? 0 : any];
export type LowInfer<T> = T & {};

export type MetaObject = Record<string, any>;

export type Lazy<T> = () => T;
export type MaybeLazy<T> = T | Lazy<T>;

/**
 * The full definition of an event, with a string `type`.
 */
export interface EventObject {
  /**
   * The type of event that is sent.
   */
  type: string;
}

export interface AnyEventObject extends EventObject {
  [key: string]: any;
}

export interface ParameterizedObject {
  type: string;
  params?: Record<string, unknown>;
}

export interface UnifiedArg<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> {
  context: TContext;
  event: TExpressionEvent;
  self: ActorRef<
    TEvent,
    MachineSnapshot<TContext, TEvent, ProvidedActor, string, unknown>
  >;
  system: ActorSystem<any>;
}

export type MachineContext = Record<string, any>;

export interface ActionArgs<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
> extends UnifiedArg<TContext, TExpressionEvent, TEvent> {
  action: TExpressionAction;
}

export type InputFrom<T extends AnyActorLogic> = T extends StateMachine<
  infer _TContext,
  infer _TEvent,
  infer _TActor,
  infer _TAction,
  infer _TGuard,
  infer _TDelay,
  infer _TTag,
  infer TInput,
  infer _TOutput,
  infer _TResolvedTypesMeta
>
  ? TInput
  : T extends ActorLogic<
      infer _TSnapshot,
      infer _TEvent,
      infer TInput,
      infer _TPersisted,
      infer _TSystem
    >
  ? TInput
  : never;

export type OutputFrom<T extends AnyActorLogic> = T extends ActorLogic<
  infer TSnapshot,
  infer _TEvent,
  infer _TInput,
  infer _TPersisted,
  infer _TSystem
>
  ? (TSnapshot & { status: 'done' })['output']
  : never;

export type ActionFunction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> = {
  (
    args: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
  ): void;
  _out_TEvent?: TEvent; // TODO: it feels like we should be able to remove this since now `TEvent` is "observable" by `self`
  _out_TActor?: TActor;
  _out_TAction?: TAction;
  _out_TGuard?: TGuard;
  _out_TDelay?: TDelay;
};

export interface ChooseBranch<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent,
  TActor extends ProvidedActor = ProvidedActor,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TDelay extends string = string
> {
  guard?: Guard<TContext, TExpressionEvent, undefined, TGuard>;
  actions: Actions<
    TContext,
    TExpressionEvent,
    TEvent,
    undefined,
    TActor,
    TAction,
    TGuard,
    TDelay
  >;
}

export type NoRequiredParams<T extends ParameterizedObject> = T extends any
  ? { type: T['type'] } extends T
    ? T['type']
    : never
  : never;

type ConditionalRequired<T, Condition extends boolean> = Condition extends true
  ? Required<T>
  : T;

export type WithDynamicParams<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  T extends ParameterizedObject
> = T extends any
  ? ConditionalRequired<
      {
        type: T['type'];
        params?:
          | T['params']
          | (({
              context,
              event
            }: {
              context: TContext;
              event: TExpressionEvent;
            }) => T['params']);
      },
      undefined extends T['params'] ? false : true
    >
  : never;

export type Action<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> =
  // TODO: consider merging `NoRequiredParams` and `WithDynamicParams` into one
  // this way we could iterate over `TAction` (and `TGuard` in the `Guard` type) once and not twice
  | NoRequiredParams<TAction>
  | WithDynamicParams<TContext, TExpressionEvent, TAction>
  | ActionFunction<
      TContext,
      TExpressionEvent,
      TEvent,
      TExpressionAction,
      TActor,
      TAction,
      TGuard,
      TDelay
    >;

export type UnknownAction = Action<
  MachineContext,
  EventObject,
  EventObject,
  ParameterizedObject | undefined,
  ProvidedActor,
  ParameterizedObject,
  ParameterizedObject,
  string
>;

export type Actions<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> = SingleOrArray<
  Action<
    TContext,
    TExpressionEvent,
    TEvent,
    TExpressionAction,
    TActor,
    TAction,
    TGuard,
    TDelay
  >
>;

export type StateKey = string | AnyState;

export interface StateValueMap {
  [key: string]: StateValue;
}

/**
 * The string or object representing the state value relative to the parent state node.
 *
 * @remarks
 *
 * - For a child atomic state node, this is a string, e.g., `"pending"`.
 *
 * - For complex state nodes, this is an object, e.g., `{ success: "someChildState" }`.
 */
export type StateValue = string | StateValueMap;

export type TransitionTarget = SingleOrArray<string>;

export interface TransitionConfig<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> {
  guard?: Guard<TContext, TExpressionEvent, undefined, TGuard>;
  actions?: Actions<
    TContext,
    TExpressionEvent,
    TEvent,
    undefined,
    TActor,
    TAction,
    TGuard,
    TDelay
  >;
  reenter?: boolean;
  target?: TransitionTarget | undefined;
  meta?: Record<string, any>;
  description?: string;
}

export interface InitialTransitionConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> extends TransitionConfig<
    TContext,
    TEvent,
    TEvent,
    TActor,
    TAction,
    TGuard,
    TDelay
  > {
  target: string;
}

export type AnyTransitionConfig = TransitionConfig<
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

export interface InvokeDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> {
  id: string;

  systemId: string | undefined;
  /**
   * The source of the actor logic to be invoked
   */
  src: AnyActorLogic | string;

  input?:
    | Mapper<TContext, TEvent, NonReducibleUnknown, TEvent>
    | NonReducibleUnknown;
  /**
   * The transition to take upon the invoked child machine reaching its final top-level state.
   */
  onDone?:
    | string
    | SingleOrArray<
        TransitionConfig<
          TContext,
          DoneActorEvent<unknown>,
          TEvent,
          TActor,
          TAction,
          TGuard,
          TDelay
        >
      >;
  /**
   * The transition to take upon the invoked child machine sending an error event.
   */
  onError?:
    | string
    | SingleOrArray<
        TransitionConfig<
          TContext,
          ErrorActorEvent,
          TEvent,
          TActor,
          TAction,
          TGuard,
          TDelay
        >
      >;

  onSnapshot?:
    | string
    | SingleOrArray<
        TransitionConfig<
          TContext,
          SnapshotEvent,
          TEvent,
          TActor,
          TAction,
          TGuard,
          TDelay
        >
      >;

  toJSON: () => Omit<
    InvokeDefinition<TContext, TEvent, TActor, TAction, TGuard, TDelay>,
    'onDone' | 'onError' | 'toJSON'
  >;
}

type Delay<TDelay extends string> = TDelay | number;

export type DelayedTransitions<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> =
  | {
      [K in Delay<TDelay>]?:
        | string
        | SingleOrArray<
            TransitionConfig<
              TContext,
              TEvent,
              TEvent,
              TActor,
              TAction,
              TGuard,
              TDelay
            >
          >;
    };

export type StateTypes =
  | 'atomic'
  | 'compound'
  | 'parallel'
  | 'final'
  | 'history'
  | string; // TODO: remove once TS fixes this type-widening issue

export type SingleOrArray<T> = readonly T[] | T;

export type StateNodesConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in string]: StateNode<TContext, TEvent>;
};

export type StatesConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string,
  TOutput
> = {
  [K in string]: StateNodeConfig<
    TContext,
    TEvent,
    TActor,
    TAction,
    TGuard,
    TDelay,
    TTag,
    TOutput
  >;
};

export type StatesDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in string]: StateNodeDefinition<TContext, TEvent>;
};

export type TransitionConfigTarget = string | undefined;

export type TransitionConfigOrTarget<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> = SingleOrArray<
  | TransitionConfigTarget
  | TransitionConfig<
      TContext,
      TExpressionEvent,
      TEvent,
      TActor,
      TAction,
      TGuard,
      TDelay
    >
>;

export type TransitionsConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> =
  | {
      [K in EventDescriptor<TEvent>]?: TransitionConfigOrTarget<
        TContext,
        ExtractEvent<TEvent, K>,
        TEvent,
        TActor,
        TAction,
        TGuard,
        TDelay
      >;
    };

type PartialEventDescriptor<TEventType extends string> =
  TEventType extends `${infer TLeading}.${infer TTail}`
    ? `${TLeading}.*` | `${TLeading}.${PartialEventDescriptor<TTail>}`
    : never;

export type EventDescriptor<TEvent extends EventObject> =
  | TEvent['type']
  | PartialEventDescriptor<TEvent['type']>
  | '*';

type NormalizeDescriptor<TDescriptor extends string> = TDescriptor extends '*'
  ? string
  : TDescriptor extends `${infer TLeading}.*`
  ? `${TLeading}.${string}`
  : TDescriptor;

export type IsLiteralString<T extends string> = string extends T ? false : true;

type DistributeActors<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TSpecificActor extends ProvidedActor
> = TSpecificActor extends { src: infer TSrc }
  ? Compute<
      {
        systemId?: string;
        /**
         * The source of the machine to be invoked, or the machine itself.
         */
        src: TSrc;

        // TODO: currently we do not enforce required inputs here
        // in a sense, we shouldn't - they could be provided within the `implementations` object
        // how do we verify if the required input has been provided?
        input?:
          | Mapper<TContext, TEvent, InputFrom<TSpecificActor['logic']>, TEvent>
          | InputFrom<TSpecificActor['logic']>;
        /**
         * The transition to take upon the invoked child machine reaching its final top-level state.
         */
        onDone?:
          | string
          | SingleOrArray<
              TransitionConfigOrTarget<
                TContext,
                DoneActorEvent<OutputFrom<TSpecificActor['logic']>>,
                TEvent,
                TActor,
                TAction,
                TGuard,
                TDelay
              >
            >;
        /**
         * The transition to take upon the invoked child machine sending an error event.
         */
        onError?:
          | string
          | SingleOrArray<
              TransitionConfigOrTarget<
                TContext,
                ErrorActorEvent,
                TEvent,
                TActor,
                TAction,
                TGuard,
                TDelay
              >
            >;

        onSnapshot?:
          | string
          | SingleOrArray<
              TransitionConfigOrTarget<
                TContext,
                SnapshotEvent<SnapshotFrom<TSpecificActor['logic']>>,
                TEvent,
                TActor,
                TAction,
                TGuard,
                TDelay
              >
            >;
      } & (TSpecificActor['id'] extends string
        ? {
            /**
             * The unique identifier for the invoked machine. If not specified, this
             * will be the machine's own `id`, or the URL (from `src`).
             */
            id: TSpecificActor['id'];
          }
        : {
            /**
             * The unique identifier for the invoked machine. If not specified, this
             * will be the machine's own `id`, or the URL (from `src`).
             */
            id?: string;
          })
    >
  : never;

export type InvokeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> = IsLiteralString<TActor['src']> extends true
  ? DistributeActors<TContext, TEvent, TActor, TAction, TGuard, TDelay, TActor>
  : {
      /**
       * The unique identifier for the invoked machine. If not specified, this
       * will be the machine's own `id`, or the URL (from `src`).
       */
      id?: string;

      systemId?: string;
      /**
       * The source of the machine to be invoked, or the machine itself.
       */
      src: AnyActorLogic | string; // TODO: fix types

      input?:
        | Mapper<TContext, TEvent, NonReducibleUnknown, TEvent>
        | NonReducibleUnknown;
      /**
       * The transition to take upon the invoked child machine reaching its final top-level state.
       */
      onDone?:
        | string
        | SingleOrArray<
            TransitionConfigOrTarget<
              TContext,
              DoneActorEvent<any>, // TODO: consider replacing with `unknown`
              TEvent,
              TActor,
              TAction,
              TGuard,
              TDelay
            >
          >;
      /**
       * The transition to take upon the invoked child machine sending an error event.
       */
      onError?:
        | string
        | SingleOrArray<
            TransitionConfigOrTarget<
              TContext,
              ErrorActorEvent,
              TEvent,
              TActor,
              TAction,
              TGuard,
              TDelay
            >
          >;

      onSnapshot?:
        | string
        | SingleOrArray<
            TransitionConfigOrTarget<
              TContext,
              SnapshotEvent,
              TEvent,
              TActor,
              TAction,
              TGuard,
              TDelay
            >
          >;
    };

export type AnyInvokeConfig = InvokeConfig<any, any, any, any, any, any>;

export interface StateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string,
  TOutput
> {
  /**
   * The initial state transition.
   */
  initial?:
    | InitialTransitionConfig<TContext, TEvent, TActor, TAction, TGuard, TDelay>
    | string
    | undefined;
  /**
   * The type of this state node:
   *
   *  - `'atomic'` - no child state nodes
   *  - `'compound'` - nested child state nodes (XOR)
   *  - `'parallel'` - orthogonal nested child state nodes (AND)
   *  - `'history'` - history state node
   *  - `'final'` - final state node
   */
  type?: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  /**
   * Indicates whether the state node is a history state node, and what
   * type of history:
   * shallow, deep, true (shallow), false (none), undefined (none)
   */
  history?: 'shallow' | 'deep' | boolean | undefined;
  /**
   * The mapping of state node keys to their state node configurations (recursive).
   */
  states?:
    | StatesConfig<
        TContext,
        TEvent,
        TActor,
        TAction,
        TGuard,
        TDelay,
        TTag,
        NonReducibleUnknown
      >
    | undefined;
  /**
   * The services to invoke upon entering this state node. These services will be stopped upon exiting this state node.
   */
  invoke?: SingleOrArray<
    InvokeConfig<TContext, TEvent, TActor, TAction, TGuard, TDelay>
  >;
  /**
   * The mapping of event types to their potential transition(s).
   */
  on?: TransitionsConfig<TContext, TEvent, TActor, TAction, TGuard, TDelay>;
  /**
   * The action(s) to be executed upon entering the state node.
   */
  entry?: Actions<
    TContext,
    TEvent,
    TEvent,
    undefined,
    TActor,
    TAction,
    TGuard,
    TDelay
  >;
  /**
   * The action(s) to be executed upon exiting the state node.
   */
  exit?: Actions<
    TContext,
    TEvent,
    TEvent,
    undefined,
    TActor,
    TAction,
    TGuard,
    TDelay
  >;
  /**
   * The potential transition(s) to be taken upon reaching a final child state node.
   *
   * This is equivalent to defining a `[done(id)]` transition on this state node's `on` property.
   */
  onDone?:
    | string
    | SingleOrArray<
        TransitionConfig<
          TContext,
          DoneStateEvent,
          TEvent,
          TActor,
          TAction,
          TGuard,
          TDelay
        >
      >
    | undefined;
  /**
   * The mapping (or array) of delays (in milliseconds) to their potential transition(s).
   * The delayed transitions are taken after the specified delay in an interpreter.
   */
  after?: DelayedTransitions<TContext, TEvent, TActor, TAction, TGuard, TDelay>;

  /**
   * An eventless transition that is always taken when this state node is active.
   */
  always?: TransitionConfigOrTarget<
    TContext,
    TEvent,
    TEvent,
    TActor,
    TAction,
    TGuard,
    TDelay
  >;
  /**
   * @internal
   */
  parent?: StateNode<TContext, TEvent>;
  /**
   * The meta data associated with this state node, which will be returned in State instances.
   */
  meta?: any;
  /**
   * The output data sent with the "xstate.done.state._id_" event if this is a final state node.
   *
   * The output data will be evaluated with the current `context` and placed on the `.data` property
   * of the event.
   */
  output?: Mapper<TContext, TEvent, unknown, TEvent> | NonReducibleUnknown;
  /**
   * The unique ID of the state node, which can be referenced as a transition target via the
   * `#id` syntax.
   */
  id?: string | undefined;
  /**
   * The order this state node appears. Corresponds to the implicit document order.
   */
  order?: number;

  /**
   * The tags for this state node, which are accumulated into the `state.tags` property.
   */
  tags?: SingleOrArray<TTag>;
  /**
   * A text description of the state node
   */
  description?: string;

  /**
   * A default target for a history state
   */
  target?: string;
}

export type AnyStateNodeConfig = StateNodeConfig<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

export interface StateNodeDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  id: string;
  version?: string | undefined;
  key: string;
  type: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  initial: InitialTransitionDefinition<TContext, TEvent> | undefined;
  history: boolean | 'shallow' | 'deep' | undefined;
  states: StatesDefinition<TContext, TEvent>;
  on: TransitionDefinitionMap<TContext, TEvent>;
  transitions: Array<TransitionDefinition<TContext, TEvent>>;
  // TODO: establish what a definition really is
  entry: UnknownAction[];
  exit: UnknownAction[];
  meta: any;
  order: number;
  output?: StateNodeConfig<
    TContext,
    TEvent,
    ProvidedActor,
    ParameterizedObject,
    ParameterizedObject,
    string,
    string,
    unknown
  >['output'];
  invoke: Array<InvokeDefinition<TContext, TEvent, TODO, TODO, TODO, TODO>>;
  description?: string;
  tags: string[];
}

export interface StateMachineDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends StateNodeDefinition<TContext, TEvent> {}

export type AnyStateNode = StateNode<any, any>;

export type AnyStateNodeDefinition = StateNodeDefinition<any, any>;

export type AnyState = State<
  any, // context
  any, // event
  any, // actor
  any, // tags
  any // typegen
>;

export type AnyStateMachine = StateMachine<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any, // delays
  any // tags
>;

export type AnyStateConfig = StateConfig<any, AnyEventObject>;

export interface AtomicStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends StateNodeConfig<
    TContext,
    TEvent,
    TODO,
    TODO,
    TODO,
    TODO,
    TODO,
    TODO
  > {
  initial?: undefined;
  parallel?: false | undefined;
  states?: undefined;
  onDone?: undefined;
}

export interface HistoryStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends AtomicStateNodeConfig<TContext, TEvent> {
  history: 'shallow' | 'deep' | true;
  target: string | undefined;
}

export type SimpleOrStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> =
  | AtomicStateNodeConfig<TContext, TEvent>
  | StateNodeConfig<TContext, TEvent, TODO, TODO, TODO, TODO, TODO, TODO>;

export type ActionFunctionMap<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TDelay extends string = string
> = {
  [K in TAction['type']]?: ActionFunction<
    TContext,
    TEvent,
    TEvent,
    TAction extends { type: K } ? TAction : never,
    TActor,
    TAction,
    TGuard,
    TDelay
  >;
};

type GuardMap<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TGuard extends ParameterizedObject
> = {
  [K in TGuard['type']]?: GuardPredicate<
    TContext,
    TEvent,
    TGuard extends { type: K } ? TGuard : never,
    TGuard
  >;
};

export type DelayFunctionMap<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends ParameterizedObject
> = Record<string, DelayConfig<TContext, TEvent, TAction, TEvent>>;

export type DelayConfig<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
> = number | DelayExpr<TContext, TExpressionEvent, TExpressionAction, TEvent>;

// TODO: possibly refactor this somehow, use even a simpler type, and maybe even make `machine.options` private or something
export interface MachineImplementationsSimplified<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor = ProvidedActor,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject
> {
  guards: GuardMap<TContext, TEvent, TGuard>;
  actions: ActionFunctionMap<TContext, TEvent, TActor, TAction>;
  actors: Record<
    string,
    | AnyActorLogic
    | {
        src: AnyActorLogic;
        input: Mapper<TContext, TEvent, unknown, TEvent> | NonReducibleUnknown;
      }
  >;
  delays: DelayFunctionMap<TContext, TEvent, TAction>;
}

type MaybeNarrowedEvent<TIndexedEvents, TCausingLookup, K> = Cast<
  Prop<
    TIndexedEvents,
    K extends keyof TCausingLookup
      ? TCausingLookup[K]
      : TIndexedEvents[keyof TIndexedEvents]
  >,
  EventObject
>;

type MachineImplementationsActions<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TEventsCausingActions = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'eventsCausingActions'
  >,
  TIndexedEvents = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedEvents'>,
  TIndexedActors = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedActors'>,
  TIndexedActions = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'indexedActions'
  >,
  TIndexedGuards = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedGuards'>,
  TIndexedDelays = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedDelays'>
> = {
  [K in keyof TIndexedActions]?: ActionFunction<
    TContext,
    MaybeNarrowedEvent<TIndexedEvents, TEventsCausingActions, K>,
    Cast<Prop<TIndexedEvents, keyof TIndexedEvents>, EventObject>,
    Cast<TIndexedActions[K], ParameterizedObject>,
    Cast<Prop<TIndexedActors, keyof TIndexedActors>, ProvidedActor>,
    Cast<Prop<TIndexedActions, keyof TIndexedActions>, ParameterizedObject>,
    Cast<Prop<TIndexedGuards, keyof TIndexedGuards>, ParameterizedObject>,
    Cast<
      Prop<TIndexedDelays, keyof TIndexedDelays>,
      ParameterizedObject
    >['type']
  >;
};

type MachineImplementationsActors<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TEventsCausingActors = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'eventsCausingActors'
  >,
  TIndexedActors = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedActors'>,
  TIndexedEvents = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedEvents'>,
  _TInvokeSrcNameMap = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'invokeSrcNameMap'
  >
> = {
  // TODO: this should require `{ src, input }` for required inputs
  [K in keyof TIndexedActors]?:
    | Cast<Prop<TIndexedActors[K], 'logic'>, AnyActorLogic>
    | {
        src: Cast<Prop<TIndexedActors[K], 'logic'>, AnyActorLogic>;
        input:
          | Mapper<
              TContext,
              MaybeNarrowedEvent<TIndexedEvents, TEventsCausingActors, K>,
              InputFrom<Cast<Prop<TIndexedActors[K], 'logic'>, AnyActorLogic>>,
              Cast<Prop<TIndexedEvents, keyof TIndexedEvents>, EventObject>
            >
          | InputFrom<Cast<Prop<TIndexedActors[K], 'logic'>, AnyActorLogic>>;
      };
};

type MachineImplementationsDelays<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TEventsCausingDelays = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'eventsCausingDelays'
  >,
  TIndexedEvents = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedEvents'>,
  TIndexedActions = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'indexedActions'
  >,
  TIndexedDelays = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedDelays'>
> = {
  [K in keyof TIndexedDelays]?: DelayConfig<
    TContext,
    MaybeNarrowedEvent<TIndexedEvents, TEventsCausingDelays, K>,
    // delays in referenced send actions might use specific `TAction`
    // delays executed by auto-generated send actions related to after transitions won't have that
    // since they are effectively implicit inline actions
    | Cast<Prop<TIndexedActions, keyof TIndexedActions>, ParameterizedObject>
    | undefined,
    Cast<Prop<TIndexedEvents, keyof TIndexedEvents>, EventObject>
  >;
};

type MachineImplementationsGuards<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TEventsCausingGuards = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'eventsCausingGuards'
  >,
  TIndexedEvents = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedEvents'>,
  TIndexedGuards = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedGuards'>
> = {
  [K in keyof TIndexedGuards]?: Guard<
    TContext,
    MaybeNarrowedEvent<TIndexedEvents, TEventsCausingGuards, K>,
    Cast<TIndexedGuards[K], ParameterizedObject>,
    Cast<Prop<TIndexedGuards, keyof TIndexedGuards>, ParameterizedObject>
  >;
};

type MakeKeysRequired<T extends string> = { [K in T]: unknown };

type MaybeMakeMissingImplementationsRequired<
  TImplementationType,
  TMissingImplementationsForType,
  TRequireMissingImplementations
> = TRequireMissingImplementations extends true
  ? IsNever<TMissingImplementationsForType> extends true
    ? {}
    : {
        [K in Cast<TImplementationType, string>]: MakeKeysRequired<
          Cast<TMissingImplementationsForType, string>
        >;
      }
  : {};

type GenerateActionsImplementationsPart<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> = Compute<
  MaybeMakeMissingImplementationsRequired<
    'actions',
    Prop<TMissingImplementations, 'actions'>,
    TRequireMissingImplementations
  > & {
    actions?: MachineImplementationsActions<TContext, TResolvedTypesMeta>;
  }
>;

type GenerateActorsImplementationsPart<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> = Compute<
  MaybeMakeMissingImplementationsRequired<
    'actors',
    Prop<TMissingImplementations, 'actors'>,
    TRequireMissingImplementations
  > & {
    actors?: MachineImplementationsActors<TContext, TResolvedTypesMeta>;
  }
>;

type GenerateDelaysImplementationsPart<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> = Compute<
  MaybeMakeMissingImplementationsRequired<
    'delays',
    Prop<TMissingImplementations, 'delays'>,
    TRequireMissingImplementations
  > & {
    delays?: MachineImplementationsDelays<TContext, TResolvedTypesMeta>;
  }
>;

type GenerateGuardsImplementationsPart<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> = Compute<
  MaybeMakeMissingImplementationsRequired<
    'guards',
    Prop<TMissingImplementations, 'guards'>,
    TRequireMissingImplementations
  > & {
    guards?: MachineImplementationsGuards<TContext, TResolvedTypesMeta>;
  }
>;

export type InternalMachineImplementations<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TDelay extends string,
  TResolvedTypesMeta,
  TRequireMissingImplementations extends boolean = false,
  TMissingImplementations = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'missingImplementations'
  >
> =
  // TODO: remove per-Generate* Computes
  Compute<
    GenerateActionsImplementationsPart<
      TContext,
      TResolvedTypesMeta,
      TRequireMissingImplementations,
      TMissingImplementations
    > &
      GenerateActorsImplementationsPart<
        TContext,
        TResolvedTypesMeta,
        TRequireMissingImplementations,
        TMissingImplementations
      > &
      GenerateDelaysImplementationsPart<
        TContext,
        TResolvedTypesMeta,
        TRequireMissingImplementations,
        TMissingImplementations
      > &
      GenerateGuardsImplementationsPart<
        TContext,
        TResolvedTypesMeta,
        TRequireMissingImplementations,
        TMissingImplementations
      >
  >;

export type MachineImplementations<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor = ProvidedActor,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TDelay extends string = string,
  TTag extends string = string,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
> = InternalMachineImplementations<
  TContext,
  TEvent,
  TActor,
  TAction,
  TDelay,
  ResolveTypegenMeta<TTypesMeta, TEvent, TActor, TAction, TGuard, TDelay, TTag>
>;

type InitialContext<
  TContext extends MachineContext,
  TActor extends ProvidedActor,
  TInput
> = TContext | ContextFactory<TContext, TActor, TInput>;

export type ContextFactory<
  TContext extends MachineContext,
  TActor extends ProvidedActor,
  TInput
> = ({ spawn, input }: { spawn: Spawner<TActor>; input: TInput }) => TContext;

export type MachineConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor = ProvidedActor,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TDelay extends string = string,
  TTag extends string = string,
  TInput = any,
  TOutput = unknown,
  TTypesMeta = TypegenDisabled
> = (Omit<
  StateNodeConfig<
    NoInfer<TContext>,
    NoInfer<TEvent>,
    NoInfer<TActor>,
    NoInfer<TAction>,
    NoInfer<TGuard>,
    NoInfer<TDelay>,
    NoInfer<TTag>,
    NoInfer<TOutput>
  >,
  'output'
> & {
  /**
   * The initial context (extended state)
   */
  /**
   * The machine's own version.
   */
  version?: string;
  types?: MachineTypes<
    TContext,
    TEvent,
    TActor,
    TAction,
    TGuard,
    TDelay,
    TTag,
    TInput,
    TOutput,
    TTypesMeta
  >;
  // TODO: make it conditionally required
  output?: Mapper<TContext, DoneStateEvent, TOutput, TEvent> | TOutput;
}) &
  (MachineContext extends TContext
    ? { context?: InitialContext<LowInfer<TContext>, TActor, TInput> }
    : { context: InitialContext<LowInfer<TContext>, TActor, TInput> });

export interface ProvidedActor {
  src: string;
  logic: AnyActorLogic;
  id?: string;
}

export interface MachineTypes<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string,
  TInput,
  TOutput,
  TTypesMeta = TypegenDisabled
> {
  context?: TContext;
  events?: TEvent;
  actors?: TActor;
  actions?: TAction;
  guards?: TGuard;
  delays?: TDelay;
  tags?: TTag;
  input?: TInput;
  output?: TOutput;
  typegen?: TTypesMeta;
}

export interface HistoryStateNode<TContext extends MachineContext>
  extends StateNode<TContext> {
  history: 'shallow' | 'deep';
  target: string | undefined;
}

export type HistoryValue<
  TContext extends MachineContext,
  TEvent extends EventObject
> = Record<string, Array<StateNode<TContext, TEvent>>>;

export type AnyHistoryValue = HistoryValue<any, any>;

export type StateFrom<
  T extends AnyStateMachine | ((...args: any[]) => AnyStateMachine)
> = T extends AnyStateMachine
  ? ReturnType<T['transition']>
  : T extends (...args: any[]) => AnyStateMachine
  ? ReturnType<ReturnType<T>['transition']>
  : never;

export type Transitions<
  TContext extends MachineContext,
  TEvent extends EventObject
> = Array<TransitionDefinition<TContext, TEvent>>;

export interface DoneActorEvent<TOutput = unknown> {
  type: `xstate.done.actor.${string}`;
  output: TOutput;
}

export interface ErrorActorEvent<TErrorData = unknown> extends EventObject {
  type: `xstate.error.actor.${string}`;
  data: TErrorData;
}

export interface SnapshotEvent<
  TSnapshot extends Snapshot<unknown> = Snapshot<unknown>
> extends EventObject {
  type: `xstate.snapshot.${string}`;
  snapshot: TSnapshot;
}

export interface DoneStateEvent<TOutput = unknown> extends EventObject {
  type: `xstate.done.state.${string}`;
  output: TOutput;
}

export type DelayExpr<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
> = (
  args: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
) => number;

export type LogExpr<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
> = (
  args: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
) => unknown;

export type SendExpr<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TSentEvent extends EventObject,
  TEvent extends EventObject
> = (
  args: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
) => TSentEvent;

export enum SpecialTargets {
  Parent = '#_parent',
  Internal = '#_internal'
}

export interface SendToActionOptions<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TDelay extends string
> extends RaiseActionOptions<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TEvent,
    TDelay
  > {}

export interface RaiseActionOptions<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TDelay extends string
> {
  id?: string;
  delay?:
    | Delay<TDelay>
    | DelayExpr<TContext, TExpressionEvent, TExpressionAction, TEvent>;
}

export interface RaiseActionParams<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TDelay extends string
> extends RaiseActionOptions<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TEvent,
    TDelay
  > {
  event:
    | TEvent
    | SendExpr<TContext, TExpressionEvent, TExpressionAction, TEvent, TEvent>;
}

export interface SendToActionParams<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TSentEvent extends EventObject,
  TEvent extends EventObject,
  TDelay extends string
> extends SendToActionOptions<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TEvent,
    TDelay
  > {
  event:
    | TSentEvent
    | SendExpr<
        TContext,
        TExpressionEvent,
        TExpressionAction,
        TSentEvent,
        TEvent
      >;
}

export type Assigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> = (
  args: AssignArgs<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TEvent,
    TActor
  >
) => Partial<TContext>;

export type PartialAssigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TKey extends keyof TContext
> = (
  args: AssignArgs<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TEvent,
    TActor
  >
) => TContext[TKey];

export type PropertyAssigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> = {
  [K in keyof TContext]?:
    | PartialAssigner<
        TContext,
        TExpressionEvent,
        TExpressionAction,
        TEvent,
        TActor,
        K
      >
    | TContext[K];
};

export type Mapper<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TResult,
  TEvent extends EventObject
> = (args: {
  context: TContext;
  event: TExpressionEvent;
  self: ActorRef<
    TEvent,
    MachineSnapshot<TContext, TEvent, ProvidedActor, string, unknown>
  >;
}) => TResult;

export interface TransitionDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends Omit<
    TransitionConfig<TContext, TEvent, TEvent, TODO, TODO, TODO, TODO>,
    | 'target'
    // `guard` is correctly rejected by `extends` here and `actions` should be too
    // however, `any` passed to `TransitionConfig` as `TAction` collapses its `.actions` to `any` and it's accidentally allowed here
    // it doesn't exactly have to be incorrect, we are overriding this here anyway but it looks like a lucky accident rather than smth done on purpose
    | 'guard'
  > {
  target: ReadonlyArray<StateNode<TContext, TEvent>> | undefined;
  source: StateNode<TContext, TEvent>;
  actions: readonly UnknownAction[];
  reenter: boolean;
  guard?: UnknownGuard;
  eventType: EventDescriptor<TEvent>;
  toJSON: () => {
    target: string[] | undefined;
    source: string;
    actions: readonly UnknownAction[];
    guard?: UnknownGuard;
    eventType: EventDescriptor<TEvent>;
    meta?: Record<string, any>;
  };
}

export type AnyTransitionDefinition = TransitionDefinition<any, any>;

export interface InitialTransitionDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends TransitionDefinition<TContext, TEvent> {
  target: ReadonlyArray<StateNode<TContext, TEvent>>;
  guard?: never;
}

export type TransitionDefinitionMap<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in EventDescriptor<TEvent>]: Array<
    TransitionDefinition<TContext, ExtractEvent<TEvent, K>>
  >;
};

export interface DelayedTransitionDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends TransitionDefinition<TContext, TEvent> {
  delay: number | string | DelayExpr<TContext, TEvent, undefined, TEvent>;
}

export interface StateLike<TContext extends MachineContext> {
  value: StateValue;
  context: TContext;
  event: EventObject;
}

export interface StateConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  value: StateValue;
  context: TContext;
  historyValue?: HistoryValue<TContext, TEvent>;
  meta?: any;
  configuration?: Array<StateNode<TContext, TEvent>>;
  children: Record<string, ActorRef<any, any>>;
  status: 'active' | 'done' | 'error' | 'stopped';
  output?: any;
  error?: unknown;
  tags?: Set<string>;
  machine?: StateMachine<TContext, TEvent, any, any, any, any, any, any, any>;
}

export interface ActorOptions<TLogic extends AnyActorLogic> {
  /**
   * Whether state actions should be executed immediately upon transition. Defaults to `true`.
   */
  execute?: boolean;
  clock?: Clock;
  logger?: (...args: any[]) => void;
  parent?: ActorRef<any, any>;
  /**
   * The custom `id` for referencing this service.
   */
  id?: string;
  /**
   * If `true`, states and events will be logged to Redux DevTools.
   *
   * Default: `false`
   */
  devTools?: boolean | DevToolsAdapter; // TODO: add enhancer options

  sync?: boolean;

  /**
   * The system ID to register this actor under
   */
  systemId?: string;
  /**
   * The input data to pass to the actor.
   */
  input?: InputFrom<TLogic>;

  // state?:
  //   | PersistedStateFrom<TActorLogic>
  //   | InternalStateFrom<TActorLogic>;
  state?: any;

  /**
   * The source definition.
   */
  src?: string;

  inspect?:
    | Observer<InspectionEvent>
    | ((inspectionEvent: InspectionEvent) => void);
}

export type AnyActor = Actor<any>;

/**
 * @deprecated Use `AnyActor` instead.
 */
export type AnyInterpreter = AnyActor;

// Based on RxJS types
export type Observer<T> = {
  next?: (value: T) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
};

export interface Subscription {
  unsubscribe(): void;
}

export interface InteropObservable<T> {
  [Symbol.observable]: () => InteropSubscribable<T>;
}

export interface InteropSubscribable<T> {
  subscribe(observer: Observer<T>): Subscription;
}

export interface Subscribable<T> extends InteropSubscribable<T> {
  subscribe(observer: Observer<T>): Subscription;
  subscribe(
    next: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription;
}

export type ExtractEvent<
  TEvent extends EventObject,
  TDescriptor extends EventDescriptor<TEvent>
> = string extends TEvent['type']
  ? TEvent
  : NormalizeDescriptor<TDescriptor> extends infer TNormalizedDescriptor
  ? TEvent extends any
    ? TEvent['type'] extends TNormalizedDescriptor
      ? TEvent
      : never
    : never
  : never;

export interface BaseActorRef<TEvent extends EventObject> {
  send: (event: TEvent) => void;
}

export interface ActorLike<TCurrent, TEvent extends EventObject>
  extends Subscribable<TCurrent> {
  send: (event: TEvent) => void;
}

export interface ActorRef<
  TEvent extends EventObject,
  TSnapshot extends Snapshot<unknown>
> extends Subscribable<TSnapshot>,
    InteropObservable<TSnapshot> {
  /**
   * The unique identifier for this actor relative to its parent.
   */
  id: string;
  sessionId: string;
  /** @internal */
  _send: (event: TEvent) => void;
  send: (event: TEvent) => void;
  // TODO: should this be optional?
  start?: () => void;
  getSnapshot: () => TSnapshot;
  // TODO: this should return some sort of TPersistedState, not any
  getPersistedState?: () => any;
  stop: () => void;
  toJSON?: () => any;
  // TODO: figure out how to hide this externally as `sendTo(ctx => ctx.actorRef._parent._parent._parent._parent)` shouldn't be allowed
  _parent?: ActorRef<any, any>;
  system?: ActorSystem<any>;
  status: ActorStatus;
  src?: string;
}

export type AnyActorRef = ActorRef<any, any>;

export type ActorLogicFrom<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends StateMachine<any, any, any, any, any, any, any, any, any>
    ? R
    : R extends Promise<infer U>
    ? PromiseActorLogic<U>
    : never
  : never;

export type ActorRefFrom<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends StateMachine<
      infer TContext,
      infer TEvent,
      infer TActor,
      infer _TAction,
      infer _TGuard,
      infer _TDelay,
      infer TTag,
      infer _TInput,
      infer TOutput,
      infer TResolvedTypesMeta
    >
    ? ActorRef<
        TEvent,
        MachineSnapshot<
          TContext,
          TEvent,
          TActor,
          TTag,
          TOutput,
          AreAllImplementationsAssumedToBeProvided<TResolvedTypesMeta> extends false
            ? MarkAllImplementationsAsProvided<TResolvedTypesMeta>
            : TResolvedTypesMeta
        >
      >
    : R extends Promise<infer U>
    ? ActorRefFrom<PromiseActorLogic<U>>
    : R extends ActorLogic<
        infer TSnapshot,
        infer TEvent,
        infer _TInput,
        infer _TPersisted,
        infer _TSystem
      >
    ? ActorRef<TEvent, TSnapshot>
    : never
  : never;

export type DevToolsAdapter = (service: AnyActor) => void;

/**
 * @deprecated Use `Actor<T>` instead.
 */
export type InterpreterFrom<
  T extends AnyStateMachine | ((...args: any[]) => AnyStateMachine)
> = ReturnTypeOrValue<T> extends StateMachine<
  infer TContext,
  infer TEvent,
  infer TActor,
  infer _TAction,
  infer _TGuard,
  infer _TDelay,
  infer TTag,
  infer TInput,
  infer TOutput,
  infer TResolvedTypesMeta
>
  ? Actor<
      ActorLogic<
        MachineSnapshot<
          TContext,
          TEvent,
          TActor,
          TTag,
          TOutput,
          TResolvedTypesMeta
        >,
        TEvent,
        TInput,
        PersistedMachineState<
          TContext,
          TEvent,
          TActor,
          TTag,
          TOutput,
          TResolvedTypesMeta
        >,
        ActorSystem<any>
      >
    >
  : never;

export type MachineImplementationsFrom<
  T extends AnyStateMachine | ((...args: any[]) => AnyStateMachine),
  TRequireMissingImplementations extends boolean = false
> = ReturnTypeOrValue<T> extends StateMachine<
  infer TContext,
  infer TEvent,
  infer TActor,
  infer TAction,
  infer _TGuard,
  infer TDelay,
  infer _TTag,
  infer _TInput,
  infer _TOutput,
  infer TResolvedTypesMeta
>
  ? InternalMachineImplementations<
      TContext,
      TEvent,
      TActor,
      TAction,
      TDelay,
      TResolvedTypesMeta,
      TRequireMissingImplementations
    >
  : never;

// only meant to be used internally for debugging purposes
export type __ResolvedTypesMetaFrom<T> = T extends StateMachine<
  any, // context
  any, // event
  any, // actor
  any, // action
  any, // guard
  any, // delay
  any, // tag
  any, // input
  any, // output
  infer TResolvedTypesMeta
>
  ? TResolvedTypesMeta
  : never;

export interface ActorContext<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TSystem extends ActorSystem<any> = ActorSystem<any>
> {
  self: ActorRef<TEvent, TSnapshot>;
  id: string;
  sessionId: string;
  logger: (...args: any[]) => void;
  defer: (fn: () => void) => void;
  system: TSystem;
  stopChild: (child: AnyActorRef) => void;
}

export type AnyActorContext = ActorContext<any, any, AnyActorSystem>;

export type Snapshot<TOutput> =
  | {
      status: 'active';
      output: undefined;
      error: undefined;
    }
  | {
      status: 'done';
      output: TOutput;
      error: undefined;
    }
  | {
      status: 'error';
      output: undefined;
      error: unknown;
    }
  | {
      status: 'stopped';
      output: undefined;
      error: undefined;
    };

export interface ActorLogic<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput = unknown,
  /**
   * Serialized internal state used for persistence & restoration
   */
  TPersisted = TSnapshot,
  TSystem extends ActorSystem<any> = ActorSystem<any>
> {
  config?: unknown;
  transition: (
    state: TSnapshot,
    message: TEvent,
    ctx: ActorContext<TSnapshot, TEvent, TSystem>
  ) => TSnapshot;
  getInitialState: (
    actorCtx: ActorContext<TSnapshot, TEvent, TSystem>,
    input: TInput
  ) => TSnapshot;
  restoreState?: (
    persistedState: TPersisted,
    actorCtx: ActorContext<TSnapshot, TEvent>
  ) => TSnapshot;
  start?: (state: TSnapshot, actorCtx: ActorContext<TSnapshot, TEvent>) => void;
  /**
   * @returns Persisted state
   */
  getPersistedState?: (state: TSnapshot) => TPersisted;
}

export type AnyActorLogic = ActorLogic<
  any, // snapshot
  any, // event
  any, // input
  any, // persisted state
  any // system
>;

export type SnapshotFrom<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends ActorRef<infer _, infer TSnapshot>
    ? TSnapshot
    : R extends Actor<infer TLogic>
    ? SnapshotFrom<TLogic>
    : R extends StateMachine<
        infer _TContext,
        infer _TEvent,
        infer _TActor,
        infer _TAction,
        infer _TGuard,
        infer _TDelay,
        infer _TTag,
        infer _TInput,
        infer _TOutput,
        infer _TResolvedTypesMeta
      >
    ? StateFrom<R>
    : R extends ActorLogic<any, any, any, any, any>
    ? ReturnType<R['transition']>
    : R extends ActorContext<infer TSnapshot, infer _, infer __>
    ? TSnapshot
    : never
  : never;

export type EventFromLogic<TLogic extends ActorLogic<any, any, any, any, any>> =
  TLogic extends ActorLogic<
    infer _,
    infer TEvent,
    infer __,
    infer _____,
    infer ______
  >
    ? TEvent
    : never;

export type PersistedStateFrom<
  TLogic extends ActorLogic<any, any, any, any, any>
> = TLogic extends ActorLogic<
  infer _TSnapshot,
  infer _TEvent,
  infer _TInput,
  infer TPersisted,
  infer _TSystem
>
  ? TPersisted
  : never;

type ResolveEventType<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends StateMachine<
      infer _TContext,
      infer TEvent,
      infer _TActor,
      infer _TAction,
      infer _TGuard,
      infer _TDelay,
      infer _TTag,
      infer _TInput,
      infer _TOutput,
      infer _TResolvedTypesMeta
    >
    ? TEvent
    : R extends State<
        infer _TContext,
        infer TEvent,
        infer _TActor,
        infer _TOutput,
        infer _TResolvedTypesMeta
      >
    ? TEvent
    : R extends ActorRef<infer TEvent, infer _>
    ? TEvent
    : never
  : never;

export type EventFrom<
  T,
  K extends Prop<TEvent, 'type'> = never,
  TEvent extends EventObject = ResolveEventType<T>
> = IsNever<K> extends true ? TEvent : ExtractEvent<TEvent, K>;

export type ContextFrom<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends StateMachine<
      infer TContext,
      infer _TEvent,
      infer _TActor,
      infer _TAction,
      infer _TGuard,
      infer _TDelay,
      infer _TTag,
      infer _TInput,
      infer _TOutput,
      infer _TTypesMeta
    >
    ? TContext
    : R extends State<
        infer TContext,
        infer _TEvent,
        infer _TActor,
        infer _TOutput,
        infer _TResolvedTypesMeta
      >
    ? TContext
    : R extends Actor<infer TActorLogic>
    ? TActorLogic extends StateMachine<
        infer TContext,
        infer _TEvent,
        infer _TActor,
        infer _TAction,
        infer _TGuard,
        infer _TDelay,
        infer _TTag,
        infer _TInput,
        infer _TOutput,
        infer _TTypesMeta
      >
      ? TContext
      : never
    : never
  : never;

export type InferEvent<E extends EventObject> = {
  [T in E['type']]: { type: T } & Extract<E, { type: T }>;
}[E['type']];

export type TODO = any;

export type StateValueFrom<TMachine extends AnyStateMachine> = Parameters<
  StateFrom<TMachine>['matches']
>[0];

export type TagsFrom<TMachine extends AnyStateMachine> = Parameters<
  StateFrom<TMachine>['hasTag']
>[0];

export interface ActorSystemInfo {
  actors: Record<string, AnyActorRef>;
}

export interface ActorSystem<T extends ActorSystemInfo> {
  /**
   * @internal
   */
  _bookId: () => string;
  /**
   * @internal
   */
  _register: (sessionId: string, actorRef: AnyActorRef) => string;
  /**
   * @internal
   */
  _unregister: (actorRef: AnyActorRef) => void;
  /**
   * @internal
   */
  _set: <K extends keyof T['actors']>(key: K, actorRef: T['actors'][K]) => void;
  get: <K extends keyof T['actors']>(key: K) => T['actors'][K] | undefined;
  inspect: (observer: Observer<InspectionEvent>) => void;
  /**
   * @internal
   */
  _sendInspectionEvent: (
    event: HomomorphicOmit<InspectionEvent, 'rootId'>
  ) => void;
  /**
   * @internal
   */
  _relay: (
    source: AnyActorRef | undefined,
    target: AnyActorRef,
    event: AnyEventObject
  ) => void;
}

export type AnyActorSystem = ActorSystem<any>;

export type PersistedMachineState<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> = HomomorphicPick<
  MachineSnapshot<TContext, TEvent, TActor, TTag, TOutput, TResolvedTypesMeta>,
  'value' | 'output' | 'error' | 'context' | 'status' | 'historyValue'
> & {
  children: {
    [K in keyof MachineSnapshot<
      TContext,
      TEvent,
      TActor,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >['children']]: {
      state: any; // TODO: fix (should be state from actorref)
      src?: string;
    };
  };
};
