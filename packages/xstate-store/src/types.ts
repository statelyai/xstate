export type EventPayloadMap = Record<string, {} | null | undefined>;

export type ExtractEventsFromPayloadMap<T extends EventPayloadMap> = Values<{
  [K in keyof T & string]: T[K] & { type: K };
}>;

export type Recipe<T, TReturn> = (state: T) => TReturn;

export type EnqueueObject<TEmittedEvent extends EventObject> = {
  emit: {
    [K in TEmittedEvent['type']]: (
      payload: Omit<TEmittedEvent & { type: K }, 'type'>
    ) => void;
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
  TContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
> extends Subscribable<StoreSnapshot<TContext>>,
    InteropObservable<StoreSnapshot<TContext>> {
  send: (event: TEvent) => void;
  getSnapshot: () => StoreSnapshot<TContext>;
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
  on: <TEmittedType extends TEmitted['type']>(
    eventType: TEmittedType,
    emittedEventHandler: (
      ev: Compute<TEmitted & { type: TEmittedType }>
    ) => void
  ) => Subscription;
  /**
   * A proxy object that allows you to send events to the store without manually
   * constructing event objects.
   *
   * @example
   *
   * ```ts
   * // Instead of:
   * store.send({ type: 'increment', by: 1 });
   *
   * // You can trigger the event:
   * store.trigger.increment({ by: 1 });
   * ```
   */
  trigger: {
    [K in TEvent['type'] & string]: IsEmptyObject<
      Omit<{ type: K } & TEvent, 'type'>
    > extends true
      ? () => Omit<{ type: K } & TEvent, 'type'>
      : (eventPayload: Omit<{ type: K } & TEvent, 'type'>) => void;
  };
}

export type IsEmptyObject<T> = T extends Record<string, never> ? true : false;

export type AnyStore = Store<any, any, any>;

export type Compute<A> = { [K in keyof A]: A[K] };

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
  TStore extends Store<infer _TContext, infer TEvent, infer _TEmitted>
    ? TEvent
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

/** @deprecated Use `StoreInspectionEvent` instead. */
export type InspectionEvent = StoreInspectionEvent;

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

export type Prop<T, K> = K extends keyof T ? T[K] : never;

export type Cast<A, B> = A extends B ? A : B;

export type EventMap<TEvent extends EventObject> = {
  [K in TEvent['type']]: TEvent & { type: K };
};
