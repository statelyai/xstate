import type { MachineSnapshot } from './State.ts';
import type { StateMachine } from './StateMachine.ts';
import type { StateNode } from './StateNode.ts';
import { AsyncActorLogic } from './actors/promise.ts';
import type { Actor, ProcessingStatus } from './createActor.ts';
import { InspectionEvent } from './inspection.ts';
import { Spawner } from './spawn.ts';
import type { ActorSystemRuntime, AnyActorSystem, Clock } from './system.ts';

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

export type UnifiedArg<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> = {
  context: TContext;
  event: TExpressionEvent;
  self: ActorSelf<
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
} & OutputArg<TExpressionEvent>;

export type MachineContext = Record<string, any>;

type DoneEventType =
  | `xstate.done.actor.${string}`
  | `xstate.done.state.${string}`;

export type OutputArg<TEvent extends EventObject> = TEvent extends {
  type: DoneEventType;
  output: infer TOutput;
}
  ? { output: TOutput }
  : { output: undefined };

export type ActionArgs<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> = UnifiedArg<TContext, TExpressionEvent, TEvent> & {
  children: Record<string, AnyActor>;
};

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
              event,
              output
            }: {
              context: TContext;
              event: TExpressionEvent;
            } & OutputArg<TExpressionEvent>) => T['params']);
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

export type TransitionContextPatch<TContext extends MachineContext> =
  Partial<TContext> & {
    call?: never;
    apply?: never;
    bind?: never;
  };

export type TransitionContextMapper<
  TContext extends MachineContext,
  TCurrentEvent extends EventObject,
  TEvent extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  _TCtx extends MachineContext = [TContext] extends [never] ? any : TContext
> = (
  args: TransitionFunctionArgs<
    _TCtx,
    TCurrentEvent,
    TEvent,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
  >
) => TransitionContextPatch<_TCtx>;

export interface TransitionConfig<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> {
  actions?: never;
  guard?: unknown;
  reenter?: boolean;
  target?: TransitionTarget | undefined;
  context?:
    | TransitionContextPatch<TContext>
    | TransitionContextMapper<
        TContext,
        TExpressionEvent,
        TEvent,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap
      >;
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
  TActorMap extends Implementations['actorSources'],
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
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> {
  id: string;

  registryKey: string | undefined;

  logic:
    | string
    | AnyActorLogic
    | (({
        actorSources,
        context,
        event,
        self
      }: {
        actorSources: TActorMap;
        context: TContext;
        event: TEvent;
        self: AnyActorRef;
      }) => string | AnyActorLogic);
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
  /**
   * The duration (in ms) after which this invocation times out if it has not
   * completed.
   */
  timeout?: number | ((args: { context: TContext; event: TEvent }) => number);
  /** The transition to take when the invoke-level `timeout` expires. */
  onTimeout?:
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
      >;
}

export type AnyInvokeDefinition = InvokeDefinition<
  MachineContext,
  EventObject,
  EventObject,
  MetaObject,
  Implementations['actions'],
  Implementations['actorSources'],
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
  TActorMap extends Implementations['actorSources'],
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
  | 'choice'
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
  TActorMap extends Implementations['actorSources'],
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
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject,
  TInput = undefined,
  _TCtx extends MachineContext = [TContext] extends [never] ? any : TContext
> = (
  args: TransitionFunctionArgs<
    _TCtx,
    TCurrentEvent,
    TEvent,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
  > & { input: TInput },
  enq: EnqueueObject<TEvent, TEmitted>
) => {
  target?: string | string[];
  // target?: keyof TSS['states'];
  context?: TransitionContextPatch<_TCtx>;
  reenter?: boolean;
  meta?: TMeta;
  input?: Record<string, unknown>;
} | void;

type TransitionFunctionArgs<
  TContext,
  TCurrentEvent extends EventObject,
  TEvent extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> = {
  context: TContext;
  event: TCurrentEvent;
  self: ActorSelf<
    MachineSnapshot<
      TContext & MachineContext,
      TEvent,
      TODO,
      TODO,
      TODO,
      TODO,
      TODO,
      TODO
    >,
    TEvent
  >;
  parent: UnknownActorRef | undefined;
  value: StateValue;
  children: Record<string, AnyActor>;
  system: AnyActorSystem;
  actions: TActionMap;
  actorSources: TActorMap;
  guards: TGuardMap;
  delays: TDelayMap;
} & OutputArg<TCurrentEvent>;

export type AnyTransitionConfigFunction = TransitionConfigFunction<
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

export type TransitionsConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
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

export type NormalizeDescriptor<TDescriptor extends string> =
  TDescriptor extends '*'
    ? string
    : TDescriptor extends `${infer TLeading}.*`
      ? `${TLeading}.${string}`
      : TDescriptor;

type EventTypeMatchesDescriptor<
  TEventType extends string,
  TDescriptor extends string
> = TEventType extends NormalizeDescriptor<TDescriptor> ? true : false;

type IsInternalEventType<
  TEventType extends string,
  TDescriptors extends string
> = true extends (
  TDescriptors extends any
    ? EventTypeMatchesDescriptor<TEventType, TDescriptors>
    : never
)
  ? true
  : false;

type ExcludeInternalEvents<
  TEvent extends EventObject,
  TDescriptors extends string
> = TEvent extends any
  ? IsInternalEventType<TEvent['type'], TDescriptors> extends true
    ? never
    : TEvent
  : never;

export type IsLiteralString<T extends string> = string extends T ? false : true;

type ActorImplementationsBySrc<TActor extends ProvidedActor> = {
  [A in TActor as A['src']]: A['logic'];
};

type DistributeActors<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
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
            registryKey?: string;
            /** The source of the machine to be invoked, or the machine itself. */
            src:
              | TSrc
              | (({
                  actorSources,
                  context,
                  event,
                  self
                }: {
                  actorSources: ActorImplementationsBySrc<TActor>;
                  context: TContext;
                  event: TEvent;
                  self: AnyActorRef;
                }) => TSrc | TSpecificActor['logic']);

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
            timeout?:
              | number
              | ((args: { context: TContext; event: TEvent }) => number);
            onTimeout?:
              | string
              | SingleOrArray<
                  TransitionConfigOrTarget<
                    TContext,
                    TEvent,
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
          registryKey?: string;
          src:
            | string
            | AnyActorLogic
            | (({
                actorSources,
                context,
                event,
                self
              }: {
                actorSources: ActorImplementationsBySrc<TActor>;
                context: TContext;
                event: TEvent;
                self: AnyActorRef;
              }) => string | AnyActorLogic);
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
          timeout?:
            | number
            | ((args: { context: TContext; event: TEvent }) => number);
          onTimeout?:
            | string
            | SingleOrArray<
                TransitionConfigOrTarget<
                  TContext,
                  TEvent,
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

        registryKey?: string;
        /** The source of the machine to be invoked, or the machine itself. */
        src:
          | string
          | AnyActorLogic
          | (({
              actorSources,
              context,
              event,
              self
            }: {
              actorSources: ActorImplementationsBySrc<TActor>;
              context: TContext;
              event: TEvent;
              self: AnyActorRef;
            }) => string | AnyActorLogic);

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
        timeout?:
          | number
          | ((args: { context: TContext; event: TEvent }) => number);
        onTimeout?:
          | string
          | SingleOrArray<
              TransitionConfigOrTarget<
                TContext,
                TEvent,
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

type LoosenMachineSnapshot<TSnapshot> =
  TSnapshot extends MachineSnapshot<any, any, any, any, any, any, any, any>
    ? Omit<TSnapshot, 'matches' | 'can'> & {
        matches(partialStateValue: StateValue): boolean;
        can(event: any): boolean;
      }
    : never;

export type AnyMachineSnapshot = LoosenMachineSnapshot<
  MachineSnapshot<any, any, any, any, any, any, any, any>
>;

export interface AnyStateMachine extends AnyActorLogic {
  id: string;
  root: AnyStateNode;
  /** @internal */
  idMap: Map<string, AnyStateNode>;
  options?: { maxIterations?: number };
  states: StateNodesConfig<any, any>;
  events: Array<EventDescriptor<any>>;
  implementations: Implementations;
  config: any;
  version?: string;
  provide(implementations: any): AnyStateMachine;
  resolveState(config: any): any;
  /** @internal */
  _getPreInitialState(actorScope: AnyActorScope, initEvent: EventObject): any;
  getTransitionData(
    snapshot: any,
    event: any,
    actor: AnyActorRef
  ): AnyTransitionDefinition[];
  /** @internal */
  _canTransition(snapshot: AnyMachineSnapshot, event: any): boolean;
  getStateNodeById(stateId: string): AnyStateNode;
  getPersistedSnapshot(snapshot: any, options?: unknown): Snapshot<unknown>;
}

export type AnyStateConfig = StateConfig<any, AnyEventObject>;

export type DelayConfig<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
> = number | DelayExpr<TContext, TExpressionEvent>;

export type InitialContext<
  TContext extends MachineContext,
  TActorMap extends Implementations['actorSources'],
  TInput,
  TEvent extends EventObject
> = TContext | ContextFactory<TContext, TActorMap, TInput, TEvent>;

export type ContextFactory<
  TContext extends MachineContext,
  TActorMap extends Implementations['actorSources'],
  TInput,
  TEvent extends EventObject = EventObject
> = ({
  spawn,
  actorSources,
  input,
  self
}: {
  spawn: Spawner;
  actorSources: TActorMap;
  input: TInput;
  self: ActorSelf<
    MachineSnapshot<
      [TContext] extends [never] ? any : TContext,
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
}) => [TContext] extends [never] ? MachineContext : TContext;

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
  actorSources?: TActor;
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
  ? StateSnapshotFromMachine<T>
  : T extends (...args: any[]) => AnyStateMachine
    ? StateSnapshotFromMachine<ReturnType<T>>
    : never;

type StateValueFromStateSchema<T extends StateSchema> = StateSchema extends T
  ? StateValue
  : ToStateValue<T> extends infer TStateValue
    ? TStateValue extends StateValue
      ? TStateValue
      : StateValue
    : StateValue;

type MatchingStateValueForStateFrom<
  TStateValue extends StateValue,
  TTestStateValue extends StateValue
> = TStateValue extends unknown
  ? TTestStateValue extends string
    ? TStateValue extends string
      ? TTestStateValue extends TStateValue
        ? TTestStateValue
        : Extract<TStateValue, TTestStateValue>
      : TStateValue extends StateValueMap
        ? TStateValue & Record<TTestStateValue, StateValue | undefined>
        : never
    : TTestStateValue extends StateValueMap
      ? TStateValue extends StateValueMap
        ? MatchingStateValueMapForStateFrom<TStateValue, TTestStateValue>
        : never
      : never
  : never;

type MatchingStateValueMapForStateFrom<
  TStateValue extends StateValueMap,
  TTestStateValue extends StateValueMap
> = false extends {
  [K in keyof TTestStateValue & string]: K extends keyof TStateValue
    ? IsNever<
        MatchingStateValueForStateFrom<
          NonNullable<TStateValue[K]>,
          NonNullable<TTestStateValue[K]>
        >
      > extends true
      ? false
      : true
    : false;
}[keyof TTestStateValue & string]
  ? never
  : {
      [K in keyof TStateValue]: K extends keyof TTestStateValue
        ? MatchingStateValueForStateFrom<
            NonNullable<TStateValue[K]>,
            NonNullable<TTestStateValue[K]>
          >
        : TStateValue[K];
    };

type StateSnapshotFromStateValue<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TStateValue extends StateValue,
  TTag extends string,
  TOutput,
  TMeta extends MetaObject,
  TStateSchema extends StateSchema,
  TAllStateValue extends StateValue = TStateValue
> = TStateValue extends unknown
  ? Omit<
      MachineSnapshot<
        StateContextFromStateValue<TStateSchema, TContext, TStateValue>,
        TEvent,
        TChildren,
        TStateValue,
        TTag,
        TOutput,
        TMeta,
        TStateSchema
      >,
      'matches'
    > & {
      matches<const TTestStateValue extends string>(
        partialStateValue: TTestStateValue,
        ...args: string extends TTestStateValue ? [never] : []
      ): this is StateSnapshotFromStateValue<
        StateContextFromStateValue<TStateSchema, TContext, TTestStateValue>,
        TEvent,
        TChildren,
        MatchingStateValueForStateFrom<TAllStateValue, TTestStateValue>,
        TTag,
        TOutput,
        TMeta,
        TStateSchema,
        TAllStateValue
      >;
      matches<const TTestStateValue extends StateValueMap>(
        partialStateValue: TTestStateValue,
        ...args: string extends keyof TTestStateValue ? [never] : []
      ): this is StateSnapshotFromStateValue<
        StateContextFromStateValue<TStateSchema, TContext, TTestStateValue>,
        TEvent,
        TChildren,
        MatchingStateValueForStateFrom<TAllStateValue, TTestStateValue>,
        TTag,
        TOutput,
        TMeta,
        TStateSchema,
        TAllStateValue
      >;
      matches(partialStateValue: StateValue): boolean;
    }
  : never;

type StateSnapshotFromMachine<T extends AnyStateMachine> =
  SnapshotFrom<T> extends MachineSnapshot<
    infer TContext,
    infer TEvent,
    infer TChildren,
    infer _TStateValue,
    infer TTag,
    infer TOutput,
    infer TMeta,
    infer TStateSchema
  >
    ? StateSnapshotFromStateValue<
        TContext,
        TEvent,
        TChildren,
        StateValueFromStateSchema<TStateSchema>,
        TTag,
        TOutput,
        TMeta,
        TStateSchema,
        StateValueFromStateSchema<TStateSchema>
      >
    : SnapshotFrom<T>;

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

export interface ErrorPlatformEvent<
  TErrorData = unknown,
  TKind extends string = string
> extends EventObject {
  type: `xstate.error.${TKind}`;
  error: TErrorData;
}

export type ErrorEvent = ErrorActorEvent | ErrorPlatformEvent;

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
  Internal = '#_internal'
}

export type Mapper<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TResult,
  TEvent extends EventObject,
  _TCtx = [TContext] extends [never] ? any : TContext
> = (
  args: {
    context: _TCtx;
    event: TExpressionEvent;
    self: ActorSelf<
      MachineSnapshot<
        _TCtx & MachineContext,
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
  } & OutputArg<TExpressionEvent>
) => TResult;

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
    'target' | 'to'
  > {
  target: ReadonlyArray<AnyStateNode> | undefined;
  source: AnyStateNode;
  reenter: boolean;
  eventType: EventDescriptor<TEvent>;
  to?: ((...args: any[]) => any) | undefined;
  input?:
    | Record<string, unknown>
    | ((args: {
        context: any;
        event: any;
        output: any;
      }) => Record<string, unknown>);
}

export type AnyTransitionDefinition = TransitionDefinition<any, any>;

export type InitialTransitionDefinition = {
  source: AnyStateNode;
  target: AnyStateNode[] | undefined;
  reenter?: boolean;
  eventType?: EventDescriptor<any>;
  input?:
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
> = (args: {
  context: [TContext] extends [never] ? any : TContext;
  event: TEvent;
  stateNode: AnyStateNode;
}) => number;

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
  /** @internal */
  value?: StateValue;
  children: Record<string, AnyActorRef | undefined>;
  timers?: Record<string, LogicalTimer>;
  status: SnapshotStatus;
  output?: any;
  error?: unknown;
  /** @internal */
  _stateInputs?: Record<string, Record<string, unknown>>;
  /** @internal */
  _nextTimerId?: number;
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

/** A deterministic delayed-delivery declaration owned by a logic snapshot. */
export interface LogicalTimer {
  id: string;
  delay: number;
  type: '@xstate.raise' | '@xstate.sendTo';
  event: EventObject;
  /** `self` or the logical actor that will receive `event`. */
  target: 'self' | AnyActor;
}

/** The logical input delivered to a timer's source when its runtime delay ends. */
export interface TimerEvent extends EventObject {
  type: 'xstate.timer';
  id: string;
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
  parent?: AnyActor;
  /** @internal */
  syncSnapshot?: boolean;
  /** @internal */
  _systemRef?: { current?: AnyActorSystem };
  /** The custom `id` for referencing this service. */
  id?: string;
  /** @deprecated Use `inspect` instead. */
  devTools?: never;

  /** The registry key to register this actor under. */
  registryKey?: string;
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
   * argument. The inspection protocol has two event types:
   *
   * - `@xstate.actor` - An actor ref was created in the system (announces actor
   *   topology: identity + parent).
   * - `@xstate.transition` - An actor transitioned. Carries every facet of the
   *   transition with flat, always-present fields: `event`, `snapshot`,
   *   `sourceRef`, `microsteps`, executed `actions`, and `sent`/scheduled
   *   events.
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
   *       console.log(inspectionEvent.actorRef, inspectionEvent.parentRef);
   *     }
   *
   *     if (inspectionEvent.type === '@xstate.transition') {
   *       console.log(inspectionEvent.sourceRef);
   *       console.log(inspectionEvent.actorRef);
   *       console.log(inspectionEvent.event);
   *       console.log(inspectionEvent.snapshot);
   *       // flat, always-present facets — no narrowing required
   *       console.log(inspectionEvent.actions);
   *       console.log(inspectionEvent.sent);
   *       console.log(inspectionEvent.microsteps);
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
   *         console.log(
   *           inspectionEvent.actorRef,
   *           inspectionEvent.parentRef
   *         );
   *       }
   *
   *       if (inspectionEvent.type === '@xstate.transition') {
   *         console.log(inspectionEvent.sourceRef);
   *         console.log(inspectionEvent.actorRef);
   *         console.log(inspectionEvent.event);
   *         console.log(inspectionEvent.snapshot);
   *         console.log(inspectionEvent.actions);
   *         console.log(inspectionEvent.sent);
   *         console.log(inspectionEvent.microsteps);
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

export type AnyActor = ActorInstance<any, any, any, any>;

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

export interface Readable<T> extends Subscribable<T> {
  get: () => T;
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

/**
 * A consumer-facing actor handle.
 *
 * `ActorRef` describes the contract a consumer needs: which events can be sent
 * to the actor, which snapshot it publishes for observation, and which emitted
 * events can be listened to. It intentionally does not expose lifecycle control
 * or runtime internals. A concrete `Actor` satisfies this interface, so APIs
 * should accept `ActorRef` whenever they only need to send events, read
 * snapshots, or listen to emitted events.
 */
export interface ActorRef<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TEmitted extends EventObject = EventObject,
  TSendEvent extends EventObject = TEvent
> extends Subscribable<TSnapshot>,
    InteropObservable<TSnapshot> {
  send: (event: TSendEvent) => void;
  getSnapshot: () => TSnapshot;
  on: <TType extends TEmitted['type'] | '*'>(
    type: TType,
    handler: (
      emitted: TEmitted & (TType extends '*' ? unknown : { type: TType })
    ) => void
  ) => Subscription;
}

type EventPayload<
  TEvent extends EventObject,
  TType extends TEvent['type']
> = HomomorphicOmit<ExtractEvent<TEvent, TType>, 'type'>;

export type ActorTrigger<TEvent extends EventObject> = {
  [K in TEvent['type']]: {} extends EventPayload<TEvent, K>
    ? () => void
    : (payload: EventPayload<TEvent, K>) => void;
};

/**
 * Runtime-only actor capabilities.
 *
 * These members are needed by the interpreter, scheduler, inspection, and child
 * management code. Public consumer APIs should prefer `ActorRef` unless they
 * genuinely need lifecycle control such as starting, stopping, or accessing
 * system-owned runtime state.
 */
export interface ActorRuntime<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  _TEmitted extends EventObject = EventObject,
  TSendEvent extends EventObject = TEvent
> {
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
  start: () => this;
  getPersistedSnapshot: () => Snapshot<unknown>;
  stop: () => void;
  toJSON?: () => any;
  _parent?: any;
  system: any;
  /** @internal */
  _processingStatus: ProcessingStatus;
  src: string | AnyActorLogic;
  trigger: ActorTrigger<TSendEvent>;
  select<TSelected>(
    selector: (snapshot: TSnapshot) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ): Readable<TSelected>;
}

/**
 * A concrete actor instance type.
 *
 * `ActorInstance` combines the consumer `ActorRef` contract with runtime
 * lifecycle capabilities. Values returned by `createActor(...)` and
 * `spawn(...)` naturally satisfy narrower `ActorRef` contracts.
 */
export interface ActorInstance<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TEmitted extends EventObject = EventObject,
  TSendEvent extends EventObject = TEvent
> extends ActorRuntime<TSnapshot, TEvent, TEmitted, TSendEvent>,
    ActorRef<TSnapshot, TEvent, TEmitted, TSendEvent> {}

/**
 * The actor's own full self handle.
 *
 * Internals and action/guard implementations receive this shape because `self`
 * can participate in runtime-owned behavior while still being usable wherever
 * an `ActorRef` is expected.
 */
export type ActorSelf<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TEmitted extends EventObject = EventObject,
  TSendEvent extends EventObject = TEvent
> = ActorRuntime<TSnapshot, TEvent, TEmitted, TSendEvent> &
  ActorRef<TSnapshot, TEvent, TEmitted, TSendEvent>;

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
    infer TConfig,
    infer _TActionMap,
    infer _TActorMap,
    infer _TGuardMap,
    infer _TDelayMap
  >
    ? TConfig extends {
        internalEvents?: readonly EventDescriptor<TEvent>[];
      }
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
          TEmitted,
          ExcludeInternalEvents<
            TEvent,
            TConfig['internalEvents'] extends readonly EventDescriptor<TEvent>[]
              ? TConfig['internalEvents'] extends readonly (infer TDesc)[]
                ? Extract<TDesc, string>
                : never
              : never
          >
        >
      : ActorRef<
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
      ? ActorRefFrom<AsyncActorLogic<U>>
      : T extends ActorLogic<
            infer TSnapshot,
            infer TEvent,
            infer _TInput,
            infer _TSystem,
            infer TEmitted
          >
        ? ActorRef<TSnapshot, TEvent, TEmitted>
        : never;

export type SendableEventFromLogic<TLogic extends AnyActorLogic> =
  TLogic extends StateMachine<
    infer _TContext,
    infer TEvent,
    infer _TChildren,
    infer _TStateValue,
    infer _TTag,
    infer _TInput,
    infer _TOutput,
    infer _TEmitted,
    infer _TMeta,
    infer TConfig,
    infer _TActionMap,
    infer _TActorMap,
    infer _TGuardMap,
    infer _TDelayMap
  >
    ? TConfig extends {
        internalEvents?: readonly EventDescriptor<TEvent>[];
      }
      ? ExcludeInternalEvents<
          TEvent,
          TConfig['internalEvents'] extends readonly EventDescriptor<TEvent>[]
            ? TConfig['internalEvents'] extends readonly (infer TDesc)[]
              ? Extract<TDesc, string>
              : never
            : never
        >
      : TEvent
    : EventFromLogic<TLogic>;

type OpaqueMachineSnapshot<TSnapshot extends Snapshot<unknown>> =
  TSnapshot extends MachineSnapshot<
    infer TContext,
    infer TEvent,
    infer TChildren,
    infer TStateValue,
    infer TTag,
    infer TOutput,
    infer TMeta,
    infer _TStateSchema
  >
    ? MachineSnapshot<
        TContext,
        TEvent,
        TChildren,
        TStateValue,
        TTag,
        TOutput,
        TMeta,
        any
      >
    : TSnapshot;

export type ActorRefFromLogic<T extends AnyActorLogic> = ActorRef<
  OpaqueMachineSnapshot<SnapshotFrom<T>>,
  EventFromLogic<T>,
  EmittedFrom<T>,
  SendableEventFromLogic<T>
>;

export interface AnyActorRef extends Subscribable<any>, InteropObservable<any> {
  send(event: any): void;
  getSnapshot(): any;
  on(type: string, handler: (emitted: any) => void): Subscription;
}

/** The concrete actor instance type produced from actor logic. */
export type ActorFromLogic<T extends AnyActorLogic> = ActorInstance<
  SnapshotFrom<T>,
  EventFromLogic<T>,
  EmittedFrom<T>,
  SendableEventFromLogic<T>
>;

type SendableEventFromActorRef<
  TActorRef,
  TFallback extends EventObject = AnyEventObject
> = [NonNullable<TActorRef>] extends [never]
  ? TFallback
  : NonNullable<TActorRef> extends infer TNonNullableActorRef
    ? TNonNullableActorRef extends { send: (event: infer TEvent) => void }
      ? [TEvent] extends [never]
        ? TFallback
        : TEvent extends EventObject
          ? TEvent
          : TFallback
      : never
    : never;

export type ActorRefLike = Pick<AnyActor, 'sessionId' | 'send' | 'getSnapshot'>;

export type UnknownActorRef = ActorRef<Snapshot<unknown>, EventObject>;

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
        actorSources: TActorMap;
        guards: TGuardMap;
        delays: TDelayMap;
      }
    : never;

export interface ActorScope<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TSystem extends AnyActorSystem = AnyActorSystem,
  TEmitted extends EventObject = EventObject,
  TSendEvent extends EventObject = TEvent
> {
  self: ActorSelf<TSnapshot, TEvent, TEmitted, TSendEvent>;
  id: string;
  sessionId: string;
  logger: (...args: any[]) => void;
  defer: (fn: () => void) => void;
  emit: (event: TEmitted) => void | PromiseLike<void>;
  system: TSystem;
  stopChild: (child: AnyActor) => void;
  actionExecutor: ActionExecutor;
}

export type AnyActorScope = ActorScope<
  any, // TSnapshot
  any, // TEvent
  AnyActorSystem,
  any, // TEmitted
  any // TSendEvent
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

export type ActorLogicTransitionResult<
  TSnapshot extends Snapshot<unknown>,
  TEffect = ExecutableActionObject
> = [nextSnapshot: TSnapshot, effects: TEffect[]];

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
   * to produce a new state and effects.
   *
   * @param snapshot - The current state.
   * @param event - The incoming event.
   * @param actorScope - The actor scope.
   * @returns A tuple of the next state and effects.
   */
  transition: (
    snapshot: TSnapshot,
    event: TEvent,
    actorScope: ActorScope<TSnapshot, TEvent, TSystem, TEmitted>
  ) => ActorLogicTransitionResult<TSnapshot>;
  /**
   * Transition function that produces the initial state and effects.
   *
   * @param actorScope - The actor scope.
   * @param input - The input for the initial state.
   * @returns A tuple of the initial state and effects.
   */
  initialTransition: (
    input: TInput,
    actorScope: ActorScope<TSnapshot, TEvent, TSystem, TEmitted>
  ) => ActorLogicTransitionResult<TSnapshot>;
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
   * @param options - Start metadata, including whether the snapshot was
   *   restored.
   */
  start?: (
    snapshot: TSnapshot,
    actorScope: ActorScope<TSnapshot, TEvent, AnyActorSystem, TEmitted>,
    options?: { restored: boolean }
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
  /**
   * Returns an event that the actor should transition with to recover from an
   * execution error, or `undefined` if the given snapshot cannot handle it.
   * Actor logic without error-recovery semantics can omit this.
   */
  getExecutionErrorEvent?: (
    snapshot: TSnapshot,
    error: unknown
  ) => TEvent | undefined;
}

export interface AnyActorLogic {
  config?: unknown;
  transition(
    snapshot: any,
    event: any,
    actorScope: any
  ): ActorLogicTransitionResult<any>;
  initialTransition(
    input: any,
    actorScope: any
  ): ActorLogicTransitionResult<any>;
  getInitialSnapshot(actorScope: any, input: any): any;
  restoreSnapshot?(persistedState: Snapshot<unknown>, actorScope: any): any;
  start?(snapshot: any, actorScope: any, options?: { restored: boolean }): void;
  getPersistedSnapshot(snapshot: any, options?: unknown): Snapshot<unknown>;
  getExecutionErrorEvent?(snapshot: any, error: unknown): any;
}

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
              infer TSnapshot,
              infer _TEvent,
              infer _TInput,
              infer _TSystem,
              infer _TEmitted
            >
          ? TSnapshot
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
    infer _TSystem,
    infer _TEmitted
  >
    ? TEvent
    : never;

export type EmittedFrom<TLogic extends AnyActorLogic> =
  TLogic extends StateMachine<
    infer _TContext,
    infer _TEvent,
    infer _TChildren,
    infer _TStateValue,
    infer _TTag,
    infer _TInput,
    infer _TOutput,
    infer TEmitted,
    infer _TMeta,
    infer _TStateSchema,
    infer _TActionMap,
    infer _TActorMap,
    infer _TGuardMap,
    infer _TDelayMap
  >
    ? TEmitted
    : [TLogic] extends [AnyStateMachine]
      ? AnyEventObject
      : TLogic extends ActorLogic<
            infer _TSnapshot,
            infer _TEvent,
            infer _TInput,
            infer _TSystem,
            infer TEmitted
          >
        ? TEmitted
        : AnyEventObject;

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

export type SystemRegistry = Record<string, AnyActorLogic>;

export type RegistryKeyForLogic<
  TLogic extends AnyActorLogic,
  TSystemRegistry extends SystemRegistry
> = string extends keyof TSystemRegistry
  ? string
  : Values<{
      [K in keyof TSystemRegistry &
        string]: ActorRefFromLogic<TLogic> extends ActorRefFromLogic<
        TSystemRegistry[K]
      >
        ? K
        : never;
    }>;

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
  [A in TActor as ExtractLiteralString<A['id']>]?: ActorFromLogic<A['logic']>;
};

// Actors that don't have literal string IDs — these are the only ones
// that should appear in the index signature fallback, since actors with
// literal IDs are already covered by ToConcreteChildren.
type NonConcreteActors<TActor extends ProvidedActor> = TActor extends any
  ? ExtractLiteralString<TActor['id']> extends never
    ? TActor
    : never
  : never;

export type ToChildren<TActor extends ProvidedActor> =
  // only proceed further if all configured `src`s are literal strings
  string extends TActor['src']
    ? // TODO: replace `AnyActorRef` with `UnknownActorRef`~
      // or maybe even `TActor["logic"]` since it's possible to configure `{ src: string; logic: SomeConcreteLogic }`
      // TODO: consider adding `| undefined` here
      Record<string, AnyActor>
    : Compute<
        ToConcreteChildren<TActor> &
          {
            include: {
              [id: string]: NonConcreteActors<TActor> extends never
                ? AnyActor | undefined
                : NonConcreteActors<TActor> extends any
                  ?
                      | ActorFromLogic<NonConcreteActors<TActor>['logic']>
                      | undefined
                  : never;
            };
            exclude: unknown;
          }[NonConcreteActors<TActor> extends never ? 'exclude' : 'include']
      >;

export type StateSchema = {
  id?: string;
  route?: unknown;
  states?: Record<string, StateSchema>;
  contextSchema?: StandardSchemaV1;
  input?: unknown;

  // Other types
  // Needed because TS treats objects with all optional properties as a "weak" object
  // https://github.com/statelyai/xstate/issues/5031
  type?: unknown;
  invoke?: unknown;
  on?: unknown;
  entry?: unknown;
  exit?: unknown;
  onDone?: unknown;
  onError?: unknown;
  timeout?: unknown;
  onTimeout?: unknown;
  after?: unknown;
  always?: unknown;
  choice?: unknown;
  meta?: unknown;
  output?: unknown;
  tags?: unknown;
  description?: unknown;
};

export type StateSchemaFrom<T extends AnyStateMachine> =
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
    infer TStateSchema,
    infer _TActionMap,
    infer _TActorMap,
    infer _TGuardMap,
    infer _TDelayMap
  >
    ? TStateSchema
    : never;

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

/** Maps state IDs to their input types based on the StateSchema. */
export type StateIdInputs<
  TSchema extends StateSchema,
  TKey extends string = '(machine)',
  TParentKey extends string | null = null
> = {
  [K in TSchema extends { id: string }
    ? TSchema['id']
    : TParentKey extends null
      ? TKey
      : `${TParentKey}.${TKey}`]: TSchema['input'] extends undefined
    ? undefined
    : TSchema['input'];
} & (TSchema['states'] extends Record<string, StateSchema>
  ? UnionToIntersection<
      Values<{
        [K in keyof TSchema['states'] & string]: StateIdInputs<
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

type ContextFromStateSchema<
  TSchema extends StateSchema,
  TFallbackContext extends MachineContext
> = TSchema['contextSchema'] extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<TSchema['contextSchema']> & MachineContext
  : TFallbackContext;

type ContextFromChildStateValue<
  TChildSchema extends StateSchema,
  TFallbackContext extends MachineContext,
  TChildValue
> = ContextFromStateSchema<TChildSchema, TFallbackContext> &
  StateContextFromStateValue<
    TChildSchema,
    ContextFromStateSchema<TChildSchema, TFallbackContext>,
    TChildValue
  >;

export type StateContextFromStateValue<
  TSchema extends StateSchema,
  TFallbackContext extends MachineContext,
  TStateValue
> = (TSchema['states'] extends Record<string, StateSchema>
  ? TStateValue extends keyof TSchema['states'] & string
    ? ContextFromStateSchema<TSchema['states'][TStateValue], TFallbackContext>
    : TStateValue extends Record<string, unknown>
      ? UnionToIntersection<
          Values<{
            [K in keyof TStateValue &
              keyof TSchema['states'] &
              string]: ContextFromChildStateValue<
              TSchema['states'][K],
              TFallbackContext,
              NonNullable<TStateValue[K]>
            >;
          }>
        >
      : TFallbackContext
  : TFallbackContext) &
  MachineContext;

export type RoutableStateId<TSchema extends StateSchema> =
  | (TSchema extends { route: any; id: string } ? `#${TSchema['id']}` : never)
  | (TSchema['states'] extends Record<string, any>
      ? Values<{
          [K in keyof TSchema['states'] & string]: RoutableStateId<
            TSchema['states'][K]
          >;
        }>
      : never);

export interface StateMachineTypes {
  context: MachineContext;
  events: EventObject;
  actorSources: ProvidedActor;
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
  actorSources: TActor;
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
      : T['states'][S] extends { states: Record<string, StateSchema> }
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

export interface BaseExecutableActionObject {
  params: NonReducibleUnknown;
  args: unknown[];
  exec(
    runtime?: Partial<ActorSystemRuntime>
  ): void | PromiseLike<void> | undefined;
}

/** The terminal result published when an actor completes or errors. */
export type ActorTermination =
  | { status: 'done'; output: unknown; error: undefined }
  | { status: 'error'; output: undefined; error: unknown };

export interface CustomExecutableActionObject<
  TType extends string = string & {}
> extends BaseExecutableActionObject {
  kind: 'action';
  type: TType;
  action: ((...args: any[]) => void | PromiseLike<void>) | undefined;
}

export interface EmitExecutableActionObject<TType extends string = string & {}>
  extends BaseExecutableActionObject {
  kind: 'emit';
  type: TType;
  source: AnyActor;
  event: EventObject & { type: TType };
}

export interface SpawnExecutableActionObject
  extends BaseExecutableActionObject {
  kind: 'builtin';
  type: '@xstate.spawn';
  source: AnyActor | undefined;
  actor: AnyActor;
  id: string;
  logic: AnyActorLogic;
  src: string | AnyActorLogic;
  input: unknown;
  args: Parameters<(typeof builtInActions)['@xstate.spawn']>;
}

export interface StartExecutableActionObject
  extends BaseExecutableActionObject {
  kind: 'builtin';
  type: '@xstate.start';
  source: AnyActor | undefined;
  actor: AnyActor;
  id: string;
  args: Parameters<(typeof builtInActions)['@xstate.start']>;
}

export interface RaiseExecutableActionObject
  extends BaseExecutableActionObject {
  kind: 'builtin';
  type: '@xstate.raise';
  source: AnyActor;
  event: EventObject;
  id: string | undefined;
  delay: number | undefined;
  args: Parameters<(typeof builtInActions)['@xstate.raise']>;
}

export interface SendToExecutableActionObject
  extends BaseExecutableActionObject {
  kind: 'builtin';
  type: '@xstate.sendTo';
  source: AnyActor;
  target: AnyActor;
  event: EventObject;
  id: string | undefined;
  delay: number | undefined;
  args: Parameters<(typeof builtInActions)['@xstate.sendTo']>;
}

export interface CancelExecutableActionObject
  extends BaseExecutableActionObject {
  kind: 'builtin';
  type: '@xstate.cancel';
  source: AnyActor;
  id: string;
  args: Parameters<(typeof builtInActions)['@xstate.cancel']>;
}

export interface StopExecutableActionObject extends BaseExecutableActionObject {
  kind: 'builtin';
  type: '@xstate.stop';
  source: AnyActor;
  actor: AnyActor;
  id: string;
  args: Parameters<(typeof builtInActions)['@xstate.stop']>;
}

/** An executable effect that publishes an actor's terminal result. */
export type TerminateExecutableActionObject = BaseExecutableActionObject & {
  kind: 'builtin';
  type: '@xstate.terminate';
  source: AnyActor;
  actor: AnyActor;
  id: string;
  args: Parameters<(typeof builtInActions)['@xstate.terminate']>;
} & ActorTermination;

export type BuiltInExecutableActionObject = Values<{
  '@xstate.spawn': SpawnExecutableActionObject;
  '@xstate.start': StartExecutableActionObject;
  '@xstate.raise': RaiseExecutableActionObject;
  '@xstate.sendTo': SendToExecutableActionObject;
  '@xstate.cancel': CancelExecutableActionObject;
  '@xstate.stop': StopExecutableActionObject;
  '@xstate.terminate': TerminateExecutableActionObject;
}>;

export type SpecialExecutableAction = BuiltInExecutableActionObject;

type TransitionExecutableActionObject<TType extends string = never> =
  | BuiltInExecutableActionObject
  | EmitExecutableActionObject
  | CustomExecutableActionObject<TType | (string & {})>;

type KnownImplementationKeys<TImplementationMap> =
  string extends keyof TImplementationMap
    ? never
    : Extract<keyof TImplementationMap, string>;

export type ExecutableActionObjectFromLogic<T extends AnyActorLogic> =
  T extends StateMachine<
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
    infer TActionMap,
    any,
    any,
    any
  >
    ? TransitionExecutableActionObject<KnownImplementationKeys<TActionMap>>
    : ExecutableActionObject;

export type ExecutableActionObject<TType extends string = string & {}> =
  | BuiltInExecutableActionObject
  | EmitExecutableActionObject
  | CustomExecutableActionObject<TType>;

export interface ToExecutableAction<T extends ParameterizedObject>
  extends CustomExecutableActionObject<T['type']> {
  type: T['type'];
  params: T['params'];
  action: undefined;
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
  TEmittedEvent extends EventObject,
  TSystemRegistry extends SystemRegistry = SystemRegistry
> = {
  cancel: (id: string) => void;
  raise: (ev: TEvent, options?: { id?: string; delay?: number }) => void;
  spawn: <T extends AnyActorLogic>(
    logic: T,
    options?: {
      input?: InputFrom<T>;
      id?: string;
      syncSnapshot?: boolean;
      registryKey?: RegistryKeyForLogic<T, TSystemRegistry>;
    }
  ) => ActorFromLogic<T>;
  emit: (emittedEvent: TEmittedEvent) => void;
  <T extends (...args: any[]) => any>(fn: T, ...args: Parameters<T>): void;
  log: (...args: any[]) => void;
  sendTo: <TActorRef extends { send: (...args: any[]) => void } | undefined>(
    actorRef: TActorRef,
    event: SendableEventFromActorRef<NoInfer<TActorRef>>,
    options?: { id?: string; delay?: number }
  ) => void;
  stop: (actor?: AnyActor) => void;
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
    actor: AnyActor,
    eventType: string,
    mapper: (event: TEmitted) => TMappedEvent
  ) => AnyActor;
  /**
   * Subscribe to lifecycle events (done/error/snapshot) from an actor. Returns
   * a subscription actor that can be stopped via `enq.stop()`.
   *
   * @param actor - The actor to subscribe to
   * @param mappers - Object with done/error/snapshot mappers, or a single
   *   snapshot mapper function
   */
  subscribeTo: <TActor extends AnyActor, TMappedEvent extends TEvent>(
    actor: TActor,
    mappers:
      | SubscribeToMappers<
          SnapshotFrom<TActor>,
          OutputFrom<TActor>,
          TMappedEvent
        >
      | ((snapshot: SnapshotFrom<TActor>) => TMappedEvent)
  ) => AnyActor;
};

export type Action<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmittedEvent extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TParams = Record<string, unknown> | undefined,
  _TCtx = [TContext] extends [never] ? any : TContext
> = (
  _: {
    context: _TCtx;
    event: TEvent;
    parent: AnyActorRef | undefined;
    self: ActorSelf<
      MachineSnapshot<
        _TCtx & MachineContext,
        TEvent,
        TODO,
        TODO,
        TODO,
        TODO,
        TODO,
        TODO
      >,
      TEvent
    >;
    children: Record<string, AnyActor | undefined>;
    actions: TActionMap;
    actorSources: TActorMap;
    guards: TGuardMap;
    delays: TDelayMap;
    system?: AnyActorSystem;
    params: TParams;
  },
  enqueue: EnqueueObject<TEvent, TEmittedEvent>
) => {
  context?: Partial<_TCtx>;
  children?: Record<string, AnyActor | undefined>;
} | void;

export type AnyAction =
  | Action<
      MachineContext,
      EventObject,
      EventObject,
      Implementations['actions'],
      Implementations['actorSources'],
      Implementations['guards'],
      Implementations['delays']
    >
  | { action: (...args: any[]) => any; args: any[] }
  | AnyEventObject;
