import type { MachineSnapshot } from './State.ts';
import type { StateMachine } from './StateMachine.ts';
import type { StateNode } from './StateNode.ts';
import { PromiseActorLogic } from './actors/promise.ts';
import type { Actor, ProcessingStatus } from './createActor.ts';
import { InspectionEvent } from './inspection.ts';
import { Spawner } from './spawn.ts';
import { AnyActorSystem, Clock } from './system.ts';

// this is needed to make JSDoc `@link` work properly
import type { SimulatedClock } from './SimulatedClock.ts';
import { Implementations, Next_StateNodeConfig } from './types.v6.ts';
import { StandardSchemaV1 } from './schema.types.ts';
import { builtInActions } from './actions.ts';

export type Identity<T> = { [K in keyof T]: T[K] };

export type HomomorphicPick<T, K extends keyof any> = {
  [P in keyof T as P & K]: T[P];
};
export type HomomorphicOmit<T, K extends keyof any> = {
  [P in keyof T as Exclude<P, K>]: T[P];
};

export type Invert<T extends Record<PropertyKey, PropertyKey>> = {
  [K in keyof T as T[K]]: K;
};

export type GetParameterizedParams<T extends ParameterizedObject | undefined> =
  T extends any ? ('params' extends keyof T ? T['params'] : undefined) : never;

/**
 * @remarks
 * `T | unknown` reduces to `unknown` and that can be problematic when it comes
 * to contextual typing. It especially is a problem when the union has a
 * function member, like here:
 *
 * ```ts
 * declare function test(
 *   cbOrVal: ((arg: number) => unknown) | unknown
 * ): void;
 * test((arg) => {}); // oops, implicit any
 * ```
 *
 * This type can be used to avoid this problem. This union represents the same
 * value space as `unknown`.
 */
export type NonReducibleUnknown = {} | null | undefined;
export type AnyFunction = (...args: any[]) => any;

type ReturnTypeOrValue<T> = T extends AnyFunction ? ReturnType<T> : T;

// https://github.com/microsoft/TypeScript/issues/23182#issuecomment-379091887
export type IsNever<T> = [T] extends [never] ? true : false;
export type IsNotNever<T> = [T] extends [never] ? false : true;

export type Compute<A> = { [K in keyof A]: A[K] } & unknown;
export type Prop<T, K> = K extends keyof T ? T[K] : never;
export type Values<T> = T[keyof T];
export type Elements<T> = T[keyof T & `${number}`];
export type Merge<M, N> = Omit<M, keyof N> & N;
export type IndexByProp<T extends Record<P, string>, P extends keyof T> = {
  [E in T as E[P]]: E;
};

export type IndexByType<T extends { type: string }> = IndexByProp<T, 'type'>;

export type IsEmptyObject<T> = keyof T extends never ? true : false;

export type Equals<A1, A2> =
  (<A>() => A extends A2 ? true : false) extends <A>() => A extends A1
    ? true
    : false
    ? true
    : false;
export type IsAny<T> = Equals<T, any>;
export type Cast<A, B> = A extends B ? A : B;
// @TODO: we can't use native `NoInfer` as we need those:
// https://github.com/microsoft/TypeScript/pull/61092
// https://github.com/microsoft/TypeScript/pull/61077
// but even with those fixes native NoInfer still doesn't work - further issues have to be reproduced and fixed
export type DoNotInfer<T> = [T][T extends any ? 0 : any];
/** @deprecated Use the built-in `NoInfer` type instead */
export type NoInfer<T> = DoNotInfer<T>;
export type LowInfer<T> = T & NonNullable<unknown>;

export type MetaObject = Record<string, any>;

export type Lazy<T> = () => T;
export type MaybeLazy<T> = T | Lazy<T>;

/** The full definition of an event, with a string `type`. */
export type EventObject = {
  /** The type of event that is sent. */
  type: string;
};

export interface AnyEventObject extends EventObject {
  [key: string]: any;
}

export interface ParameterizedObject {
  type: string;
  params?: NonReducibleUnknown;
}

export interface UnifiedArg<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> {
  context: TContext;
  event: TExpressionEvent;
  self: ActorRef<
    MachineSnapshot<
      TContext,
      TEvent,
      Record<string, AnyActorRef | undefined>, // TODO: this should be replaced with `TChildren`
      StateValue,
      string,
      unknown,
      TODO, // TMeta
      TODO // State schema
    >,
    TEvent,
    AnyEventObject
  >;
  system: AnyActorSystem;
}

export type MachineContext = Record<string, any>;

export interface ActionArgs<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> extends UnifiedArg<TContext, TExpressionEvent, TEvent> {
  children: Record<string, AnyActorRef>;
}

export type InputFrom<T> =
  T extends StateMachine<
    infer _TContext,
    infer _TEvent,
    infer _TChildren,
    infer _TStateValue,
    infer _TTag,
    infer TInput,
    infer _TOutput,
    infer _TEmitted,
    infer _TMeta,
    infer _TStateSchema,
    infer _TActionMap,
    infer _TActorMap,
    infer _TGuardMap,
    infer _TDelayMap
  >
    ? TInput
    : T extends ActorLogic<
          infer _TSnapshot,
          infer _TEvent,
          infer TInput,
          infer _TSystem,
          infer _TEmitted
        >
      ? TInput
      : never;

export type OutputFrom<T> =
  T extends ActorLogic<
    infer TSnapshot,
    infer _TEvent,
    infer _TInput,
    infer _TSystem,
    infer _TEmitted
  >
    ? (TSnapshot & { status: 'done' })['output']
    : T extends ActorRef<infer TSnapshot, infer _TEvent, infer _TEmitted>
      ? (TSnapshot & { status: 'done' })['output']
      : never;

export type NoRequiredParams<T extends ParameterizedObject> = T extends any
  ? undefined extends T['params']
    ? T['type']
    : never
  : never;

export type ConditionalRequired<
  T,
  Condition extends boolean
> = Condition extends true ? Required<T> : T;

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

export type StateKey = string | AnyMachineSnapshot;

export interface StateValueMap {
  [key: string]: StateValue | undefined;
}

/**
 * The string or object representing the state value relative to the parent
 * state node.
 *
 * @remarks
 * - For a child atomic state node, this is a string, e.g., `"pending"`.
 * - For complex state nodes, this is an object, e.g., `{ success:
 *   "someChildState" }`.
 */
export type StateValue = string | StateValueMap;

export type TransitionTarget = SingleOrArray<string>;

export interface TransitionConfig<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> {
  actions?: never;
  reenter?: boolean;
  target?: TransitionTarget | undefined;
  to?: TransitionConfigFunction<
    TContext,
    TExpressionEvent,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TMeta
  >;
  meta?: TMeta;
  description?: string;
}

export interface InitialTransitionConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> extends TransitionConfig<
    TContext,
    TEvent,
    TEvent,
    TEmitted,
    TMeta,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
  > {
  target: string;
}

export type AnyTransitionConfig = TransitionConfig<
  any, // TContext
  any, // TExpressionEvent
  any, // TEvent
  any, // TEmitted
  any, // TMeta
  any, // TActionMap
  any, // TActorMap
  any, // TGuardMap
  any // TDelayMap
>;

export interface InvokeDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> {
  id: string;

  systemId: string | undefined;

  logic:
    | AnyActorLogic
    | (({
        actors,
        context,
        event,
        self
      }: {
        actors: TActorMap;
        context: TContext;
        event: TEvent;
        self: AnyActorRef;
      }) => AnyActorLogic);
  /** The source of the actor logic to be invoked */
  src: AnyActorLogic | string;

  input?:
    | Mapper<TContext, TEvent, NonReducibleUnknown, TEvent>
    | NonReducibleUnknown;
  /**
   * The transition to take upon the invoked child machine reaching its final
   * top-level state.
   */
  onDone?:
    | string
    | SingleOrArray<
        TransitionConfig<
          TContext,
          DoneActorEvent<unknown>,
          TEvent,
          TEmitted,
          TMeta,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap
        >
      >;
  /**
   * The transition to take upon the invoked child machine sending an error
   * event.
   */
  onError?:
    | string
    | SingleOrArray<
        TransitionConfig<
          TContext,
          ErrorActorEvent,
          TEvent,
          TEmitted,
          TMeta,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap
        >
      >;

  onSnapshot?:
    | string
    | SingleOrArray<
        TransitionConfig<
          TContext,
          SnapshotEvent,
          TEvent,
          TEmitted,
          TMeta,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap
        >
      >;
}

export type AnyInvokeDefinition = InvokeDefinition<
  MachineContext,
  EventObject,
  EventObject,
  MetaObject,
  Implementations['actions'],
  Implementations['actors'],
  Implementations['guards'],
  Implementations['delays']
>;

type Delay<TDelay extends string> = TDelay | number;

export type DelayedTransitions<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> = {
  [K in Delay<keyof TDelayMap & string>]?:
    | string
    | SingleOrArray<
        TransitionConfig<
          TContext,
          TEvent,
          TEvent,
          TEmitted,
          TMeta,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap
        >
      >
    | TransitionConfigFunction<
        TContext,
        TEvent,
        TEvent,
        TODO,
        any,
        any,
        any,
        any,
        any
      >;
};

export type StateTypes =
  | 'atomic'
  | 'compound'
  | 'parallel'
  | 'final'
  | 'history'
  | ({} & string);

export type SingleOrArray<T> = readonly T[] | T;

export type StateNodesConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in string]: StateNode<TContext, TEvent>;
};

export type TransitionConfigTarget = string | undefined;

export type TransitionConfigOrTarget<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> = SingleOrArray<
  | TransitionConfigTarget
  | TransitionConfig<
      TContext,
      TExpressionEvent,
      TEvent,
      TEmitted,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap
    >
  | TransitionConfigFunction<
      TContext,
      TExpressionEvent,
      TEvent,
      TEmitted,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TMeta
    >
>;

export type TransitionConfigFunction<
  TContext extends MachineContext,
  TCurrentEvent extends EventObject,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject
> = (
  {
    context,
    event,
    self,
    parent,
    value,
    children,
    actions
  }: {
    context: TContext;
    event: TCurrentEvent;
    self: ActorRef<
      MachineSnapshot<TContext, TEvent, TODO, TODO, TODO, TODO, TODO, TODO>,
      TEvent
    >;
    parent: UnknownActorRef | undefined;
    value: StateValue;
    children: Record<string, AnyActorRef>;
    actions: TActionMap;
    actors: TActorMap;
    guards: TGuardMap;
    delays: TDelayMap;
  },
  enq: EnqueueObject<TEvent, TEmitted>
) => {
  target?: string | string[];
  // target?: keyof TSS['states'];
  context?: TContext;
  reenter?: boolean;
  meta?: TMeta;
} | void;

export type AnyTransitionConfigFunction = TransitionConfigFunction<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

export type TransitionsConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> = {
  [K in EventDescriptor<TEvent>]?: TransitionConfigOrTarget<
    TContext,
    ExtractEvent<TEvent, K>,
    TEvent,
    TEmitted,
    TMeta,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
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
  _TActor extends ProvidedActor,
  _TAction extends ParameterizedObject,
  _TGuard extends ParameterizedObject,
  _TDelay extends string,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TSpecificActor extends ProvidedActor
> = TSpecificActor extends { src: infer TSrc }
  ?
      | Compute<
          {
            systemId?: string;
            /** The source of the machine to be invoked, or the machine itself. */
            src: TSrc;

            /**
             * The unique identifier for the invoked machine. If not specified,
             * this will be the machine's own `id`, or the URL (from `src`).
             */
            id?: TSpecificActor['id'];

            // TODO: currently we do not enforce required inputs here
            // in a sense, we shouldn't - they could be provided within the `implementations` object
            // how do we verify if the required input has been provided?
            input?:
              | Mapper<
                  TContext,
                  TEvent,
                  InputFrom<TSpecificActor['logic']>,
                  TEvent
                >
              | InputFrom<TSpecificActor['logic']>;
            /**
             * The transition to take upon the invoked child machine reaching
             * its final top-level state.
             */
            onDone?:
              | string
              | SingleOrArray<
                  TransitionConfigOrTarget<
                    TContext,
                    DoneActorEvent<OutputFrom<TSpecificActor['logic']>>,
                    TEvent,
                    TEmitted,
                    TMeta,
                    any,
                    any,
                    any,
                    any
                  >
                >;
            /**
             * The transition to take upon the invoked child machine sending an
             * error event.
             */
            onError?:
              | string
              | SingleOrArray<
                  TransitionConfigOrTarget<
                    TContext,
                    ErrorActorEvent,
                    TEvent,
                    TEmitted,
                    TMeta,
                    any,
                    any,
                    any,
                    any
                  >
                >;

            onSnapshot?:
              | string
              | SingleOrArray<
                  TransitionConfigOrTarget<
                    TContext,
                    SnapshotEvent<SnapshotFrom<TSpecificActor['logic']>>,
                    TEvent,
                    TEmitted,
                    TMeta,
                    any,
                    any,
                    any,
                    any
                  >
                >;
          } & { [K in RequiredActorOptions<TSpecificActor>]: unknown }
        >
      | {
          id?: never;
          systemId?: string;
          src: AnyActorLogic;
          input?:
            | Mapper<TContext, TEvent, NonReducibleUnknown, TEvent>
            | NonReducibleUnknown;
          onDone?:
            | string
            | SingleOrArray<
                TransitionConfigOrTarget<
                  TContext,
                  DoneActorEvent<unknown>,
                  TEvent,
                  TEmitted,
                  TMeta,
                  any,
                  any,
                  any,
                  any
                >
              >;
          onError?:
            | string
            | SingleOrArray<
                TransitionConfigOrTarget<
                  TContext,
                  ErrorActorEvent,
                  TEvent,
                  TEmitted,
                  TMeta,
                  any,
                  any,
                  any,
                  any
                >
              >;

          onSnapshot?:
            | string
            | SingleOrArray<
                TransitionConfigOrTarget<
                  TContext,
                  SnapshotEvent,
                  TEvent,
                  TEmitted,
                  TMeta,
                  any,
                  any,
                  any,
                  any
                >
              >;
        }
  : never;

export type InvokeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TEmitted extends EventObject,
  TMeta extends MetaObject
> =
  IsLiteralString<TActor['src']> extends true
    ? DistributeActors<
        TContext,
        TEvent,
        TActor,
        TAction,
        TGuard,
        TDelay,
        TEmitted,
        TMeta,
        TActor
      >
    : {
        /**
         * The unique identifier for the invoked machine. If not specified, this
         * will be the machine's own `id`, or the URL (from `src`).
         */
        id?: string;

        systemId?: string;
        /** The source of the machine to be invoked, or the machine itself. */
        src: AnyActorLogic | string; // TODO: fix types

        input?:
          | Mapper<TContext, TEvent, NonReducibleUnknown, TEvent>
          | NonReducibleUnknown;
        /**
         * The transition to take upon the invoked child machine reaching its
         * final top-level state.
         */
        onDone?:
          | string
          | SingleOrArray<
              TransitionConfigOrTarget<
                TContext,
                DoneActorEvent<any>, // TODO: consider replacing with `unknown`
                TEvent,
                TEmitted,
                TMeta,
                any,
                any,
                any,
                any
              >
            >;
        /**
         * The transition to take upon the invoked child machine sending an
         * error event.
         */
        onError?:
          | string
          | SingleOrArray<
              TransitionConfigOrTarget<
                TContext,
                ErrorActorEvent,
                TEvent,
                TEmitted,
                TMeta,
                any,
                any,
                any,
                any
              >
            >;

        onSnapshot?:
          | string
          | SingleOrArray<
              TransitionConfigOrTarget<
                TContext,
                SnapshotEvent,
                TEvent,
                TEmitted,
                TMeta,
                any,
                any,
                any,
                any
              >
            >;
      };

export type AnyInvokeConfig = InvokeConfig<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any // TMeta
>;

export type AnyStateNodeConfig = Next_StateNodeConfig<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

// Accept any StateNode instance regardless of generic parameters
// Using a union type to handle variance issues with machine.resolveState
export type AnyStateNode =
  | StateNode<any, any>
  | StateNode<never, EventObject>
  | StateNode<any, EventObject>
  | StateNode<never, any>;

export type AnyMachineSnapshot = MachineSnapshot<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

export type AnyStateMachine = StateMachine<
  any, // context
  any, // event
  any, // children
  any, // state value
  any, // tag
  any, // input
  any, // output
  any, // emitted
  any, // TMeta
  any, // TStateSchema,
  any, // TActionMap,
  any, // TActorMap
  any, // TGuardMap
  any // TDelayMap
>;

export type AnyStateConfig = StateConfig<any, AnyEventObject>;

export type DelayConfig<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
> = number | DelayExpr<TContext, TExpressionEvent>;

export type InitialContext<
  TContext extends MachineContext,
  TActorMap extends Implementations['actors'],
  TInput,
  TEvent extends EventObject
> = TContext | ContextFactory<TContext, TActorMap, TInput, TEvent>;

export type ContextFactory<
  TContext extends MachineContext,
  TActorMap extends Implementations['actors'],
  TInput,
  TEvent extends EventObject = EventObject
> = ({
  spawn,
  actors,
  input,
  self
}: {
  spawn: Spawner;
  actors: TActorMap;
  input: TInput;
  self: ActorRef<
    MachineSnapshot<
      TContext,
      TEvent,
      Record<string, AnyActorRef | undefined>, // TODO: this should be replaced with `TChildren`
      StateValue,
      string,
      unknown,
      TODO, // TMeta
      TODO // State schema
    >,
    TEvent,
    AnyEventObject
  >;
}) => TContext;

export interface ProvidedActor {
  src: string;
  logic: UnknownActorLogic;
  id?: string | undefined; // `| undefined` is required here for compatibility with `exactOptionalPropertyTypes`, see #4613
}

export interface SetupTypes<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildrenMap extends Record<string, string>,
  TTag extends string,
  TInput,
  TOutput,
  TEmitted extends EventObject,
  TMeta extends MetaObject
> {
  context?: TContext;
  events?: TEvent;
  children?: TChildrenMap;
  tags?: TTag;
  input?: TInput;
  output?: TOutput;
  emitted?: TEmitted;
  meta?: TMeta;
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
  TEmitted extends EventObject,
  TMeta extends MetaObject
> extends SetupTypes<
    TContext,
    TEvent,
    // in machine types we currently don't support `TChildren`
    // and IDs can still be configured through `TActor['id']`
    never,
    TTag,
    TInput,
    TOutput,
    TEmitted,
    TMeta
  > {
  actors?: TActor;
  actions?: TAction;
  guards?: TGuard;
  delays?: TDelay;
  meta?: TMeta;
}

export interface HistoryStateNode<TContext extends MachineContext>
  extends StateNode<TContext> {
  history: 'shallow' | 'deep';
  target: string | undefined;
}

export type HistoryValue = Record<string, Array<AnyStateNode>>;

export type PersistedHistoryValue = Record<string, Array<{ id: string }>>;

export type AnyHistoryValue = HistoryValue;

export type StateFrom<
  T extends AnyStateMachine | ((...args: any[]) => AnyStateMachine)
> = T extends AnyStateMachine
  ? ReturnType<T['transition']>
  : T extends (...args: any[]) => AnyStateMachine
    ? ReturnType<ReturnType<T>['transition']>
    : never;

export interface DoneActorEvent<TOutput = unknown, TId extends string = string>
  extends EventObject {
  type: `xstate.done.actor.${TId}`;
  output: TOutput;
  actorId: TId;
}

export interface ErrorActorEvent<
  TErrorData = unknown,
  TId extends string = string
> extends EventObject {
  type: `xstate.error.actor.${TId}`;
  error: TErrorData;
  actorId: TId;
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

export enum SpecialTargets {
  Parent = '#_parent',
  Internal = '#_internal'
}

export type Mapper<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TResult,
  TEvent extends EventObject
> = (args: {
  context: TContext;
  event: TExpressionEvent;
  self: ActorRef<
    MachineSnapshot<
      TContext,
      TEvent,
      Record<string, AnyActorRef>, // TODO: this should be replaced with `TChildren`
      StateValue,
      string,
      unknown,
      TODO, // TMeta
      TODO // State schema
    >,
    TEvent,
    AnyEventObject
  >;
}) => TResult;

export interface TransitionDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends Omit<
    TransitionConfig<
      TContext,
      TEvent,
      TEvent,
      TODO,
      TODO,
      TODO,
      TODO,
      TODO, // TEmitted
      TODO // TMeta
    >,
    | 'target'
    // `guard` is correctly rejected by `extends` here and `actions` should be too
    // however, `any` passed to `TransitionConfig` as `TAction` collapses its `.actions` to `any` and it's accidentally allowed here
    // it doesn't exactly have to be incorrect, we are overriding this here anyway but it looks like a lucky accident rather than smth done on purpose
    | 'guard'
  > {
  target: ReadonlyArray<AnyStateNode> | undefined;
  source: AnyStateNode;
  reenter: boolean;
  eventType: EventDescriptor<TEvent>;
  params?:
    | Record<string, unknown>
    | ((args: { context: any; event: any }) => Record<string, unknown>);
}

export type AnyTransitionDefinition = TransitionDefinition<any, any>;

export type InitialTransitionDefinition = {
  source: AnyStateNode;
  target: AnyStateNode[] | undefined;
  params?:
    | Record<string, unknown>
    | ((args: {
        context: MachineContext;
        event: EventObject;
      }) => Record<string, unknown>);
};

export type TransitionDefinitionMap<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  [K in EventDescriptor<TEvent>]: Array<
    TransitionDefinition<TContext, ExtractEvent<TEvent, K>>
  >;
};

export type DelayExpr<
  TContext extends MachineContext,
  TEvent extends EventObject
> = (args: { context: TContext; event: TEvent }) => number;

export interface DelayedTransitionDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends TransitionDefinition<TContext, TEvent> {
  delay: number | string | DelayExpr<TContext, TEvent>;
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
  context: TContext;
  historyValue?: HistoryValue;
  /** @internal */
  _nodes: Array<AnyStateNode>;
  children: Record<string, AnyActorRef | undefined>;
  status: SnapshotStatus;
  output?: any;
  error?: unknown;
  /** @internal */
  _stateParams?: Record<string, Record<string, unknown>>;
  machine?: StateMachine<
    TContext,
    TEvent,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >;
}

export interface ActorOptions<TLogic extends AnyActorLogic> {
  /**
   * The clock that is responsible for setting and clearing timeouts, such as
   * delayed events and transitions.
   *
   * @remarks
   * You can create your own “clock”. The clock interface is an object with two
   * functions/methods:
   *
   * - `setTimeout` - same arguments as `window.setTimeout(fn, timeout)`
   * - `clearTimeout` - same arguments as `window.clearTimeout(id)`
   *
   * By default, the native `setTimeout` and `clearTimeout` functions are used.
   *
   * For testing, XState provides `SimulatedClock`.
   * @see {@link Clock}
   * @see {@link SimulatedClock}
   */
  clock?: Clock;
  /**
   * Specifies the logger to be used for `log(...)` actions. Defaults to the
   * native `console.log(...)` method.
   */
  logger?: (...args: any[]) => void;
  parent?: AnyActorRef;
  /** @internal */
  syncSnapshot?: boolean;
  /** The custom `id` for referencing this service. */
  id?: string;
  /** @deprecated Use `inspect` instead. */
  devTools?: never;

  /** The system ID to register this actor under. */
  systemId?: string;
  /** The input data to pass to the actor. */
  input?: InputFrom<TLogic>;

  /**
   * Initializes actor logic from a specific persisted internal state.
   *
   * @remarks
   * If the state is compatible with the actor logic, when the actor is started
   * it will be at that persisted state. Actions from machine actors will not be
   * re-executed, because they are assumed to have been already executed.
   * However, invocations will be restarted, and spawned actors will be restored
   * recursively.
   *
   * Can be generated with {@link Actor.getPersistedSnapshot}.
   * @see https://stately.ai/docs/persistence
   */
  snapshot?: Snapshot<unknown>;

  /** @deprecated Use `snapshot` instead. */
  state?: Snapshot<unknown>;

  /** The source actor logic. */
  src?: string | AnyActorLogic;

  /**
   * A callback function or observer object which can be used to inspect actor
   * system updates.
   *
   * @remarks
   * If a callback function is provided, it can accept an inspection event
   * argument. The types of inspection events that can be observed include:
   *
   * - `@xstate.actor` - An actor ref has been created in the system
   * - `@xstate.event` - An event was sent from a source actor ref to a target
   *   actor ref in the system
   * - `@xstate.snapshot` - An actor ref emitted a snapshot due to a received
   *   event
   *
   * @example
   *
   * ```ts
   * import { createMachine } from 'xstate';
   *
   * const machine = createMachine({
   *   // ...
   * });
   *
   * const actor = createActor(machine, {
   *   inspect: (inspectionEvent) => {
   *     if (inspectionEvent.actorRef === actor) {
   *       // This event is for the root actor
   *     }
   *
   *     if (inspectionEvent.type === '@xstate.actor') {
   *       console.log(inspectionEvent.actorRef);
   *     }
   *
   *     if (inspectionEvent.type === '@xstate.event') {
   *       console.log(inspectionEvent.sourceRef);
   *       console.log(inspectionEvent.actorRef);
   *       console.log(inspectionEvent.event);
   *     }
   *
   *     if (inspectionEvent.type === '@xstate.snapshot') {
   *       console.log(inspectionEvent.actorRef);
   *       console.log(inspectionEvent.event);
   *       console.log(inspectionEvent.snapshot);
   *     }
   *   }
   * });
   * ```
   *
   * Alternately, an observer object (`{ next?, error?, complete? }`) can be
   * provided:
   *
   * @example
   *
   * ```ts
   * const actor = createActor(machine, {
   *   inspect: {
   *     next: (inspectionEvent) => {
   *       if (inspectionEvent.actorRef === actor) {
   *         // This event is for the root actor
   *       }
   *
   *       if (inspectionEvent.type === '@xstate.actor') {
   *         console.log(inspectionEvent.actorRef);
   *       }
   *
   *       if (inspectionEvent.type === '@xstate.event') {
   *         console.log(inspectionEvent.sourceRef);
   *         console.log(inspectionEvent.actorRef);
   *         console.log(inspectionEvent.event);
   *       }
   *
   *       if (inspectionEvent.type === '@xstate.snapshot') {
   *         console.log(inspectionEvent.actorRef);
   *         console.log(inspectionEvent.event);
   *         console.log(inspectionEvent.snapshot);
   *       }
   *     }
   *   }
   * });
   * ```
   */
  inspect?:
    | Observer<InspectionEvent>
    | ((inspectionEvent: InspectionEvent) => void);
}

export type AnyActor = Actor<any>;

/** @deprecated Use `AnyActor` instead. */
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

type EventDescriptorMatches<
  TEventType extends string,
  TNormalizedDescriptor
> = TEventType extends TNormalizedDescriptor ? true : false;

export type ExtractEvent<
  TEvent extends EventObject,
  TDescriptor extends EventDescriptor<TEvent>
> = string extends TEvent['type']
  ? TEvent
  : NormalizeDescriptor<TDescriptor> extends infer TNormalizedDescriptor
    ? TEvent extends any
      ? // true is the check type here to match both true and boolean
        true extends EventDescriptorMatches<
          TEvent['type'],
          TNormalizedDescriptor
        >
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
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TEmitted extends EventObject = EventObject
> extends Subscribable<TSnapshot>,
    InteropObservable<TSnapshot> {
  /** The unique identifier for this actor relative to its parent. */
  id: string;
  /**
   * The globally unique process ID for this invocation.
   *
   * @remarks
   * This is only defined once the actor is started.
   */
  sessionId: string | undefined;
  /** @internal */
  _send: (event: TEvent) => void;
  send: (event: TEvent) => void;
  start: () => this;
  getSnapshot: () => TSnapshot;
  getPersistedSnapshot: () => Snapshot<unknown>;
  stop: () => void;
  toJSON?: () => any;
  // TODO: figure out how to hide this externally as `sendTo(ctx => ctx.actorRef._parent._parent._parent._parent)` shouldn't be allowed
  _parent?: AnyActorRef;
  system: AnyActorSystem;
  /** @internal */
  _processingStatus: ProcessingStatus;
  src: string | AnyActorLogic;
  // TODO: remove from ActorRef interface
  // (should only be available on Actor)
  on: <TType extends TEmitted['type'] | '*'>(
    type: TType,
    handler: (
      emitted: TEmitted & (TType extends '*' ? unknown : { type: TType })
    ) => void
  ) => Subscription;
  trigger: {
    [K in TEvent['type']]: IsEmptyObject<
      Omit<Extract<TEvent, { type: K }>, 'type'>
    > extends true
      ? () => void
      : (payload: Omit<Extract<TEvent, { type: K }>, 'type'>) => void;
  };
}

export type AnyActorRef = ActorRef<any, any, any>;

export type ActorRefLike = Pick<
  AnyActorRef,
  'sessionId' | 'send' | 'getSnapshot'
>;

export type UnknownActorRef = ActorRef<Snapshot<unknown>, EventObject>;

// TODO: in v6, this should only accept AnyActorLogic, like ActorRefFromLogic
export type ActorRefFrom<T> =
  T extends StateMachine<
    infer TContext,
    infer TEvent,
    infer TChildren,
    infer TStateValue,
    infer TTag,
    infer _TInput,
    infer TOutput,
    infer TEmitted,
    infer TMeta,
    infer _TConfig,
    infer _TActionMap,
    infer _TActorMap,
    infer _TGuardMap,
    infer _TDelayMap
  >
    ? ActorRef<
        MachineSnapshot<
          TContext,
          TEvent,
          TChildren,
          TStateValue,
          TTag,
          TOutput,
          TMeta,
          any //TStateSchema
        >,
        TEvent,
        TEmitted
      >
    : T extends Promise<infer U>
      ? ActorRefFrom<PromiseActorLogic<U>>
      : T extends ActorLogic<
            infer TSnapshot,
            infer TEvent,
            infer _TInput,
            infer _TSystem,
            infer TEmitted
          >
        ? ActorRef<TSnapshot, TEvent, TEmitted>
        : never;

export type ActorRefFromLogic<T extends AnyActorLogic> = ActorRef<
  SnapshotFrom<T>,
  EventFromLogic<T>,
  EmittedFrom<T>
>;

export type DevToolsAdapter = (service: AnyActor) => void;

export type MachineImplementationsFrom<
  T extends AnyStateMachine | ((...args: any[]) => AnyStateMachine)
> =
  T extends StateMachine<
    infer _TContext,
    infer _TEvent,
    infer _TChildren,
    infer _TStateValue,
    infer _TTag,
    infer _TInput,
    infer _TOutput,
    infer _TEmitted,
    infer _TMeta,
    infer _TConfig,
    infer TActionMap,
    infer TActorMap,
    infer TGuardMap,
    infer TDelayMap
  >
    ? {
        actions: TActionMap;
        actors: TActorMap;
        guards: TGuardMap;
        delays: TDelayMap;
      }
    : never;

export interface ActorScope<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TSystem extends AnyActorSystem = AnyActorSystem,
  TEmitted extends EventObject = EventObject
> {
  self: ActorRef<TSnapshot, TEvent, TEmitted>;
  id: string;
  sessionId: string;
  logger: (...args: any[]) => void;
  defer: (fn: () => void) => void;
  emit: (event: TEmitted) => void;
  system: TSystem;
  stopChild: (child: AnyActorRef) => void;
  actionExecutor: ActionExecutor;
}

export type AnyActorScope = ActorScope<
  any, // TSnapshot
  any, // TEvent
  AnyActorSystem,
  any // TEmitted
>;

export type SnapshotStatus = 'active' | 'done' | 'error' | 'stopped';

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

/**
 * Represents logic which can be used by an actor.
 *
 * @template TSnapshot - The type of the snapshot.
 * @template TEvent - The type of the event object.
 * @template TInput - The type of the input.
 * @template TSystem - The type of the actor system.
 */
export interface ActorLogic<
  in out TSnapshot extends Snapshot<unknown>, // it's invariant because it's also part of `ActorScope["self"]["getSnapshot"]`
  in out TEvent extends EventObject, // it's invariant because it's also part of `ActorScope["self"]["send"]`
  in TInput = NonReducibleUnknown,
  TSystem extends AnyActorSystem = AnyActorSystem,
  in out TEmitted extends EventObject = EventObject // it's invariant because it's also aprt of `ActorScope["self"]["on"]`
> {
  /** The initial setup/configuration used to create the actor logic. */
  config?: unknown;
  /**
   * Transition function that processes the current state and an incoming event
   * to produce a new state.
   *
   * @param snapshot - The current state.
   * @param event - The incoming event.
   * @param actorScope - The actor scope.
   * @returns The new state.
   */
  transition: (
    snapshot: TSnapshot,
    event: TEvent,
    actorScope: ActorScope<TSnapshot, TEvent, TSystem, TEmitted>
  ) => TSnapshot;
  /**
   * Called to provide the initial state of the actor.
   *
   * @param actorScope - The actor scope.
   * @param input - The input for the initial state.
   * @returns The initial state.
   */
  getInitialSnapshot: (
    actorScope: ActorScope<TSnapshot, TEvent, TSystem, TEmitted>,
    input: TInput
  ) => TSnapshot;
  /**
   * Called when Actor is created to restore the internal state of the actor
   * given a persisted state. The persisted state can be created by
   * `getPersistedSnapshot`.
   *
   * @param persistedState - The persisted state to restore from.
   * @param actorScope - The actor scope.
   * @returns The restored state.
   */
  restoreSnapshot?: (
    persistedState: Snapshot<unknown>,
    actorScope: ActorScope<TSnapshot, TEvent, AnyActorSystem, TEmitted>
  ) => TSnapshot;
  /**
   * Called when the actor is started.
   *
   * @param snapshot - The starting state.
   * @param actorScope - The actor scope.
   */
  start?: (
    snapshot: TSnapshot,
    actorScope: ActorScope<TSnapshot, TEvent, AnyActorSystem, TEmitted>
  ) => void;
  /**
   * Obtains the internal state of the actor in a representation which can be be
   * persisted. The persisted state can be restored by `restoreSnapshot`.
   *
   * @param snapshot - The current state.
   * @returns The a representation of the internal state to be persisted.
   */
  getPersistedSnapshot: (
    snapshot: TSnapshot,
    options?: unknown
  ) => Snapshot<unknown>;
}

/**
 * Actor logic that includes a `createActor` method for creating unstarted
 * actors.
 */
export type CreatableActorLogic<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput = NonReducibleUnknown,
  TSystem extends AnyActorSystem = AnyActorSystem,
  TEmitted extends EventObject = EventObject
> = ActorLogic<TSnapshot, TEvent, TInput, TSystem, TEmitted> & {
  /**
   * Creates an unstarted actor from this logic.
   *
   * @param input - The input for the actor.
   * @param options - Actor options.
   * @returns An unstarted actor.
   */
  createActor: (
    input?: TInput,
    options?: ActorOptions<any>
  ) => ActorRef<TSnapshot, TEvent, TEmitted>;
};

export type AnyActorLogic = ActorLogic<
  any, // snapshot
  any, // event
  any, // input
  any, // system
  any // emitted
>;

export type UnknownActorLogic = ActorLogic<
  any, // snapshot
  any, // event
  any, // input
  AnyActorSystem,
  any // emitted
>;

export type SnapshotFrom<T> =
  ReturnTypeOrValue<T> extends infer R
    ? R extends ActorRef<infer TSnapshot, infer _, infer __>
      ? TSnapshot
      : R extends Actor<infer TLogic>
        ? SnapshotFrom<TLogic>
        : R extends ActorLogic<
              infer _TSnapshot,
              infer _TEvent,
              infer _TInput,
              infer _TEmitted,
              infer _TSystem
            >
          ? ReturnType<R['transition']>
          : R extends ActorScope<
                infer TSnapshot,
                infer _TEvent,
                infer _TEmitted,
                infer _TSystem
              >
            ? TSnapshot
            : never
    : never;

export type EventFromLogic<TLogic extends AnyActorLogic> =
  TLogic extends ActorLogic<
    infer _TSnapshot,
    infer TEvent,
    infer _TInput,
    infer _TEmitted,
    infer _TSystem
  >
    ? TEvent
    : never;

export type EmittedFrom<TLogic extends AnyActorLogic> =
  TLogic extends ActorLogic<
    infer _TSnapshot,
    infer _TEvent,
    infer _TInput,
    infer _TSystem,
    infer TEmitted
  >
    ? TEmitted
    : never;

type ResolveEventType<T> = T extends infer R
  ? R extends StateMachine<
      infer _TContext,
      infer TEvent,
      infer _TChildren,
      infer _TStateValue,
      infer _TTag,
      infer _TInput,
      infer _TOutput,
      infer _TEmitted,
      infer _TMeta,
      infer _TConfig,
      infer _TActionMap,
      infer _TActorMap,
      infer _TGuardMap,
      infer _TDelayMap
    >
    ? TEvent
    : R extends MachineSnapshot<
          infer _TContext,
          infer TEvent,
          infer _TChildren,
          infer _TStateValue,
          infer _TTag,
          infer _TOutput,
          infer _TMeta,
          infer _TStateSchema
        >
      ? TEvent
      : R extends ActorRef<infer _TSnapshot, infer TEvent, infer _TEmitted>
        ? TEvent
        : never
  : never;

export type EventFrom<
  T,
  K extends Prop<TEvent, 'type'> = never,
  TEvent extends EventObject = ResolveEventType<T>
> = IsNever<K> extends true ? TEvent : ExtractEvent<TEvent, K>;

export type ContextFrom<T> =
  T extends StateMachine<
    infer TContext,
    infer _TEvent,
    infer _TChildren,
    infer _TStateValue,
    infer _TTag,
    infer _TInput,
    infer _TOutput,
    infer _TEmitted,
    infer _TMeta,
    infer _TConfig,
    infer _TActionMap,
    infer _TActorMap,
    infer _TGuardMap,
    infer _TDelayMap
  >
    ? TContext
    : T extends MachineSnapshot<
          infer TContext,
          infer _TEvent,
          infer _TChildren,
          infer _TStateValue,
          infer _TTag,
          infer _TOutput,
          infer _TMeta,
          infer _TStateSchema
        >
      ? TContext
      : T extends Actor<infer TActorLogic>
        ? TActorLogic extends AnyStateMachine
          ? ContextFrom<TActorLogic>
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

export type RequiredActorOptions<TActor extends ProvidedActor> =
  | (undefined extends TActor['id'] ? never : 'id')
  | (undefined extends InputFrom<TActor['logic']> ? never : 'input');

export type RequiredLogicInput<TLogic extends AnyActorLogic> =
  undefined extends InputFrom<TLogic> ? never : 'input';

type ExtractLiteralString<T extends string | undefined> = T extends string
  ? string extends T
    ? never
    : T
  : never;

type ToConcreteChildren<TActor extends ProvidedActor> = {
  [A in TActor as ExtractLiteralString<A['id']>]?: ActorRefFromLogic<
    A['logic']
  >;
};

export type ToChildren<TActor extends ProvidedActor> =
  // only proceed further if all configured `src`s are literal strings
  string extends TActor['src']
    ? // TODO: replace `AnyActorRef` with `UnknownActorRef`~
      // or maybe even `TActor["logic"]` since it's possible to configure `{ src: string; logic: SomeConcreteLogic }`
      // TODO: consider adding `| undefined` here
      Record<string, AnyActorRef>
    : Compute<
        ToConcreteChildren<TActor> &
          {
            include: {
              [id: string]: TActor extends any
                ? ActorRefFromLogic<TActor['logic']> | undefined
                : never;
            };
            exclude: unknown;
          }[undefined extends TActor['id'] // if not all actors have literal string IDs then we need to create an index signature containing all possible actor types
            ? 'include'
            : string extends TActor['id']
              ? 'include'
              : 'exclude']
      >;

export type StateSchema = {
  id?: string;
  states?: Record<string, StateSchema>;
  contextSchema?: StandardSchemaV1;
  params?: unknown;

  // Other types
  // Needed because TS treats objects with all optional properties as a "weak" object
  // https://github.com/statelyai/xstate/issues/5031
  type?: unknown;
  invoke?: unknown;
  on?: unknown;
  entry?: unknown;
  exit?: unknown;
  onDone?: unknown;
  after?: unknown;
  always?: unknown;
  meta?: unknown;
  output?: unknown;
  tags?: unknown;
  description?: unknown;
};

export type StateId<
  TSchema extends StateSchema,
  TKey extends string = '(machine)',
  TParentKey extends string | null = null
> =
  | (TSchema extends { id: string }
      ? TSchema['id']
      : TParentKey extends null
        ? TKey
        : `${TParentKey}.${TKey}`)
  | (TSchema['states'] extends Record<string, any>
      ? Values<{
          [K in keyof TSchema['states'] & string]: StateId<
            TSchema['states'][K],
            K,
            TParentKey extends string
              ? `${TParentKey}.${TKey}`
              : TSchema['id'] extends string
                ? TSchema['id']
                : TKey
          >;
        }>
      : never);

/** Maps state IDs to their params types based on the StateSchema. */
export type StateIdParams<
  TSchema extends StateSchema,
  TKey extends string = '(machine)',
  TParentKey extends string | null = null
> = {
  [K in TSchema extends { id: string }
    ? TSchema['id']
    : TParentKey extends null
      ? TKey
      : `${TParentKey}.${TKey}`]: TSchema['params'] extends undefined
    ? undefined
    : TSchema['params'];
} & (TSchema['states'] extends Record<string, StateSchema>
  ? UnionToIntersection<
      Values<{
        [K in keyof TSchema['states'] & string]: StateIdParams<
          TSchema['states'][K],
          K,
          TParentKey extends string
            ? `${TParentKey}.${TKey}`
            : TSchema['id'] extends string
              ? TSchema['id']
              : TKey
        >;
      }>
    >
  : {});

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

export interface StateMachineTypes {
  context: MachineContext;
  events: EventObject;
  actors: ProvidedActor;
  actions: ParameterizedObject;
  guards: ParameterizedObject;
  delays: string;
  tags: string;
  emitted: EventObject;
}

/** @deprecated */
export interface ResolvedStateMachineTypes<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string,
  TEmitted extends EventObject = EventObject
> {
  context: TContext;
  events: TEvent;
  actors: TActor;
  actions: TAction;
  guards: TGuard;
  delays: TDelay;
  tags: TTag;
  emitted: TEmitted;
}

export type GetConcreteByKey<
  T,
  TKey extends keyof T,
  TValue extends T[TKey]
> = T & Record<TKey, TValue>;

type _GroupStateKeys<
  T extends StateSchema,
  S extends keyof T['states']
> = S extends any
  ? T['states'][S] extends { type: 'history' }
    ? [never, never]
    : T extends { type: 'parallel' }
      ? [S, never]
      : 'states' extends keyof T['states'][S]
        ? [S, never]
        : [never, S]
  : never;

type GroupStateKeys<T extends StateSchema, S extends keyof T['states']> = {
  nonLeaf: _GroupStateKeys<T, S & string>[0];
  leaf: _GroupStateKeys<T, S & string>[1];
};

export type ToStateValue<T extends StateSchema> = T extends {
  states: Record<infer S, any>;
}
  ? IsNever<S> extends true
    ? {}
    :
        | GroupStateKeys<T, S>['leaf']
        | (IsNever<GroupStateKeys<T, S>['nonLeaf']> extends false
            ? T extends { type: 'parallel' }
              ? {
                  [K in GroupStateKeys<T, S>['nonLeaf']]: ToStateValue<
                    T['states'][K]
                  >;
                }
              : Compute<
                  Values<{
                    [K in GroupStateKeys<T, S>['nonLeaf']]: {
                      [StateKey in K]: ToStateValue<T['states'][K]>;
                    };
                  }>
                >
            : never)
  : {};

export interface ExecutableActionObject {
  type: string & {};
  params: NonReducibleUnknown;
  args: unknown[];
  exec: (() => void) | undefined;
}

export type SpecialExecutableAction = Values<{
  [K in keyof typeof builtInActions]: {
    type: K;
    args: Parameters<(typeof builtInActions)[K]>;
  };
}>;

export interface ToExecutableAction<T extends ParameterizedObject>
  extends ExecutableActionObject {
  type: T['type'];
  params: T['params'];
  exec: undefined;
}

export type ActionExecutor = (actionToExecute: ExecutableActionObject) => void;

/** Mappers for subscribeTo - maps lifecycle events to machine events */
export interface SubscribeToMappers<
  TSnapshot extends Snapshot<unknown>,
  TOutput,
  TMappedEvent extends EventObject
> {
  snapshot?: (snapshot: TSnapshot) => TMappedEvent;
  done?: (output: TOutput) => TMappedEvent;
  error?: (error: unknown) => TMappedEvent;
}

export type EnqueueObject<
  TEvent extends EventObject,
  TEmittedEvent extends EventObject
> = {
  cancel: (id: string) => void;
  raise: (ev: TEvent, options?: { id?: string; delay?: number }) => void;
  spawn: <T extends AnyActorLogic>(
    logic: T,
    options?: {
      input?: InputFrom<T>;
      id?: string;
      syncSnapshot?: boolean;
      systemId?: string;
    }
  ) => AnyActorRef;
  emit: (emittedEvent: TEmittedEvent) => void;
  <T extends (...args: any[]) => any>(fn: T, ...args: Parameters<T>): void;
  log: (...args: any[]) => void;
  sendTo: <T extends EventObject>(
    actorRef: { send: (event: T) => void } | undefined,
    event: T,
    options?: { id?: string; delay?: number }
  ) => void;
  stop: (actorRef?: AnyActorRef) => void;
  /**
   * Listen to emitted events from an actor. Returns a listener actor that can
   * be stopped via `enq.stop()`.
   *
   * @param actor - The actor to listen to
   * @param eventType - The emitted event type to listen for (supports
   *   wildcards: 'event._', '_')
   * @param mapper - Function to transform emitted events into machine events
   */
  listen: <TEmitted extends EventObject, TMappedEvent extends TEvent>(
    actor: AnyActorRef,
    eventType: string,
    mapper: (event: TEmitted) => TMappedEvent
  ) => AnyActorRef;
  /**
   * Subscribe to lifecycle events (done/error/snapshot) from an actor. Returns
   * a subscription actor that can be stopped via `enq.stop()`.
   *
   * @param actor - The actor to subscribe to
   * @param mappers - Object with done/error/snapshot mappers, or a single
   *   snapshot mapper function
   */
  subscribeTo: <
    TSnapshot extends Snapshot<unknown>,
    TOutput,
    TMappedEvent extends TEvent
  >(
    actor: AnyActorRef,
    mappers:
      | SubscribeToMappers<TSnapshot, TOutput, TMappedEvent>
      | ((snapshot: TSnapshot) => TMappedEvent)
  ) => AnyActorRef;
};

export type Action<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmittedEvent extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TParams = Record<string, unknown> | undefined
> = (
  _: {
    context: TContext;
    event: TEvent;
    parent: AnyActorRef | undefined;
    self: ActorRef<
      MachineSnapshot<TContext, TEvent, TODO, TODO, TODO, TODO, TODO, TODO>,
      TEvent
    >;
    children: Record<string, AnyActorRef | undefined>;
    actions: TActionMap;
    actors: TActorMap;
    guards: TGuardMap;
    delays: TDelayMap;
    system?: AnyActorSystem;
    params: TParams;
  },
  enqueue: EnqueueObject<TEvent, TEmittedEvent>
) => {
  context?: TContext;
  children?: Record<string, AnyActorRef | undefined>;
} | void;

export type AnyAction = Action<
  MachineContext,
  EventObject,
  EventObject,
  Implementations['actions'],
  Implementations['actors'],
  Implementations['guards'],
  Implementations['delays']
>;
