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

export interface ParameterizedObject {
  type: string;
  params?: Record<string, any>;
}

export interface UnifiedArg<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  context: TContext;
  event: TEvent;
  self: ActorRef<TEvent>;
  system: ActorSystem<any>;
}

export type MachineContext = Record<string, any>;

export interface ActionArgs<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends ParameterizedObject = ParameterizedObject
> extends UnifiedArg<TContext, TEvent> {
  action: TAction;
}

export type InputFrom<T extends AnyActorLogic> = T extends StateMachine<
  infer _TContext,
  infer _TEvent,
  infer _TActions,
  infer _TActors,
  infer TInput,
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
  TExpressionEvent extends EventObject
> extends ActionArgs<TContext, TExpressionEvent> {
  spawn: Spawner;
}

export type ActionFunction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TAction extends ParameterizedObject = ParameterizedObject
> = {
  (args: ActionArgs<TContext, TExpressionEvent, TAction>): void;
  _out_TEvent?: TEvent;
};

export interface ChooseBranch<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
> {
  guard?: GuardConfig<TContext, TExpressionEvent>;
  actions: Actions<TContext, TExpressionEvent, TEvent>;
}

export type Action<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
> =
  | ActionType
  | ParameterizedObject
  | ActionFunction<TContext, TExpressionEvent, TEvent, ParameterizedObject>;

export type Actions<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
> = SingleOrArray<Action<TContext, TExpressionEvent, TEvent>>;

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
  args: {
    context: TContext;
    event: TEvent;
  } & GuardArgs<TContext, TEvent>
) => boolean;

export interface DefaultGuardObject<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends ParameterizedObject {
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
  event: TEvent,
  state: State<TContext, TEvent, TODO, TODO>
) => boolean;

export interface GuardArgs<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  state: State<TContext, TEvent, TODO, TODO>;
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
> extends ParameterizedObject {
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
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent,
  TAction extends ParameterizedObject = ParameterizedObject
> {
  guard?: GuardConfig<TContext, TExpressionEvent>;
  actions?: Actions<TContext, TExpressionEvent, TEvent>;
  reenter?: boolean;
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

export interface InvokeMeta {
  src: string;
  meta: MetaObject | undefined;
}

export interface InvokeDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
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
        delay:
          | number
          | string
          | ((args: UnifiedArg<TContext, TEvent>) => number);
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
  TAction extends ParameterizedObject,
  TActor extends ProvidedActor,
  TOutput
> = {
  [K in string]: StateNodeConfig<TContext, TEvent, TAction, TActor, TOutput>;
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
  TEvent extends EventObject = TExpressionEvent
> = SingleOrArray<
  TransitionConfigTarget | TransitionConfig<TContext, TExpressionEvent, TEvent>
>;

export type TransitionsConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  // TODO: this doesn't support partial descriptors
  [K in TEvent['type'] | '*']?: K extends '*'
    ? TransitionConfigOrTarget<TContext, TEvent>
    : TransitionConfigOrTarget<TContext, ExtractEvent<TEvent, K>, TEvent>;
};

type IsLiteralString<T extends string> = string extends T ? false : true;

type DistributeActors<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor
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
                TEvent
              >
            >;
        /**
         * The transition to take upon the invoked child machine sending an error event.
         */
        onError?:
          | string
          | SingleOrArray<
              TransitionConfigOrTarget<TContext, ErrorEvent<any>, TEvent>
            >;

        onSnapshot?:
          | string
          | SingleOrArray<
              TransitionConfigOrTarget<TContext, SnapshotEvent<any>, TEvent>
            >;
        /**
         * Meta data related to this invocation
         */
        meta?: MetaObject;
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
  TActor extends ProvidedActor
> = IsLiteralString<TActor['src']> extends true
  ? DistributeActors<TContext, TEvent, TActor>
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
            TransitionConfigOrTarget<TContext, DoneInvokeEvent<any>, TEvent>
          >;
      /**
       * The transition to take upon the invoked child machine sending an error event.
       */
      onError?:
        | string
        | SingleOrArray<
            TransitionConfigOrTarget<TContext, ErrorEvent<any>, TEvent>
          >;

      onSnapshot?:
        | string
        | SingleOrArray<
            TransitionConfigOrTarget<TContext, SnapshotEvent<any>, TEvent>
          >;
      /**
       * Meta data related to this invocation
       */
      meta?: MetaObject;
    };

export interface StateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends ParameterizedObject,
  TActor extends ProvidedActor,
  TOutput
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
  states?:
    | StatesConfig<TContext, TEvent, TAction, TActor, NonReducibleUnknown>
    | undefined;
  /**
   * The services to invoke upon entering this state node. These services will be stopped upon exiting this state node.
   */
  invoke?: SingleOrArray<
    TActor['src'] | InvokeConfig<TContext, TEvent, TActor>
  >;
  /**
   * The mapping of event types to their potential transition(s).
   */
  on?: TransitionsConfig<TContext, TEvent>;
  /**
   * The action(s) to be executed upon entering the state node.
   */
  entry?: Actions<TContext, TEvent, TEvent>;
  /**
   * The action(s) to be executed upon exiting the state node.
   */
  exit?: Actions<TContext, TEvent, TEvent>;
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
  // TODO: establish what a definition really is
  entry: Action<any, any, any>[];
  exit: Action<any, any, any>[];
  meta: any;
  order: number;
  output?: FinalStateNodeConfig<TContext, TEvent>['output'];
  invoke: Array<InvokeDefinition<TContext, TEvent>>;
  description?: string;
  tags: string[];
}

export interface StateMachineDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends StateNodeDefinition<TContext, TEvent> {}

export type AnyStateNode = StateNode<any, any>;

export type AnyStateNodeDefinition = StateNodeDefinition<any, any>;

export type AnyState = State<any, any, any, any, any>;

export type AnyStateMachine = StateMachine<any, any, any, any, any, any, any>;

export type AnyStateConfig = StateConfig<any, AnyEventObject>;

export interface AtomicStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends StateNodeConfig<TContext, TEvent, TODO, TODO, TODO> {
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
  | StateNodeConfig<TContext, TEvent, TODO, TODO, TODO>;

export type ActionFunctionMap<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends ParameterizedObject = ParameterizedObject
> = {
  [K in TAction['type']]?: ActionFunction<
    TContext,
    TEvent,
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
  TAction extends ParameterizedObject = ParameterizedObject
> {
  guards: Record<string, GuardPredicate<TContext, TEvent>>;
  actions: ActionFunctionMap<TContext, TEvent, TAction>;
  actors: Record<
    string,
    | AnyActorLogic
    | { src: AnyActorLogic; input: Mapper<TContext, TEvent, any> | any }
  >;
  delays: DelayFunctionMap<TContext, TEvent>;
}

type MachineImplementationsActions<
  TContext extends MachineContext,
  TResolvedTypesMeta,
  TEventsCausingActions = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'eventsCausingActions'
  >,
  TIndexedEvents = Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'indexedEvents'>
> = {
  [K in keyof TEventsCausingActions]?: ActionFunction<
    TContext,
    Cast<Prop<TIndexedEvents, TEventsCausingActions[K]>, EventObject>,
    Cast<Prop<TIndexedEvents, keyof TIndexedEvents>, EventObject>,
    ParameterizedObject // TODO: when bringing back parametrized actions this should accept something like `Cast<Prop<TIndexedActions, K>, ParameterizedObject>`
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
              Cast<
                Prop<
                  TIndexedEvents,
                  K extends keyof TEventsCausingActors
                    ? TEventsCausingActors[K]
                    : TIndexedEvents[keyof TIndexedEvents]
                >,
                EventObject
              >,
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
  [K in keyof TEventsCausingGuards]?:
    | GuardPredicate<
        TContext,
        Cast<Prop<TIndexedEvents, TEventsCausingGuards[K]>, EventObject>
      >
    | GuardConfig<
        TContext,
        Cast<Prop<TIndexedEvents, TEventsCausingGuards[K]>, EventObject>
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
  _TAction extends ParameterizedObject,
  TActor extends ProvidedActor,
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
  TAction extends ParameterizedObject = ParameterizedObject,
  TActor extends ProvidedActor = ProvidedActor,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
> = InternalMachineImplementations<
  TContext,
  TEvent,
  TAction,
  TActor,
  ResolveTypegenMeta<TTypesMeta, TEvent, TAction, TActor>
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
  TAction extends ParameterizedObject,
  TActor extends ProvidedActor,
  TOutput
> = Omit<
  StateNodeConfig<TContext, TEvent, TAction, TActor, TOutput>,
  'states'
> & {
  states?: StatesConfig<TContext, TEvent, TAction, TActor, TOutput> | undefined;
};

export type MachineConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends ParameterizedObject = ParameterizedObject,
  TActor extends ProvidedActor = ProvidedActor,
  TInput = any,
  TOutput = unknown,
  TTypesMeta = TypegenDisabled
> = (RootStateNodeConfig<
  NoInfer<TContext>,
  NoInfer<TEvent>,
  NoInfer<TAction>,
  NoInfer<TActor>,
  NoInfer<TOutput>
> & {
  /**
   * The initial context (extended state)
   */
  /**
   * The machine's own version.
   */
  version?: string;
  types?: MachineTypes<TContext, TEvent, TActor, TInput, TOutput, TTypesMeta>;
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
  TInput,
  TOutput,
  TTypesMeta = TypegenDisabled
> {
  context?: TContext;
  actions?: { type: string; [key: string]: any };
  actors?: TActor;
  events?: TEvent;
  guards?: { type: string; [key: string]: any };
  typegen?: TTypesMeta;
  input?: TInput;
  output?: TOutput;
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

export enum ConstantPrefix {
  After = 'xstate.after',
  DoneState = 'done.state',
  DoneInvoke = 'done.invoke',
  ErrorExecution = 'error.execution',
  ErrorCommunication = 'error.communication',
  ErrorPlatform = 'error.platform',
  ErrorCustom = 'xstate.error'
}

export interface DoneInvokeEvent<TOutput> {
  type: `done.invoke.${string}`;
  output: TOutput;
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
  type: ConstantPrefix.ErrorExecution;
  data: any;
}

export interface ErrorPlatformEvent extends EventObject {
  data: any;
}

export interface DoneEventObject extends EventObject {
  output?: any;
  toString(): string;
}

export type DoneEvent = DoneEventObject & string;

export type DelayExpr<
  TContext extends MachineContext,
  TEvent extends EventObject
> = (args: UnifiedArg<TContext, TEvent>) => number;

export type LogExpr<
  TContext extends MachineContext,
  TEvent extends EventObject
> = (args: UnifiedArg<TContext, TEvent>) => unknown;

export type SendExpr<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TSentEvent extends EventObject = AnyEventObject
> = (args: UnifiedArg<TContext, TExpressionEvent>) => TSentEvent;

export enum SpecialTargets {
  Parent = '#_parent',
  Internal = '#_internal'
}

export interface SendToActionOptions<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends RaiseActionOptions<TContext, TEvent> {}

export interface RaiseActionOptions<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  id?: string;
  delay?: number | string | DelayExpr<TContext, TEvent>;
}

export interface RaiseActionParams<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> extends RaiseActionOptions<TContext, TExpressionEvent> {
  event: TEvent | SendExpr<TContext, TExpressionEvent, TEvent>;
}

export interface SendToActionParams<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject = EventObject
> extends SendToActionOptions<TContext, TEvent> {
  event: TSentEvent | SendExpr<TContext, TEvent, TSentEvent>;
}

export type Assigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
> = (args: AssignArgs<TContext, TExpressionEvent>) => Partial<TContext>;

export type PartialAssigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TKey extends keyof TContext
> = (args: AssignArgs<TContext, TExpressionEvent>) => TContext[TKey];

export type PropertyAssigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
> = {
  [K in keyof TContext]?:
    | PartialAssigner<TContext, TExpressionEvent, K>
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
> extends Omit<TransitionConfig<TContext, TEvent>, 'target'> {
  target: Array<StateNode<TContext, TEvent>> | undefined;
  source: StateNode<TContext, TEvent>;
  actions: Action<any, any, any>[];
  reenter: boolean;
  guard?: GuardDefinition<TContext, TEvent>;
  eventType: TEvent['type'] | '*';
  toJSON: () => {
    target: string[] | undefined;
    source: string;
    actions: Action<any, any, any>[];
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
  state: State<TContext, TEvent, TODO, TODO>;
  /**
   * Event from state.
   */
  event: TEvent;
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
  machine?: StateMachine<TContext, TEvent, any, any, any, any>;
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

export interface ActorRef<
  TEvent extends EventObject,
  TSnapshot = any,
  TOutput = unknown
> extends Subscribable<TSnapshot>,
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
  getOutput: () => TOutput | undefined;
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
  ? R extends StateMachine<any, any, any, any, any, any>
    ? R
    : R extends Promise<infer U>
    ? PromiseActorLogic<U>
    : never
  : never;

export type ActorRefFrom<T> = ReturnTypeOrValue<T> extends infer R
  ? R extends StateMachine<
      infer TContext,
      infer TEvent,
      infer _TAction,
      infer TActor,
      infer _Tinput,
      infer TOutput,
      infer TResolvedTypesMeta
    >
    ? ActorRef<
        TEvent,
        State<
          TContext,
          TEvent,
          TActor,
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
  infer _TAction,
  infer TActor,
  infer TInput,
  infer TResolvedTypesMeta
>
  ? Actor<
      ActorLogic<
        TEvent,
        State<TContext, TEvent, TActor, TResolvedTypesMeta>,
        State<TContext, TEvent, TActor, TResolvedTypesMeta>,
        PersistedMachineState<
          State<TContext, TEvent, TActor, TResolvedTypesMeta>
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
  infer TAction,
  infer TActor,
  infer _TInput,
  infer _TOutput,
  infer TResolvedTypesMeta
>
  ? InternalMachineImplementations<
      TContext,
      TEvent,
      TAction,
      TActor,
      TResolvedTypesMeta,
      TRequireMissingImplementations
    >
  : never;

// only meant to be used internally for debugging purposes
export type __ResolvedTypesMetaFrom<T> = T extends StateMachine<
  any,
  any,
  any,
  any,
  any,
  infer TResolvedTypesMeta
>
  ? TResolvedTypesMeta
  : never;

export type EventOfMachine<TMachine extends AnyStateMachine> =
  TMachine extends StateMachine<any, infer E, any, any, any, any> ? E : never;

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
  getOutput: (state: TInternalState) => TOutput | undefined; // undefined if no output yet
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
        infer _,
        infer __,
        infer ___,
        infer ____,
        infer _____,
        infer ______,
        infer _______
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
      infer _TAction,
      infer _TActor,
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
      infer _,
      infer __,
      infer ___,
      infer ____,
      infer _____,
      infer ______
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
        infer _TAction,
        infer _TActor,
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
