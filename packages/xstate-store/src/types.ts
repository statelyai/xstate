export type EventPayloadMap = Record<string, {} | null | undefined>;

export type ExtractEvents<T extends EventPayloadMap> = Values<{
  [K in keyof T & string]: T[K] & { type: K };
}>;

type AllKeys<T> = T extends any ? keyof T : never;

type EmitterFunction<TEmittedEvent extends EventObject> = (
  ...args: { type: TEmittedEvent['type'] } extends TEmittedEvent
    ? AllKeys<TEmittedEvent> extends 'type'
      ? []
      : [DistributiveOmit<TEmittedEvent, 'type'>?]
    : [DistributiveOmit<TEmittedEvent, 'type'>]
) => void;

export type EnqueueObject<TEmittedEvent extends EventObject> = {
  emit: {
    [E in TEmittedEvent as E['type']]: EmitterFunction<E>;
  };
  effect: (fn: () => void) => void;
};

export type StoreEffect<TEmitted extends EventObject> = (() => void) | TEmitted;

export type StoreAssigner<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
> = (
  context: TContext,
  event: TEvent,
  enq: EnqueueObject<TEmitted>
) => TContext | void;

export type StoreProducerAssigner<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
> = (context: TContext, event: TEvent, enq: EnqueueObject<TEmitted>) => void;

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

export type StoreSnapshot<TContext> = Snapshot<undefined> & {
  context: TContext;
};

/**
 * An actor-like object that:
 *
 * - Has its own state
 * - Can receive events
 * - Is observable
 */
export interface Store<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
> extends Subscribable<StoreSnapshot<TContext>>,
    InteropObservable<StoreSnapshot<TContext>>,
    BaseAtom<StoreSnapshot<TContext>> {
  send: (event: ExtractEvents<TEventPayloadMap>) => void;
  getSnapshot: () => StoreSnapshot<TContext>;
  /** @alias getSnapshot */
  get: () => StoreSnapshot<TContext>;
  getInitialSnapshot: () => StoreSnapshot<TContext>;
  /**
   * Subscribes to [inspection events](https://stately.ai/docs/inspection) from
   * the store.
   *
   * Inspectors that call `store.inspect(…)` will immediately receive an
   * "@xstate.actor" inspection event.
   */
  inspect: (
    observer:
      | Observer<StoreInspectionEvent>
      | ((inspectionEvent: StoreInspectionEvent) => void)
  ) => Subscription;
  sessionId: string;
  on: <TType extends TEmitted['type'] | '*'>(
    type: TType,
    handler: (
      emitted: Compute<
        TEmitted & (TType extends '*' ? unknown : { type: TType })
      >
    ) => void
  ) => Subscription;
  /**
   * A proxy object that allows you to send events to the store without manually
   * constructing event objects.
   *
   * @example
   *
   * ```ts
   * // Equivalent to:
   * // store.send({ type: 'increment', by: 1 });
   * store.trigger.increment({ by: 1 });
   * ```
   */
  trigger: {
    [K in keyof TEventPayloadMap]: IsEmptyObject<
      DistributiveOmit<TEventPayloadMap[K], 'type'>
    > extends true
      ? () => void
      : (eventPayload: DistributiveOmit<TEventPayloadMap[K], 'type'>) => void;
  };
  select<TSelected>(
    selector: Selector<TContext, TSelected>,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ): Selection<TSelected>;
  /**
   * Returns the next state and effects for the given state and event, as a
   * tuple.
   *
   * @example
   *
   * ```ts
   * const [nextState, effects] = store.transition(store.getSnapshot(), {
   *   type: 'increment',
   *   by: 1
   * });
   * ```
   */
  transition: StoreTransition<
    TContext,
    ExtractEvents<TEventPayloadMap>,
    TEmitted
  >;
  /**
   * Extends the store with additional functionality via a store extension.
   *
   * @example
   *
   * ```ts
   * const store = createStore({
   *   context: { count: 0 },
   *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
   * }).with(undoRedo());
   *
   * store.trigger.inc();
   * store.trigger.undo(); // undoes the increment
   * ```
   */
  with<TNewEventPayloadMap extends EventPayloadMap>(
    extension: StoreExtension<
      TContext,
      TEventPayloadMap,
      TNewEventPayloadMap,
      TEmitted
    >
  ): Store<TContext, TEventPayloadMap & TNewEventPayloadMap, TEmitted>;
}

export type StoreTransition<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
> = (
  state: StoreSnapshot<TContext>,
  event: TEvent
) => [StoreSnapshot<TContext>, StoreEffect<TEmitted>[]];

export type StoreConfig<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap
> = {
  context: TContext;
  emits?: {
    [K in keyof TEmitted]: (payload: TEmitted[K]) => void;
  };
  on: {
    [K in keyof TEventPayloadMap & string]: StoreAssigner<
      TContext,
      { type: K } & TEventPayloadMap[K],
      ExtractEvents<TEmitted>
    >;
  };
};

export type SpecificStoreConfig<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
> = {
  context: TContext;
  emits?: {
    [E in TEmitted as E['type']]: (payload: E) => void;
  };
  on: {
    [E in TEvent as E['type']]: StoreAssigner<TContext, E, TEmitted>;
  };
};

type IsEmptyObject<T> = T extends Record<string, never> ? true : false;

type Compute<A> = A extends any ? { [K in keyof A]: A[K] } : never;

export type AnyStore = Store<any, any, any>;

export type SnapshotFromStore<TStore extends Store<any, any, any>> =
  TStore extends Store<infer TContext, any, any>
    ? StoreSnapshot<TContext>
    : never;

/**
 * Extract the type of events from a `Store`.
 *
 * @example
 *
 * ```ts
 * const store = createStore(
 *   { count: 0 },
 *   {
 *     inc: (context, event: { by: number }) => ({
 *       count: context.count + event.by
 *     }),
 *     dec: (context, event: { by: number }) => ({
 *       count: context.count - event.by
 *     })
 *   }
 * );
 * type StoreEvent = EventFromStore<typeof store>;
 * //   ^? { type: 'inc', by: number } | { type: 'dec', by: number }
 * ```
 *
 * @example
 *
 * Using utility types derived from `EventFromStore` to create individual
 * type-safe event transition functions for a store:
 *
 * ```ts
 * import {
 *   createStore,
 *   type EventFromStore,
 *   type Store
 * } from '@xstate/store';
 *
 * // Extract the event where `Type` matches the event's `type` from the given
 * // `Store`.
 * type EventByType<
 *   TStore extends Store<any, any>,
 *   Type extends EventFromStore<TStore>['type']
 * > = Extract<EventFromStore<TStore>, { type: Type }>;
 *
 * // Extract a specific store event's "input" type (the event type without the
 * // `type` property).
 * type EventInputByType<
 *   TStore extends Store<any, any>,
 *   Type extends EventFromStore<TStore>['type']
 * > = Omit<EventByType<TStore, Type>, 'type'>;
 *
 * const store = createStore(
 *   { count: 0 },
 *   {
 *     add: (context, event: { addend: number }) => ({
 *       count: context.count + event.addend
 *     }),
 *     multiply: (context, event: { multiplier: number }) => ({
 *       count: context.count * event.multiplier
 *     })
 *   }
 * );
 *
 * const add = (input: EventInputByType<typeof store, 'add'>) =>
 *   store.send({ type: 'add', addend: input.addend });
 *
 * add({ addend: 1 }); // sends { type: 'add', addend: 1 }
 *
 * const multiply = (input: EventInputByType<typeof store, 'multiply'>) =>
 *   store.send({ type: 'multiply', multiplier: input.multiplier });
 *
 * multiply({ multiplier: 2 }); // sends { type: 'multiply', multiplier: 2 }
 * ```
 */
export type EventFromStore<TStore extends Store<any, any, any>> =
  TStore extends Store<infer _TContext, infer TEventPayloadMap, infer _TEmitted>
    ? ExtractEvents<TEventPayloadMap>
    : never;

// Copied from XState core
// -----------------------

export interface InteropSubscribable<T> {
  subscribe(observer: Observer<T>): Subscription;
}

interface InteropObservable<T> {
  [Symbol.observable]: () => InteropSubscribable<T>;
}

// Based on RxJS types
export type Observer<T> = {
  next?: (value: T) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
};

export interface Subscription {
  unsubscribe(): void;
}

export interface Subscribable<T> extends InteropSubscribable<T> {
  subscribe(observer: Observer<T>): Subscription;
  subscribe(
    next: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription;
}

// Same as MachineContext (for now)
export type StoreContext = Record<string, any>;

/** The full definition of an event, with a string `type`. */
export type EventObject = {
  /** The type of event that is sent. */
  type: string;
};
type Values<T> = T[keyof T];

export type StoreInspectionEvent =
  | StoreInspectedSnapshotEvent
  | StoreInspectedEventEvent
  | StoreInspectedActorEvent;

interface StoreBaseInspectionEventProperties {
  rootId: string; // the session ID of the root
  /**
   * The relevant actorRef for the inspection event.
   *
   * - For snapshot events, this is the `actorRef` of the snapshot.
   * - For event events, this is the target `actorRef` (recipient of event).
   * - For actor events, this is the `actorRef` of the registered actor.
   */
  actorRef: ActorRefLike;
}

export interface StoreInspectedSnapshotEvent
  extends StoreBaseInspectionEventProperties {
  type: '@xstate.snapshot';
  event: AnyEventObject; // { type: string, ... }
  snapshot: Snapshot<unknown>;
}

export interface StoreInspectedActionEvent
  extends StoreBaseInspectionEventProperties {
  type: '@xstate.action';
  action: {
    type: string;
    params: Record<string, unknown>;
  };
}

export interface StoreInspectedEventEvent
  extends StoreBaseInspectionEventProperties {
  type: '@xstate.event';
  sourceRef: AnyStore | undefined;
  event: AnyEventObject; // { type: string, ... }
}

interface AnyEventObject {
  type: string;
  [key: string]: any;
}

export interface StoreInspectedActorEvent
  extends StoreBaseInspectionEventProperties {
  type: '@xstate.actor';
}

// export type ActorRefLike = Pick<
//   AnyActorRef,
//   'sessionId' | 'send' | 'getSnapshot'
// >;

export type ActorRefLike = {
  sessionId: string;
  // https://github.com/statelyai/xstate/pull/5037/files#r1717036732
  send: (event: any) => void;
  getSnapshot: () => any;
};

export type Selector<TContext, TSelected> = (context: TContext) => TSelected;

export type Selection<TSelected> = Readable<TSelected>;

export interface Readable<T> extends Subscribable<T> {
  get: () => T;
}

export interface BaseAtom<T> extends Subscribable<T>, Readable<T> {}

export interface InternalBaseAtom<T> extends Subscribable<T>, Readable<T> {
  /** @internal */
  _snapshot: T;
  /** @internal */
  _update(getValue?: T | ((snapshot: T) => T)): boolean;
}

export interface Atom<T> extends BaseAtom<T> {
  /** Sets the value of the atom using a function. */
  set(fn: (prevVal: T) => T): void;
  /** Sets the value of the atom. */
  set(value: T): void;
}

export interface AtomOptions<T> {
  compare?: (prev: T, next: T) => boolean;
}

export type AnyAtom = BaseAtom<any>;

/**
 * An atom that is read-only and cannot be set.
 *
 * @example
 *
 * ```ts
 * const atom = createAtom(() => 42);
 * // @ts-expect-error - Cannot set a readonly atom
 * atom.set(43);
 * ```
 */
export interface ReadonlyAtom<T> extends BaseAtom<T> {}

/** A version of `Omit` that works with distributive types. */
type DistributiveOmit<T, K extends PropertyKey> = T extends any
  ? Omit<T, K>
  : never;

export type StoreLogic<
  TSnapshot extends StoreSnapshot<any>,
  TEvent extends EventObject,
  TEmitted extends EventObject
> = {
  getInitialSnapshot: () => TSnapshot;
  transition: (
    snapshot: TSnapshot,
    event: TEvent
  ) => [TSnapshot, StoreEffect<TEmitted>[]];
};
export type AnyStoreLogic = StoreLogic<any, any, any>;

/**
 * A store extension that transforms store logic, optionally adding new events.
 *
 * @example
 *
 * ```ts
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * }).with(undoRedo());
 * ```
 */
export type StoreExtension<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TNewEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
> = (
  logic: StoreLogic<
    StoreSnapshot<TContext>,
    ExtractEvents<TEventPayloadMap>,
    TEmitted
  >
) => StoreLogic<
  StoreSnapshot<TContext>,
  ExtractEvents<TEventPayloadMap> | ExtractEvents<TNewEventPayloadMap>,
  TEmitted
>;

export type AnyStoreConfig = StoreConfig<any, any, any>;
export type EventFromStoreConfig<TStore extends AnyStoreConfig> =
  TStore extends StoreConfig<any, infer TEventPayloadMap, any>
    ? ExtractEvents<TEventPayloadMap>
    : never;

export type EmitsFromStoreConfig<TStore extends AnyStoreConfig> =
  TStore extends StoreConfig<any, any, infer TEmitted>
    ? ExtractEvents<TEmitted>
    : never;

export type ContextFromStoreConfig<TStore extends AnyStoreConfig> =
  TStore extends StoreConfig<infer TContext, any, any> ? TContext : never;
