export type EventPayloadMap = Record<string, {} | null | undefined>;

export type ExtractEventsFromPayloadMap<T extends EventPayloadMap> = Values<{
  [K in keyof T & string]: T[K] & { type: K };
}>;

export type Recipe<T, TReturn> = (state: T) => TReturn;

export type StoreAssigner<
  TContext extends StoreContext,
  TEvent extends EventObject
> = (context: TContext, event: TEvent) => Partial<TContext>;
export type StoreCompleteAssigner<TContext, TEvent extends EventObject> = (
  ctx: TContext,
  ev: TEvent
) => TContext;
export type StorePartialAssigner<
  TContext,
  TEvent extends EventObject,
  K extends keyof TContext
> = (ctx: TContext, ev: TEvent) => Partial<TContext>[K];
export type StorePropertyAssigner<TContext, TEvent extends EventObject> = {
  [K in keyof TContext]?:
    | TContext[K]
    | StorePartialAssigner<TContext, TEvent, K>;
};

export interface StoreSnapshot<TContext> {
  status: 'active';
  context: TContext;
  output: undefined;
  error: undefined;
}

/**
 * An actor-like object that:
 * - has its own state
 * - can receive events
 * - is observable
 */
export interface Store<TContext, Ev extends EventObject>
  extends Subscribable<StoreSnapshot<TContext>>,
    InteropObservable<StoreSnapshot<TContext>> {
  send: (event: Ev) => void;
  getSnapshot: () => StoreSnapshot<TContext>;
  getInitialSnapshot: () => StoreSnapshot<TContext>;
}

export type SnapshotFromStore<TStore extends Store<any, any>> =
  TStore extends Store<infer TContext, any> ? StoreSnapshot<TContext> : never;

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

/**
 * The full definition of an event, with a string `type`.
 */
export type EventObject = {
  /**
   * The type of event that is sent.
   */
  type: string;
};
type Values<T> = T[keyof T];
