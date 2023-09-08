import type { StateNode } from './StateNode.ts';
import type { State } from './State.ts';
import type { ActorStatus, Clock, Actor } from './interpreter.ts';
import type { StateMachine } from './StateMachine.ts';
import {
  TypegenDisabled,
  ResolveTypegenMeta,
  TypegenConstraint,
  MarkAllImplementationsAsProvided,
  AreAllImplementationsAssumedToBeProvided
} from './typegenTypes.ts';
import { PromiseActorLogic } from './actors/promise.ts';
import { Guard, GuardPredicate, UnknownGuard } from './guards.ts';

/**
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
  TExpressionEvent extends EventObject
> {
  context: TContext;
  event: TExpressionEvent;
  self: ActorRef<TExpressionEvent>; // TODO: this should refer to `TEvent`
  system: ActorSystem<any>;
}

export type MachineContext = Record<string, any>;

export interface ActionArgs<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends ParameterizedObject | undefined
> extends UnifiedArg<TContext, TEvent> {
  action: TAction;
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
      infer _TEvent,
      infer _TSnapshot,
      infer _TInternalState,
      infer _TPersisted,
      infer _TSystem,
      infer TInput
    >
  ? TInput
  : never;

export type OutputFrom<T extends AnyActorLogic> = T extends ActorLogic<
  infer _TEvent,
  infer _TSnapshot,
  infer _TInternalState,
  infer _TPersisted,
  infer _TSystem,
  infer _TInput,
  infer TOutput
>
  ? TOutput
  : never;

// TODO: do not accept machines without all implementations
// we should also accept a raw machine as actor logic here
// or just make machine actor logic
export type Spawner = <T extends AnyActorLogic | string>( // TODO: read string from machine logic keys
  logic: T,
  options?: Partial<{
    id: string;
    systemId?: string;
    input: T extends AnyActorLogic ? InputFrom<T> : any;
  }>
) => ActorRefFrom<T>;

export interface AssignArgs<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> extends ActionArgs<TContext, TExpressionEvent, TExpressionAction> {
  spawn: Spawner;
}

export type ActionFunction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> = {
  (args: ActionArgs<TContext, TExpressionEvent, TExpressionAction>): void;
  _out_TEvent?: TEvent;
  _out_TAction?: TAction;
  _out_TGuard?: TGuard;
  _out_TDelay?: TDelay;
};

export interface ChooseBranch<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent,
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
      TAction,
      TGuard,
      TDelay
    >;

export type UnknownAction = Action<
  MachineContext,
  EventObject,
  EventObject,
  ParameterizedObject | undefined,
  ParameterizedObject,
  ParameterizedObject,
  string
>;

export type Actions<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> = SingleOrArray<
  Action<
    TContext,
    TExpressionEvent,
    TEvent,
    TExpressionAction,
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
 * - For a child atomic state node, this is a string, e.g., `"pending"`.
 * - For complex state nodes, this is an object, e.g., `{ success: "someChildState" }`.
 */
export type StateValue = string | StateValueMap;

export type TransitionTarget = SingleOrArray<string>;

export interface TransitionConfig<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
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
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> extends TransitionConfig<TContext, TEvent, TEvent, TAction, TGuard, TDelay> {
  target: TransitionTarget;
}

export type AnyTransitionConfig = TransitionConfig<
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
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> {
  id: string;

  systemId: string | undefined;
  /**
   * The source of the actor logic to be invoked
   */
  src: string;

  input?: Mapper<TContext, TEvent, NonReducibleUnknown> | NonReducibleUnknown;
  /**
   * The transition to take upon the invoked child machine reaching its final top-level state.
   */
  onDone?:
    | string
    | SingleOrArray<
        TransitionConfig<
          TContext,
          DoneInvokeEvent<any>,
          DoneInvokeEvent<any>,
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
          ErrorEvent<any>,
          ErrorEvent<any>,
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
          SnapshotEvent<any>,
          SnapshotEvent<any>,
          TAction,
          TGuard,
          TDelay
        >
      >;

  toJSON: () => Omit<
    InvokeDefinition<TContext, TEvent, TAction, TGuard, TDelay>,
    'onDone' | 'onError' | 'toJSON'
  >;
}

type Delay<TDelay extends string> = TDelay | number;

export type DelayedTransitions<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> =
  | {
      [K in Delay<TDelay>]?:
        | string
        | SingleOrArray<
            TransitionConfig<TContext, TEvent, TEvent, TAction, TGuard, TDelay>
          >;
    }
  | Array<
      TransitionConfig<TContext, TEvent, TEvent, TAction, TGuard, TDelay> & {
        delay:
          | Delay<TDelay>
          | ((args: UnifiedArg<TContext, TEvent>) => Delay<TDelay>);
      }
    >;

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
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> = SingleOrArray<
  | TransitionConfigTarget
  | TransitionConfig<
      TContext,
      TExpressionEvent,
      TEvent,
      TAction,
      TGuard,
      TDelay
    >
>;

export type TransitionsConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> =
  | {
      [K in EventDescriptor<TEvent>]?: TransitionConfigOrTarget<
        TContext,
        ExtractEvent<TEvent, K>,
        TEvent,
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

type IsLiteralString<T extends string> = string extends T ? false : true;

type DistributeActors<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> = TActor extends { src: infer TSrc }
  ? Compute<
      {
        systemId?: string;
        /**
         * The source of the machine to be invoked, or the machine itself.
         */
        src: TSrc;

        input?:
          | Mapper<TContext, TEvent, InputFrom<TActor['logic']>>
          | InputFrom<TActor['logic']>;
        /**
         * The transition to take upon the invoked child machine reaching its final top-level state.
         */
        onDone?:
          | string
          | SingleOrArray<
              TransitionConfigOrTarget<
                TContext,
                DoneInvokeEvent<OutputFrom<TActor['logic']>>,
                TEvent,
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
                ErrorEvent<any>,
                TEvent,
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
                SnapshotEvent<any>,
                TEvent,
                TAction,
                TGuard,
                TDelay
              >
            >;
      } & (TActor['id'] extends string
        ? {
            /**
             * The unique identifier for the invoked machine. If not specified, this
             * will be the machine's own `id`, or the URL (from `src`).
             */
            id: TActor['id'];
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
  ? DistributeActors<TContext, TEvent, TActor, TAction, TGuard, TDelay>
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
        | Mapper<TContext, TEvent, NonReducibleUnknown>
        | NonReducibleUnknown;
      /**
       * The transition to take upon the invoked child machine reaching its final top-level state.
       */
      onDone?:
        | string
        | SingleOrArray<
            TransitionConfigOrTarget<
              TContext,
              DoneInvokeEvent<any>,
              TEvent,
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
              ErrorEvent<any>,
              TEvent,
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
              SnapshotEvent<any>,
              TEvent,
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
    | InitialTransitionConfig<TContext, TEvent, TAction, TGuard, TDelay>
    | SingleOrArray<string>
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
  on?: TransitionsConfig<TContext, TEvent, TAction, TGuard, TDelay>;
  /**
   * The action(s) to be executed upon entering the state node.
   */
  entry?: Actions<TContext, TEvent, TEvent, undefined, TAction, TGuard, TDelay>;
  /**
   * The action(s) to be executed upon exiting the state node.
   */
  exit?: Actions<TContext, TEvent, TEvent, undefined, TAction, TGuard, TDelay>;
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
          DoneStateEventObject,
          TEvent,
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
  after?: DelayedTransitions<TContext, TEvent, TAction, TGuard, TDelay>;

  /**
   * An eventless transition that is always taken when this state node is active.
   */
  always?: TransitionConfigOrTarget<
    TContext,
    TEvent,
    TEvent,
    TAction,
    TGuard,
    TDelay
  >;
  /**
   * @private
   */
  parent?: StateNode<TContext, TEvent>;
  /**
   * The meta data associated with this state node, which will be returned in State instances.
   */
  meta?: any;
  /**
   * The output data sent with the "done.state._id_" event if this is a final state node.
   *
   * The output data will be evaluated with the current `context` and placed on the `.data` property
   * of the event.
   */
  output?: Mapper<TContext, TEvent, TOutput> | TOutput;
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
  output?: FinalStateNodeConfig<TContext, TEvent>['output'];
  invoke: Array<InvokeDefinition<TContext, TEvent, TODO, TODO, TODO>>;
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
  any,
  any,
  any,
  any,
  any, // delays
  any // tags
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

export interface FinalStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends AtomicStateNodeConfig<TContext, TEvent> {
  type: 'final';
  /**
   * The data to be sent with the "done.state.<id>" event. The data can be
   * static or dynamic (based on assigners).
   */
  output?: Mapper<TContext, TEvent, any>;
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
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TDelay extends string = string
> = {
  [K in TAction['type']]?: ActionFunction<
    TContext,
    TEvent,
    TEvent,
    TAction extends { type: K } ? TAction : never,
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
> = Record<string, DelayConfig<TContext, TEvent, TAction>>;

export type DelayConfig<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> = number | DelayExpr<TContext, TExpressionEvent, TExpressionAction>;

// TODO: possibly refactor this somehow, use even a simpler type, and maybe even make `machine.options` private or something
export interface MachineImplementationsSimplified<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject
> {
  guards: GuardMap<TContext, TEvent, TGuard>;
  actions: ActionFunctionMap<TContext, TEvent, TAction>;
  actors: Record<
    string,
    | AnyActorLogic
    | { src: AnyActorLogic; input: Mapper<TContext, TEvent, any> | any }
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
              InputFrom<Cast<Prop<TIndexedActors[K], 'logic'>, AnyActorLogic>>
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
    | undefined
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

type InitialContext<TContext extends MachineContext, TInput> =
  | TContext
  | ContextFactory<TContext, TInput>;

export type ContextFactory<TContext extends MachineContext, TInput> = ({
  spawn,
  input
}: {
  spawn: Spawner;
  input: TInput;
}) => TContext;

type RootStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string,
  TOutput
> = Omit<
  StateNodeConfig<
    TContext,
    TEvent,
    TActor,
    TAction,
    TGuard,
    TDelay,
    TTag,
    TOutput
  >,
  'states'
> & {
  states?:
    | StatesConfig<
        TContext,
        TEvent,
        TActor,
        TAction,
        TGuard,
        TDelay,
        TTag,
        TOutput
      >
    | undefined;
};

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
> = (RootStateNodeConfig<
  NoInfer<TContext>,
  NoInfer<TEvent>,
  NoInfer<TActor>,
  NoInfer<TAction>,
  NoInfer<TGuard>,
  NoInfer<TDelay>,
  NoInfer<TTag>,
  NoInfer<TOutput>
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
}) &
  (Equals<TContext, MachineContext> extends true
    ? { context?: InitialContext<LowInfer<TContext>, TInput> }
    : { context: InitialContext<LowInfer<TContext>, TInput> });

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

// TODO: deduplicate this
export interface DoneInvokeEvent<TOutput> {
  type: `done.invoke.${string}`;
  output: TOutput;
}

export interface ErrorEvent<TErrorData> extends EventObject {
  type: `error.${string}`;
  data: TErrorData;
}

export interface SnapshotEvent<TData> extends EventObject {
  type: `xstate.snapshot.${string}`;
  data: TData;
}

export interface ErrorPlatformEvent extends EventObject {
  type: `error.platform.${string}`;
  data: unknown;
}

export interface DoneInvokeEventObject extends EventObject {
  type: `done.invoke.${string}`;
  output: unknown;
}

export interface DoneStateEventObject extends EventObject {
  type: `done.state.${string}`;
  output: any;
}

export type DelayExpr<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> = (args: ActionArgs<TContext, TExpressionEvent, TExpressionAction>) => number;

export type LogExpr<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> = (
  args: ActionArgs<TContext, TExpressionEvent, TExpressionAction>
) => unknown;

export type SendExpr<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TSentEvent extends EventObject
> = (
  args: ActionArgs<TContext, TExpressionEvent, TExpressionAction>
) => TSentEvent;

export enum SpecialTargets {
  Parent = '#_parent',
  Internal = '#_internal'
}

export interface SendToActionOptions<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TDelay extends string
> extends RaiseActionOptions<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TDelay
  > {}

export interface RaiseActionOptions<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TDelay extends string
> {
  id?: string;
  delay?:
    | Delay<TDelay>
    | DelayExpr<TContext, TExpressionEvent, TExpressionAction>;
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
    TDelay
  > {
  event:
    | TEvent
    | SendExpr<TContext, TExpressionEvent, TExpressionAction, TEvent>;
}

export interface SendToActionParams<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TSentEvent extends EventObject,
  TDelay extends string
> extends SendToActionOptions<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TDelay
  > {
  event:
    | TSentEvent
    | SendExpr<TContext, TExpressionEvent, TExpressionAction, TSentEvent>;
}

export type Assigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> = (
  args: AssignArgs<TContext, TExpressionEvent, TExpressionAction>
) => Partial<TContext>;

export type PartialAssigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TKey extends keyof TContext
> = (
  args: AssignArgs<TContext, TExpressionEvent, TExpressionAction>
) => TContext[TKey];

export type PropertyAssigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> = {
  [K in keyof TContext]?:
    | PartialAssigner<TContext, TExpressionEvent, TExpressionAction, K>
    | TContext[K];
};

export type Mapper<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TResult
> = (args: {
  context: TContext;
  event: TEvent;
  self: ActorRef<TEvent>;
}) => TResult;

export type PropertyMapper<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TParams extends {}
> = {
  [K in keyof TParams]?: Mapper<TContext, TEvent, TParams[K]> | TParams[K];
};

export interface TransitionDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends Omit<
    TransitionConfig<TContext, TEvent, TEvent, TODO, TODO, TODO>,
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
  delay: number | string | DelayExpr<TContext, TEvent, undefined>;
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
  children: Record<string, ActorRef<any>>;
  done?: boolean;
  output?: any;
  error?: unknown;
  tags?: Set<string>;
  machine?: StateMachine<TContext, TEvent, any, any, any, any, any, any, any>;
  _internalQueue?: Array<TEvent>;
}

export interface ActorOptions<TLogic extends AnyActorLogic> {
  /**
   * Whether state actions should be executed immediately upon transition. Defaults to `true`.
   */
  execute?: boolean;
  clock?: Clock;
  logger?: (...args: any[]) => void;
  parent?: ActorRef<any>;
  /**
   * If `true`, defers processing of sent events until the service
   * is initialized (`.start()`). Otherwise, an error will be thrown
   * for events sent to an uninitialized service.
   *
   * Default: `true`
   */
  deferEvents?: boolean;
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
}

export type AnyActor = Actor<any, any>;

/**
 * @deprecated Use `AnyActor` instead.
 */
export type AnyInterpreter = AnyActor;

// Based on RxJS types
export type Observer<T> = {
  next?: (value: T) => void;
  error?: (err: any) => void;
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

export interface ActorRef<TEvent extends EventObject, TSnapshot = any>
  extends Subscribable<TSnapshot>,
    InteropObservable<TSnapshot> {
  /**
   * The unique identifier for this actor relative to its parent.
   */
  id: string;
  sessionId: string;
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
        State<
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
        infer TEvent,
        infer TSnapshot,
        infer _,
        infer __,
        infer ___,
        infer ____,
        infer _____
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
        TEvent,
        State<TContext, TEvent, TActor, TTag, TOutput, TResolvedTypesMeta>,
        State<TContext, TEvent, TActor, TTag, TOutput, TResolvedTypesMeta>,
        PersistedMachineState<
          State<TContext, TEvent, TActor, TTag, TOutput, TResolvedTypesMeta>
        >,
        ActorSystem<any>,
        TInput
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
  TEvent extends EventObject,
  TSnapshot,
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

export type AnyActorContext = ActorContext<any, any, any>;

export interface ActorLogic<
  TEvent extends EventObject,
  TSnapshot = any,
  TInternalState = TSnapshot,
  /**
   * Serialized internal state used for persistence & restoration
   */
  TPersisted = TInternalState,
  TSystem extends ActorSystem<any> = ActorSystem<any>,
  TInput = any,
  TOutput = unknown
> {
  config?: unknown;
  transition: (
    state: TInternalState,
    message: TEvent,
    ctx: ActorContext<TEvent, TSnapshot, TSystem>
  ) => TInternalState;
  getInitialState: (
    actorCtx: ActorContext<TEvent, TSnapshot, TSystem>,
    input: TInput
  ) => TInternalState;
  restoreState?: (
    persistedState: TPersisted,
    actorCtx: ActorContext<TEvent, TSnapshot>
  ) => TInternalState;
  getSnapshot?: (state: TInternalState) => TSnapshot;
  getStatus?: (state: TInternalState) => { status: string; data?: any };
  start?: (
    state: TInternalState,
    actorCtx: ActorContext<TEvent, TSnapshot>
  ) => void;
  /**
   * @returns Persisted state
   */
  getPersistedState?: (state: TInternalState) => TPersisted;
  _out_TOutput?: TOutput; // temp hack to use this type param so we can error properly, ideally this should appear somewhere in the type, perhaps in the `getStatus`?
}

export type AnyActorLogic = ActorLogic<
  any, // event
  any, // snapshot
  any, // internal state
  any, // persisted state
  any, // system
  any, // input
  any // output
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
    : R extends ActorLogic<
        infer _,
        infer TSnapshot,
        infer __,
        infer ___,
        infer ____
      >
    ? TSnapshot
    : R extends ActorContext<infer _, infer TSnapshot, infer __>
    ? TSnapshot
    : never
  : never;

export type EventFromLogic<TLogic extends ActorLogic<any, any>> =
  TLogic extends ActorLogic<
    infer TEvent,
    infer _,
    infer __,
    infer ___,
    infer ____
  >
    ? TEvent
    : never;

export type PersistedStateFrom<TLogic extends ActorLogic<any, any>> =
  TLogic extends ActorLogic<
    infer _TEvent,
    infer _TSnapshot,
    infer _TInternalState,
    infer TPersisted
  >
    ? TPersisted
    : never;

export type InternalStateFrom<TLogic extends ActorLogic<any, any>> =
  TLogic extends ActorLogic<
    infer _TEvent,
    infer _TSnapshot,
    infer TInternalState,
    infer _TPersisted
  >
    ? TInternalState
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
  _bookId: () => string;
  _register: (sessionId: string, actorRef: AnyActorRef) => string;
  _unregister: (actorRef: AnyActorRef) => void;
  _set: <K extends keyof T['actors']>(key: K, actorRef: T['actors'][K]) => void;
  get: <K extends keyof T['actors']>(key: K) => T['actors'][K] | undefined;
}

export type AnyActorSystem = ActorSystem<any>;

export type PersistedMachineState<TState extends AnyState> = Pick<
  TState,
  'value' | 'output' | 'error' | 'context' | 'done' | 'historyValue'
> & {
  children: {
    [K in keyof TState['children']]: {
      state: any; // TODO: fix (should be state from actorref)
      src?: string;
    };
  };
};
