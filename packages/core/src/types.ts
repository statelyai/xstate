import type { StateNode } from './StateNode.js';
import type { State } from './State.js';
import type { ActorStatus, Clock, Interpreter } from './interpreter.js';
import type { StateMachine } from './StateMachine.js';
import type { LifecycleSignal } from './actors/index.js';
import {
  TypegenDisabled,
  ResolveTypegenMeta,
  TypegenConstraint,
  MarkAllImplementationsAsProvided,
  AreAllImplementationsAssumedToBeProvided
} from './typegenTypes.js';

export type AnyFunction = (...args: any[]) => any;

type ReturnTypeOrValue<T> = T extends AnyFunction ? ReturnType<T> : T;

// https://github.com/microsoft/TypeScript/issues/23182#issuecomment-379091887
export type IsNever<T> = [T] extends [never] ? true : false;

export type Compute<A extends any> = { [K in keyof A]: A[K] } & unknown;
export type Prop<T, K> = K extends keyof T ? T[K] : never;
export type Values<T> = T[keyof T];
export type Merge<M, N> = Omit<M, keyof N> & N;
// TODO: replace in v5 with:
// export type IndexByType<T extends { type: string }> = { [E in T as E['type']]: E; };
export type IndexByType<T extends { type: string }> = {
  [K in T['type']]: T extends any ? (K extends T['type'] ? T : never) : never;
};

export type Equals<A1 extends any, A2 extends any> = (<A>() => A extends A2
  ? true
  : false) extends <A>() => A extends A1 ? true : false
  ? true
  : false;
export type IsAny<T> = Equals<T, any>;
export type Cast<A, B> = A extends B ? A : B;
export type NoInfer<T> = [T][T extends any ? 0 : any];
export type LowInfer<T> = T & {};

export type EventType = string;
export type ActionType = string;
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

export interface BaseActionObject {
  type: string;
  params?: Record<string, any>;
  execute?: (actorCtx: ActorContext<any, any>) => void;
}

export interface BuiltInActionObject {
  type: `xstate.${string}`;
  params: Record<string, any>;
}

export interface BaseDynamicActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TResolvedAction extends BaseActionObject,
  TDynamicParams extends Record<string, any>
> {
  type: `xstate.${string}`;
  params: TDynamicParams;
  resolve: (
    _event: SCXML.Event<TEvent>,
    extra: {
      state: State<TContext, TEvent>;
      /**
       * The original action object
       */
      action: BaseActionObject;
      actorContext: ActorContext<any, any> | undefined;
    }
  ) => [AnyState, TResolvedAction];
}

export type MachineContext = Record<string, any>;

export interface ActionMeta<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject = BaseActionObject
> extends StateMeta<TContext, TEvent> {
  action: TAction;
  _event: SCXML.Event<TEvent>;
}

// TODO: do not accept machines without all implementations
// we should also accept a raw machine as a behavior here
// or just make machine a behavior
export type Spawner = <T extends ActorBehavior<any, any> | string>( // TODO: read string from machine behavior keys
  behavior: T,
  name?: string
) => T extends ActorBehavior<infer TActorEvent, infer TActorEmitted>
  ? ActorRef<TActorEvent, TActorEmitted>
  : ActorRef<any, any>; // TODO: narrow this to behaviors from machine

export interface AssignMeta<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  state: State<TContext, TEvent>;
  action: BaseActionObject;
  _event: SCXML.Event<TEvent>;
  spawn: Spawner;
}

export type ActionFunction<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject = BaseActionObject
> = {
  bivarianceHack(
    context: TContext,
    event: TEvent,
    meta: ActionMeta<TContext, TEvent, TAction>
  ): void;
}['bivarianceHack'];

export interface ChooseCondition<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  guard?: GuardConfig<TContext, TEvent>;
  actions: Actions<TContext, TEvent>;
}

export type Action<
  TContext extends MachineContext,
  TEvent extends EventObject
> =
  | ActionType
  | BaseActionObject
  | ActionFunction<TContext, TEvent>
  | BaseDynamicActionObject<TContext, TEvent, any, any>; // TODO: fix last param

/**
 * Extracts action objects that have no extra properties.
 */
type SimpleActionsFrom<T extends BaseActionObject> = BaseActionObject extends T
  ? T // If actions are unspecified, all action types are allowed (unsafe)
  : ExtractWithSimpleSupport<T>;

export type BaseAction<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject
> =
  | BaseDynamicActionObject<
      TContext,
      TEvent,
      any, // TODO: at the very least this should include TAction, but probably at a covariant position or something, we really need to rethink how action objects are typed
      any
    >
  | TAction
  | SimpleActionsFrom<TAction>['type']
  | ActionFunction<TContext, TEvent>;

export type BaseActions<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject
> = SingleOrArray<BaseAction<TContext, TEvent, TAction>>;

export type Actions<
  TContext extends MachineContext,
  TEvent extends EventObject
> = SingleOrArray<Action<TContext, TEvent>>;

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

export type GuardPredicate<
  TContext extends MachineContext,
  TEvent extends EventObject
> = (
  context: TContext,
  event: TEvent,
  meta: GuardMeta<TContext, TEvent>
) => boolean;

export interface DefaultGuardObject<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  type: string;
  params?: { [key: string]: any };
  /**
   * Nested guards
   */
  children?: Array<GuardObject<TContext, TEvent>>;
  predicate?: GuardPredicate<TContext, TEvent>;
}

export type GuardEvaluator<
  TContext extends MachineContext,
  TEvent extends EventObject
> = (
  guard: GuardDefinition<TContext, TEvent>,
  context: TContext,
  _event: SCXML.Event<TEvent>,
  state: State<TContext, TEvent>,
  machine: StateMachine<TContext, TEvent>
) => boolean;

export interface GuardMeta<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends StateMeta<TContext, TEvent> {
  guard: GuardDefinition<TContext, TEvent>;
  evaluate: GuardEvaluator<TContext, TEvent>;
}

export type GuardConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> = string | GuardPredicate<TContext, TEvent> | GuardObject<TContext, TEvent>;

export type GuardObject<
  TContext extends MachineContext,
  TEvent extends EventObject
> = BooleanGuardObject<TContext, TEvent> | DefaultGuardObject<TContext, TEvent>;

export interface GuardDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  type: string;
  children?: Array<GuardDefinition<TContext, TEvent>>;
  predicate?: GuardPredicate<TContext, TEvent>;
  params: { [key: string]: any };
}

export interface BooleanGuardObject<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  type: 'xstate.boolean';
  children: Array<GuardConfig<TContext, TEvent>>;
  params: {
    op: 'and' | 'or' | 'not';
  };
  predicate: undefined;
}

export interface BooleanGuardDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends GuardDefinition<TContext, TEvent> {
  type: 'xstate.boolean';
  params: {
    op: 'and' | 'or' | 'not';
  };
}

export type TransitionTarget = SingleOrArray<string>;

export interface TransitionConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject = BaseActionObject
> {
  guard?: GuardConfig<TContext, TEvent>;
  actions?: BaseActions<TContext, TEvent, TAction>;
  internal?: boolean;
  target?: TransitionTarget | undefined;
  meta?: Record<string, any>;
  description?: string;
}

export interface TargetTransitionConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends TransitionConfig<TContext, TEvent> {
  target: TransitionTarget; // TODO: just make this non-optional
}

export type ConditionalTransitionConfig<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject
> = Array<TransitionConfig<TContext, TEvent>>;

export interface InitialTransitionConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends TransitionConfig<TContext, TEvent> {
  guard?: never;
  target: TransitionTarget;
}

export type Transition<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject
> =
  | string
  | TransitionConfig<TContext, TEvent>
  | ConditionalTransitionConfig<TContext, TEvent>;

type ExtractWithSimpleSupport<T extends { type: string }> = T extends any
  ? { type: T['type'] } extends T
    ? T
    : never
  : never;

export type Receiver<TEvent extends EventObject> = (
  listener: {
    bivarianceHack(event: TEvent): void;
  }['bivarianceHack']
) => void;

export type InvokeCallback<
  TEvent extends EventObject = AnyEventObject,
  TSentEvent extends EventObject = AnyEventObject
> = (
  callback: (event: TSentEvent) => void,
  onReceive: Receiver<TEvent>
) => (() => void) | Promise<any> | void;

export type ActorBehaviorCreator<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActorBehavior extends AnyActorBehavior = AnyActorBehavior
> = (
  context: TContext,
  event: TEvent,
  meta: {
    id: string;
    data?: any;
    src: InvokeSourceDefinition;
    _event: SCXML.Event<TEvent>;
    meta: MetaObject | undefined;
  }
) => TActorBehavior;

export interface InvokeMeta {
  data: any;
  src: InvokeSourceDefinition;
  meta: MetaObject | undefined;
}

export interface InvokeDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  id: string;
  /**
   * The source of the actor's behavior to be invoked
   */
  src: InvokeSourceDefinition;
  /**
   * If `true`, events sent to the parent service will be forwarded to the invoked service.
   *
   * Default: `false`
   */
  autoForward?: boolean;
  /**
   * Data from the parent machine's context to set as the (partial or full) context
   * for the invoked child machine.
   *
   * Data should be mapped to match the child machine's context shape.
   */
  data?: Mapper<TContext, TEvent, any> | PropertyMapper<TContext, TEvent, any>;
  /**
   * The transition to take upon the invoked child machine reaching its final top-level state.
   */
  onDone?:
    | string
    | SingleOrArray<TransitionConfig<TContext, DoneInvokeEvent<any>>>;
  /**
   * The transition to take upon the invoked child machine sending an error event.
   */
  onError?: string | SingleOrArray<TransitionConfig<TContext, ErrorEvent<any>>>;

  onSnapshot?:
    | string
    | SingleOrArray<TransitionConfig<TContext, SnapshotEvent<any>>>;

  toJSON: () => Omit<
    InvokeDefinition<TContext, TEvent>,
    'onDone' | 'onError' | 'toJSON'
  >;
  meta: MetaObject | undefined;
}

export interface Delay {
  id: string;
  /**
   * The time to delay the event, in milliseconds.
   */
  delay: number;
}

export type DelayedTransitions<
  TContext extends MachineContext,
  TEvent extends EventObject
> =
  | Record<
      string | number,
      string | SingleOrArray<TransitionConfig<TContext, TEvent>>
    >
  | Array<
      TransitionConfig<TContext, TEvent> & {
        delay: number | string | Expr<TContext, TEvent, number>;
      }
    >;

export type StateTypes =
  | 'atomic'
  | 'compound'
  | 'parallel'
  | 'final'
  | 'history'
  | string; // TODO: remove once TS fixes this type-widening issue

export type SingleOrArray<T> = T[] | T;

export type StateNodesConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in string]: StateNode<TContext, TEvent>;
};

export type StatesConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject = BaseActionObject
> = {
  [K in string]: StateNodeConfig<TContext, TEvent, TAction>;
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
  TEvent extends EventObject
> = SingleOrArray<TransitionConfigTarget | TransitionConfig<TContext, TEvent>>;

export type TransitionsConfigMap<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in TEvent['type'] | '' | '*']?: K extends '' | '*'
    ? TransitionConfigOrTarget<TContext, TEvent>
    : TransitionConfigOrTarget<TContext, ExtractEvent<TEvent, K>>;
};

type TransitionsConfigArray<
  TContext extends MachineContext,
  TEvent extends EventObject
> = Array<
  // distribute the union
  | (TEvent extends EventObject
      ? TransitionConfig<TContext, TEvent> & { event: TEvent['type'] }
      : never)
  | (TransitionConfig<TContext, TEvent> & { event: '*' })
>;

export type TransitionsConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> =
  | TransitionsConfigMap<TContext, TEvent>
  | TransitionsConfigArray<TContext, TEvent>;

export interface InvokeSourceDefinition {
  [key: string]: any;
  type: string;
}

export interface InvokeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  /**
   * The unique identifier for the invoked machine. If not specified, this
   * will be the machine's own `id`, or the URL (from `src`).
   */
  id?: string;
  /**
   * The source of the machine to be invoked, or the machine itself.
   */
  src:
    | string
    | InvokeSourceDefinition
    | ActorBehaviorCreator<TContext, TEvent>
    | ActorBehavior<any, any>; // TODO: fix types
  /**
   * If `true`, events sent to the parent service will be forwarded to the invoked service.
   *
   * Default: `false`
   */
  autoForward?: boolean;
  /**
   * Data from the parent machine's context to set as the (partial or full) context
   * for the invoked child machine.
   *
   * Data should be mapped to match the child machine's context shape.
   */
  data?: Mapper<TContext, TEvent, any> | PropertyMapper<TContext, TEvent, any>;
  /**
   * The transition to take upon the invoked child machine reaching its final top-level state.
   */
  onDone?:
    | string
    | SingleOrArray<TransitionConfigOrTarget<TContext, DoneInvokeEvent<any>>>;
  /**
   * The transition to take upon the invoked child machine sending an error event.
   */
  onError?:
    | string
    | SingleOrArray<TransitionConfigOrTarget<TContext, DoneInvokeEvent<any>>>;

  onSnapshot?:
    | string
    | SingleOrArray<TransitionConfigOrTarget<TContext, SnapshotEvent<any>>>;
  /**
   * Meta data related to this invocation
   */
  meta?: MetaObject;
}

export interface StateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject = BaseActionObject
> {
  /**
   * The initial state transition.
   */
  initial?:
    | InitialTransitionConfig<TContext, TEvent>
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
  states?: StatesConfig<TContext, TEvent, TAction> | undefined;
  /**
   * The services to invoke upon entering this state node. These services will be stopped upon exiting this state node.
   */
  invoke?: SingleOrArray<
    | string
    | ActorBehaviorCreator<TContext, TEvent>
    | InvokeConfig<TContext, TEvent>
  >;
  /**
   * The mapping of event types to their potential transition(s).
   */
  on?: TransitionsConfig<TContext, TEvent>;
  /**
   * The action(s) to be executed upon entering the state node.
   */
  entry?: BaseActions<TContext, TEvent, TAction>;
  /**
   * The action(s) to be executed upon exiting the state node.
   */
  exit?: BaseActions<TContext, TEvent, TAction>;
  /**
   * The potential transition(s) to be taken upon reaching a final child state node.
   *
   * This is equivalent to defining a `[done(id)]` transition on this state node's `on` property.
   */
  onDone?:
    | string
    | SingleOrArray<TransitionConfig<TContext, DoneEventObject>>
    | undefined;
  /**
   * The mapping (or array) of delays (in milliseconds) to their potential transition(s).
   * The delayed transitions are taken after the specified delay in an interpreter.
   */
  after?: DelayedTransitions<TContext, TEvent>;

  /**
   * An eventless transition that is always taken when this state node is active.
   */
  always?: TransitionConfigOrTarget<TContext, TEvent>;
  /**
   * @private
   */
  parent?: StateNode<TContext, TEvent>;
  strict?: boolean | undefined;
  /**
   * The meta data associated with this state node, which will be returned in State instances.
   */
  meta?: any;
  /**
   * The data sent with the "done.state._id_" event if this is a final state node.
   *
   * The data will be evaluated with the current `context` and placed on the `.data` property
   * of the event.
   */
  data?: Mapper<TContext, TEvent, any> | PropertyMapper<TContext, TEvent, any>;
  /**
   * The unique ID of the state node, which can be referenced as a transition target via the
   * `#id` syntax.
   */
  id?: string | undefined;
  /**
   * The string delimiter for serializing the path to a string. The default is "."
   */
  delimiter?: string;
  /**
   * The order this state node appears. Corresponds to the implicit SCXML document order.
   */
  order?: number;

  /**
   * The tags for this state node, which are accumulated into the `state.tags` property.
   */
  tags?: SingleOrArray<string>;
  /**
   * A text description of the state node
   */
  description?: string;

  /**
   * A default target for a history state
   */
  target?: string;
}

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
  entry: BaseActionObject[];
  exit: BaseActionObject[];
  meta: any;
  order: number;
  data?: FinalStateNodeConfig<TContext, TEvent>['data'];
  invoke: Array<InvokeDefinition<TContext, TEvent>>;
  description?: string;
  tags: string[];
}

export interface StateMachineDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends StateNodeDefinition<TContext, TEvent> {
  context: TContext;
}

export type AnyStateNode = StateNode<any, any>;

export type AnyStateNodeDefinition = StateNodeDefinition<any, any>;

export type AnyState = State<any, any, any>;

export type AnyStateMachine = StateMachine<any, any, any, any, any>;

export type AnyStateConfig = StateConfig<any, AnyEventObject>;

export interface AtomicStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends StateNodeConfig<TContext, TEvent> {
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
  data?: Mapper<TContext, TEvent, any> | PropertyMapper<TContext, TEvent, any>;
}

export type SimpleOrStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> = AtomicStateNodeConfig<TContext, TEvent> | StateNodeConfig<TContext, TEvent>;

export type ActionFunctionMap<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject = BaseActionObject
> = {
  [K in TAction['type']]?:
    | BaseDynamicActionObject<TContext, TEvent, TAction, any>
    | ActionFunction<
        TContext,
        TEvent,
        TAction extends { type: K } ? TAction : never
      >;
};

export type DelayFunctionMap<
  TContext extends MachineContext,
  TEvent extends EventObject
> = Record<string, DelayConfig<TContext, TEvent>>;

export type DelayConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> = number | DelayExpr<TContext, TEvent>;

// TODO: possibly refactor this somehow, use even a simpler type, and maybe even make `machine.options` private or something
export interface MachineImplementationsSimplified<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject = BaseActionObject
> {
  guards: Record<string, GuardPredicate<TContext, TEvent>>;
  actions: ActionFunctionMap<TContext, TEvent, TAction>;
  actors: Record<
    string,
    ActorBehaviorCreator<TContext, TEvent> | AnyActorBehavior
  >;
  delays: DelayFunctionMap<TContext, TEvent>;
  context: Partial<TContext> | ContextFactory<Partial<TContext>>;
  state: State<TContext, TEvent, any> | undefined;
}

type MachineImplementationsActions<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TEventsCausingActions = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'eventsCausingActions'
  >,
  TIndexedEvents = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedEvents'>,
  TIndexedActions = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedActions'>
> = {
  [K in keyof TEventsCausingActions]?:
    | BaseDynamicActionObject<
        TContext,
        Cast<Prop<TIndexedEvents, TEventsCausingActions[K]>, EventObject>,
        any, // TODO: this should receive something like `Cast<Prop<TIndexedActions, K>, BaseActionObject>`, but at the moment builtin actions expect Resolved*Action here and this should be simplified somehow
        any
      >
    | ActionFunction<
        TContext,
        Cast<Prop<TIndexedEvents, TEventsCausingActions[K]>, EventObject>,
        Cast<Prop<TIndexedActions, K>, BaseActionObject>
      >;
};

type MachineImplementationsDelays<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TEventsCausingDelays = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'eventsCausingDelays'
  >,
  TIndexedEvents = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedEvents'>
> = {
  [K in keyof TEventsCausingDelays]?: DelayConfig<
    TContext,
    Cast<Prop<TIndexedEvents, TEventsCausingDelays[K]>, EventObject>
  >;
};

type MachineImplementationsGuards<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TEventsCausingGuards = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'eventsCausingGuards'
  >,
  TIndexedEvents = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedEvents'>
> = {
  [K in keyof TEventsCausingGuards]?: GuardPredicate<
    TContext,
    Cast<Prop<TIndexedEvents, TEventsCausingGuards[K]>, EventObject>
  >;
};

type MachineImplementationsActors<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TEventsCausingActors = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'eventsCausingActors'
  >,
  TIndexedEvents = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedEvents'>,
  _TInvokeSrcNameMap = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'invokeSrcNameMap'
  >
> = {
  [K in keyof TEventsCausingActors]?:
    | ActorBehaviorCreator<
        TContext,
        Cast<Prop<TIndexedEvents, TEventsCausingActors[K]>, EventObject>
        // Prop<Prop<TIndexedEvents, Prop<TInvokeSrcNameMap, K>>, 'data'>,
        // EventObject,
        // Cast<TIndexedEvents[keyof TIndexedEvents], EventObject> // it would make sense to pass `TEvent` around to use it here directly
      >
    | AnyActorBehavior;
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
> = MaybeMakeMissingImplementationsRequired<
  'actions',
  Prop<TMissingImplementations, 'actions'>,
  TRequireMissingImplementations
> & {
  actions?: MachineImplementationsActions<TContext, TResolvedTypesMeta>;
};

type GenerateDelaysImplementationsPart<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> = MaybeMakeMissingImplementationsRequired<
  'delays',
  Prop<TMissingImplementations, 'delays'>,
  TRequireMissingImplementations
> & {
  delays?: MachineImplementationsDelays<TContext, TResolvedTypesMeta>;
};

type GenerateGuardsImplementationsPart<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> = MaybeMakeMissingImplementationsRequired<
  'guards',
  Prop<TMissingImplementations, 'guards'>,
  TRequireMissingImplementations
> & {
  guards?: MachineImplementationsGuards<TContext, TResolvedTypesMeta>;
};

type GenerateActorsImplementationsPart<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> = MaybeMakeMissingImplementationsRequired<
  'actors',
  Prop<TMissingImplementations, 'actors'>,
  TRequireMissingImplementations
> & {
  actors?: MachineImplementationsActors<TContext, TResolvedTypesMeta>;
};

export type InternalMachineImplementations<
  TContext extends MachineContext,
  _TEvent extends EventObject,
  TResolvedTypesMeta,
  TRequireMissingImplementations extends boolean = false,
  TMissingImplementations = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'missingImplementations'
  >
> = GenerateActionsImplementationsPart<
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
  > &
  GenerateActorsImplementationsPart<
    TContext,
    TResolvedTypesMeta,
    TRequireMissingImplementations,
    TMissingImplementations
  >;

export type MachineImplementations<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject = BaseActionObject,
  TActorMap extends ActorMap = ActorMap,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
> = InternalMachineImplementations<
  TContext,
  TEvent,
  ResolveTypegenMeta<TTypesMeta, TEvent, TAction, TActorMap>
>;

type InitialContext<TContext extends MachineContext> =
  | TContext
  | ContextFactory<TContext>;

export type ContextFactory<TContext extends MachineContext> = (stuff: {
  spawn: Spawner;
  input: any; // TODO: fix
}) => TContext;

export interface MachineConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject = BaseActionObject,
  TActorMap extends ActorMap = ActorMap,
  TTypesMeta = TypegenDisabled
> extends StateNodeConfig<NoInfer<TContext>, NoInfer<TEvent>, TAction> {
  /**
   * The initial context (extended state)
   */
  context?: InitialContext<LowInfer<TContext>>;
  /**
   * The machine's own version.
   */
  version?: string;
  /**
   * If `true`, will use SCXML semantics, such as event token matching.
   */
  scxml?: boolean;
  schema?: MachineSchema<TContext, TEvent, TActorMap>;
  tsTypes?: TTypesMeta;
}

export type ActorMap = Record<string, { data: any }>;
export interface MachineSchema<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActorMap extends ActorMap = ActorMap
> {
  context?: TContext;
  actions?: { type: string; [key: string]: any };
  actors?: TActorMap;
  events?: TEvent;
  guards?: { type: string; [key: string]: any };
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

export enum ActionTypes {
  Stop = 'xstate.stop',
  Raise = 'xstate.raise',
  Send = 'xstate.send',
  Cancel = 'xstate.cancel',
  Assign = 'xstate.assign',
  After = 'xstate.after',
  DoneState = 'done.state',
  DoneInvoke = 'done.invoke',
  Log = 'xstate.log',
  Init = 'xstate.init',
  Invoke = 'xstate.invoke',
  ErrorExecution = 'error.execution',
  ErrorCommunication = 'error.communication',
  ErrorPlatform = 'error.platform',
  ErrorCustom = 'xstate.error',
  Pure = 'xstate.pure',
  Choose = 'xstate.choose'
}

export interface RaiseActionObject<TEvent extends EventObject>
  extends BuiltInActionObject {
  type: ActionTypes.Raise;
  params: {
    _event: SCXML.Event<TEvent>;
  };
}

export interface DoneInvokeEvent<TData> extends EventObject {
  type: `done.invoke.${string}`;
  data: TData;
}

export interface ErrorEvent<TErrorData> {
  type: `error.${string}`;
  data: TErrorData;
}

export interface SnapshotEvent<TData> {
  type: `xstate.snapshot.${string}`;
  data: TData;
}

export interface ErrorExecutionEvent extends EventObject {
  src: string;
  type: ActionTypes.ErrorExecution;
  data: any;
}

export interface ErrorPlatformEvent extends EventObject {
  data: any;
}

export interface SCXMLErrorEvent extends SCXML.Event<any> {
  name:
    | ActionTypes.ErrorExecution
    | ActionTypes.ErrorPlatform
    | ActionTypes.ErrorCommunication;
  data: any;
}

export interface DoneEventObject extends EventObject {
  data?: any;
  toString(): string;
}

export type DoneEvent = DoneEventObject & string;

export interface InvokeAction {
  type: ActionTypes.Invoke;
  src: InvokeSourceDefinition | ActorRef<any>;
  id: string;
  autoForward?: boolean;
  data?: any;
  exec?: undefined;
  meta: MetaObject | undefined;
}

export interface DynamicInvokeActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  type: ActionTypes.Invoke;
  params: InvokeDefinition<TContext, TEvent>;
}

export interface InvokeActionObject extends BaseActionObject {
  type: ActionTypes.Invoke;
  params: {
    src: InvokeSourceDefinition | ActorRef<any>;
    id: string;
    autoForward?: boolean;
    data?: any;
    exec?: undefined;
    ref?: ActorRef<any>;
    meta: MetaObject | undefined;
  };
}

export interface DynamicStopActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  type: ActionTypes.Stop;
  params: {
    actor:
      | string
      | ActorRef<any>
      | Expr<TContext, TEvent, ActorRef<any> | string>;
  };
}

export interface StopActionObject {
  type: ActionTypes.Stop;
  params: {
    actor: ActorRef<any>;
  };
}

export type DelayExpr<
  TContext extends MachineContext,
  TEvent extends EventObject
> = ExprWithMeta<TContext, TEvent, number>;

export type LogExpr<
  TContext extends MachineContext,
  TEvent extends EventObject
> = ExprWithMeta<TContext, TEvent, any>;

export interface DynamicLogAction<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends BaseDynamicActionObject<
    TContext,
    TEvent,
    LogActionObject,
    {
      label: string | undefined;
      expr: string | LogExpr<TContext, TEvent>;
    }
  > {
  type: ActionTypes.Log;
}

export interface LogActionObject extends BuiltInActionObject {
  type: ActionTypes.Log;
  params: {
    label: string | undefined;
    value: any;
  };
}

export interface SendActionObject<
  TSentEvent extends EventObject = AnyEventObject
> extends BaseActionObject {
  type: 'xstate.send';
  params: {
    to: ActorRef<TSentEvent> | undefined;
    _event: SCXML.Event<TSentEvent>;
    event: TSentEvent;
    delay?: number;
    id: string | number;
    internal: boolean;
  };
}

export type Expr<
  TContext extends MachineContext,
  TEvent extends EventObject,
  T
> = (context: TContext, event: TEvent) => T;

export type ExprWithMeta<
  TContext extends MachineContext,
  TEvent extends EventObject,
  T
> = (context: TContext, event: TEvent, meta: SCXMLEventMeta<TEvent>) => T;

export type SendExpr<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject = AnyEventObject
> = ExprWithMeta<TContext, TEvent, TSentEvent>;

export enum SpecialTargets {
  Parent = '#_parent',
  Internal = '#_internal'
}

export interface SendActionOptions<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  id?: string | number;
  delay?: number | string | DelayExpr<TContext, TEvent>;
  to?:
    | string
    | ActorRef<any, any>
    | ExprWithMeta<TContext, TEvent, string | ActorRef<any, any>>;
}

export interface SendActionParams<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject = EventObject
> extends SendActionOptions<TContext, TEvent> {
  event: TSentEvent | SendExpr<TContext, TEvent, TSentEvent>;
}

export interface DynamicCancelActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  type: ActionTypes.Cancel;
  params: {
    sendId: string | ExprWithMeta<TContext, TEvent, string>;
  };
}

export interface CancelActionObject extends BaseActionObject {
  type: ActionTypes.Cancel;
  params: {
    sendId: string;
  };
}

export type Assigner<
  TContext extends MachineContext,
  TEvent extends EventObject
> = (
  context: TContext,
  event: TEvent,
  meta: AssignMeta<TContext, TEvent>
) => Partial<TContext>;

export type PartialAssigner<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TKey extends keyof TContext
> = (
  context: TContext,
  event: TEvent,
  meta: AssignMeta<TContext, TEvent>
) => TContext[TKey];

export type PropertyAssigner<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in keyof TContext]?: PartialAssigner<TContext, TEvent, K> | TContext[K];
};

export type Mapper<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TParams extends {}
> = (context: TContext, event: TEvent) => TParams;

export type PropertyMapper<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TParams extends {}
> = {
  [K in keyof TParams]?:
    | ((context: TContext, event: TEvent) => TParams[K])
    | TParams[K];
};

export interface AnyAssignAction extends BaseActionObject {
  type: ActionTypes.Assign;
  assignment: any;
}

export type DynamicAssignAction<
  TContext extends MachineContext,
  TEvent extends EventObject
> = BaseDynamicActionObject<
  TContext,
  TEvent,
  AssignActionObject<TContext> | RaiseActionObject<TEvent>,
  {
    assignment: Assigner<TContext, TEvent> | PropertyAssigner<TContext, TEvent>;
  }
>;

export interface AssignActionObject<TContext extends MachineContext>
  extends BaseActionObject {
  type: ActionTypes.Assign;
  params: {
    context: TContext;
    actions: BaseActionObject[];
  };
}

export interface DynamicPureActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  type: ActionTypes.Pure;
  params: {
    get: (
      context: TContext,
      event: TEvent
    ) => SingleOrArray<BaseActionObject | BaseActionObject['type']> | undefined;
  };
}

export interface PureActionObject extends BaseActionObject {
  type: ActionTypes.Pure;
  params: {
    actions: BaseActionObject[];
  };
}

export interface ChooseAction<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends BaseActionObject {
  type: ActionTypes.Choose;
  params: {
    guards: Array<ChooseCondition<TContext, TEvent>>;
  };
}

export interface ResolvedChooseAction extends BaseActionObject {
  type: ActionTypes.Choose;
  params: {
    actions: BaseActionObject[];
  };
}

export interface TransitionDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends Omit<TransitionConfig<TContext, TEvent>, 'target'> {
  target: Array<StateNode<TContext, TEvent>> | undefined;
  source: StateNode<TContext, TEvent>;
  actions: BaseActionObject[];
  guard?: GuardDefinition<TContext, TEvent>;
  eventType: TEvent['type'] | '*';
  toJSON: () => {
    target: string[] | undefined;
    source: string;
    actions: BaseActionObject[];
    guard?: GuardDefinition<TContext, TEvent>;
    eventType: TEvent['type'] | '*';
    meta?: Record<string, any>;
  };
}

export type AnyTransitionDefinition = TransitionDefinition<any, any>;

export interface InitialTransitionDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends TransitionDefinition<TContext, TEvent> {
  target: Array<StateNode<TContext, TEvent>>;
  guard?: never;
}

export type TransitionDefinitionMap<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in TEvent['type'] | '*']: Array<
    TransitionDefinition<
      TContext,
      K extends TEvent['type'] ? Extract<TEvent, { type: K }> : EventObject
    >
  >;
};

export interface DelayedTransitionDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends TransitionDefinition<TContext, TEvent> {
  delay: number | string | DelayExpr<TContext, TEvent>;
}

export interface Edge<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEventType extends TEvent['type'] = string
> {
  event: TEventType;
  source: StateNode<TContext, TEvent>;
  target: StateNode<TContext, TEvent>;
  cond?: GuardConfig<TContext, TEvent & { type: TEventType }>;
  actions: Array<Action<TContext, TEvent>>;
  meta?: MetaObject;
  transition: TransitionDefinition<TContext, TEvent>;
}
export interface NodesAndEdges<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  nodes: StateNode[];
  edges: Array<Edge<TContext, TEvent, TEvent['type']>>;
}

export interface Segment<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  /**
   * From state.
   */
  state: State<TContext, TEvent>;
  /**
   * Event from state.
   */
  event: TEvent;
}

export interface PathItem<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  state: State<TContext, TEvent>;
  path: Array<Segment<TContext, TEvent>>;
  weight?: number;
}

export interface PathMap<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  [key: string]: PathItem<TContext, TEvent>;
}

export interface PathsItem<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  state: State<TContext, TEvent>;
  paths: Array<Array<Segment<TContext, TEvent>>>;
}

export interface PathsMap<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  [key: string]: PathsItem<TContext, TEvent>;
}

export interface TransitionMap {
  state: StateValue | undefined;
}

export interface AdjacencyMap {
  [stateId: string]: Record<string, TransitionMap>;
}

export interface ValueAdjacencyMap<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  [stateId: string]: Record<string, State<TContext, TEvent>>;
}

export interface SCXMLEventMeta<TEvent extends EventObject> {
  _event: SCXML.Event<TEvent>;
}

export interface StateMeta<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  state: State<TContext, TEvent, any>;
  _event: SCXML.Event<TEvent>;
}

export interface StateLike<TContext extends MachineContext> {
  value: StateValue;
  context: TContext;
  event: EventObject;
  _event: SCXML.Event<EventObject>;
}

export interface StateConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  value: StateValue;
  context: TContext;
  _event: SCXML.Event<TEvent>;
  _sessionid: string | undefined;
  historyValue?: HistoryValue<TContext, TEvent>;
  actions?: BaseActionObject[];
  meta?: any;
  configuration?: Array<StateNode<TContext, TEvent>>;
  transitions: Array<TransitionDefinition<TContext, TEvent>>;
  children: Record<string, ActorRef<any>>;
  done?: boolean;
  output?: any;
  tags?: Set<string>;
  machine?: StateMachine<TContext, TEvent, any, any, any>;
  _internalQueue?: Array<SCXML.Event<TEvent>>;
}

export interface InterpreterOptions {
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

  /**
   * If `true`, events from the parent will be sent to this interpreter.
   *
   * Default: `false`
   */
  autoForward?: boolean;

  sync?: boolean;

  /**
   * The input data to pass to the machine.
   */
  input?: any;

  state?: any; // TODO: type this
}

export type AnyInterpreter = Interpreter<any>;

export declare namespace SCXML {
  // tslint:disable-next-line:no-shadowed-variable
  export interface Event<TEvent extends EventObject> {
    /**
     * This is a character string giving the name of the event.
     * The SCXML Processor must set the name field to the name of this event.
     * It is what is matched against the 'event' attribute of <transition>.
     * Note that transitions can do additional tests by using the value of this field
     * inside boolean expressions in the 'cond' attribute.
     */
    name: string;
    /**
     * This field describes the event type.
     * The SCXML Processor must set it to: "platform" (for events raised by the platform itself, such as error events),
     * "internal" (for events raised by <raise> and <send> with target '_internal')
     * or "external" (for all other events).
     */
    type: 'platform' | 'internal' | 'external';
    /**
     * If the sending entity has specified a value for this, the Processor must set this field to that value
     * (see C Event I/O Processors for details).
     * Otherwise, in the case of error events triggered by a failed attempt to send an event,
     * the Processor must set this field to the send id of the triggering <send> element.
     * Otherwise it must leave it blank.
     */
    sendid?: string;
    /**
     * This is a URI, equivalent to the 'target' attribute on the <send> element.
     * For external events, the SCXML Processor should set this field to a value which,
     * when used as the value of 'target', will allow the receiver of the event to <send>
     * a response back to the originating entity via the Event I/O Processor specified in 'origintype'.
     * For internal and platform events, the Processor must leave this field blank.
     */
    origin?: ActorRef<any>;
    /**
     * This is equivalent to the 'type' field on the <send> element.
     * For external events, the SCXML Processor should set this field to a value which,
     * when used as the value of 'type', will allow the receiver of the event to <send>
     * a response back to the originating entity at the URI specified by 'origin'.
     * For internal and platform events, the Processor must leave this field blank.
     */
    origintype?: string;
    /**
     * If this event is generated from an invoked child process, the SCXML Processor
     * must set this field to the invoke id of the invocation that triggered the child process.
     * Otherwise it must leave it blank.
     */
    invokeid?: string;
    /**
     * This field contains whatever data the sending entity chose to include in this event.
     * The receiving SCXML Processor should reformat this data to match its data model,
     * but must not otherwise modify it.
     *
     * If the conversion is not possible, the Processor must leave the field blank
     * and must place an error 'error.execution' in the internal event queue.
     */
    data: TEvent;
    /**
     * @private
     */
    $$type: 'scxml';
  }
}

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

// TODO: should only take in behaviors
export type Spawnable =
  | AnyStateMachine
  | PromiseLike<any>
  | InvokeCallback
  | InteropObservable<any>
  | Subscribable<any>
  | ActorBehavior<any, any>;

export type ExtractEvent<
  TEvent extends EventObject,
  TEventType extends TEvent['type']
> = TEvent extends any
  ? TEventType extends TEvent['type']
    ? TEvent
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
  send: (event: TEvent) => void;
  // TODO: should this be optional?
  start?: () => void;
  getSnapshot: () => TSnapshot | undefined;
  getPersistedState?: () => any;
  stop?: () => void;
  toJSON?: () => any;
  // TODO: figure out how to hide this externally as `sendTo(ctx => ctx.actorRef._parent._parent._parent._parent)` shouldn't be allowed
  _parent?: ActorRef<any, any>;
  status: ActorStatus;
}

export type AnyActorRef = ActorRef<any, any>;

export type ActorRefFrom<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends StateMachine<
      infer TContext,
      infer TEvent,
      any,
      any,
      infer TResolvedTypesMeta
    >
    ? ActorRef<
        TEvent,
        State<
          TContext,
          TEvent,
          AreAllImplementationsAssumedToBeProvided<TResolvedTypesMeta> extends false
            ? MarkAllImplementationsAsProvided<TResolvedTypesMeta>
            : TResolvedTypesMeta
        >
      >
    : R extends Promise<infer U>
    ? ActorRef<{ type: string }, U | undefined>
    : R extends ActorBehavior<infer TEvent, infer TSnapshot>
    ? ActorRef<TEvent, TSnapshot>
    : never
  : never;

export type DevToolsAdapter = (service: AnyInterpreter) => void;

export type InterpreterFrom<
  T extends AnyStateMachine | ((...args: any[]) => AnyStateMachine)
> = ReturnTypeOrValue<T> extends StateMachine<
  infer TContext,
  infer TEvent,
  any,
  any,
  infer TResolvedTypesMeta
>
  ? Interpreter<
      ActorBehavior<
        TEvent,
        State<TContext, TEvent, TResolvedTypesMeta>,
        State<TContext, TEvent, TResolvedTypesMeta>,
        PersistedMachineState<State<TContext, TEvent, TResolvedTypesMeta>>
      >
    >
  : never;

export type MachineImplementationsFrom<
  T extends AnyStateMachine | ((...args: any[]) => AnyStateMachine),
  TRequireMissingImplementations extends boolean = false
> = ReturnTypeOrValue<T> extends StateMachine<
  infer TContext,
  infer TEvent,
  any,
  any,
  infer TResolvedTypesMeta
>
  ? InternalMachineImplementations<
      TContext,
      TEvent,
      TResolvedTypesMeta,
      TRequireMissingImplementations
    >
  : never;

// only meant to be used internally for debugging purposes
export type __ResolvedTypesMetaFrom<T> = T extends StateMachine<
  any,
  any,
  any,
  infer TResolvedTypesMeta
>
  ? TResolvedTypesMeta
  : never;

export type EventOfMachine<
  TMachine extends AnyStateMachine
> = TMachine extends StateMachine<any, infer E, any, any, any> ? E : never;

export interface ActorContext<TEvent extends EventObject, TSnapshot> {
  self: ActorRef<TEvent, TSnapshot>;
  id: string;
  sessionId: string;
  logger: (...args: any[]) => void;
  defer: (fn: () => void) => void;
}

export interface ActorBehavior<
  TEvent extends EventObject,
  TSnapshot = any,
  TInternalState = any,
  TPersisted = TInternalState
> {
  transition: (
    state: TInternalState,
    message: TEvent | LifecycleSignal,
    ctx: ActorContext<TEvent, TSnapshot>
  ) => TInternalState;
  getInitialState: (
    actorCtx: ActorContext<TEvent, TSnapshot>,
    input?: any
  ) => TInternalState;
  restoreState?: (
    restoredState: any,
    actorCtx: ActorContext<TEvent, TSnapshot>
  ) => TInternalState;
  getSnapshot?: (state: TInternalState) => TSnapshot;
  getStatus?: (state: TInternalState) => { status: string; data?: any };
  start?: (
    state: TInternalState,
    actorCtx: ActorContext<TEvent, TSnapshot>
  ) => TInternalState;
  /**
   * @returns Persisted state
   */
  getPersistedState?: (state: TInternalState) => TPersisted;
}

export type AnyActorBehavior = ActorBehavior<any, any, any, any>;

export type SnapshotFrom<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends ActorRef<infer _, infer TSnapshot>
    ? TSnapshot
    : R extends Interpreter<infer TBehavior>
    ? SnapshotFrom<TBehavior>
    : R extends ActorBehavior<infer _, infer TSnapshot>
    ? TSnapshot
    : R extends ActorContext<infer _, infer TSnapshot>
    ? TSnapshot
    : never
  : never;

export type EventFromBehavior<
  TBehavior extends ActorBehavior<any, any>
> = TBehavior extends ActorBehavior<infer TEvent, infer _> ? TEvent : never;

export type PersistedFrom<
  TBehavior extends ActorBehavior<any, any>
> = TBehavior extends ActorBehavior<
  infer _TEvent,
  infer _TSnapshot,
  infer _TInternalState,
  infer TPersisted
>
  ? TPersisted
  : never;

type ResolveEventType<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends StateMachine<
      infer _,
      infer TEvent,
      infer __,
      infer ___,
      infer ____
    >
    ? TEvent
    : R extends State<infer _, infer TEvent, infer __>
    ? TEvent
    : // TODO: the special case for Interpreter shouldn't be needed here as it implements ActorRef
    // however to drop it we'd have to remove ` | SCXML.Event<TEvent>` from its `send`'s accepted parameter
    R extends Interpreter<infer _, infer TEvent>
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
      infer _,
      infer __,
      infer ___,
      infer ____
    >
    ? TContext
    : R extends State<infer TContext, infer _, infer __>
    ? TContext
    : R extends Interpreter<infer TBehavior>
    ? TBehavior extends StateMachine<infer TContext, infer _>
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

export type StateFromMachine<
  TMachine extends AnyStateMachine
> = TMachine['initialState'];

export interface PersistedMachineState<TState extends AnyState> {
  [key: string]: any;
  children: {
    [key in keyof TState['children']]: any;
  };
  persisted: true;
}

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };
