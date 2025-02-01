import {
  EnqueueObject,
  EventObject,
  EventPayloadMap,
  ExtractEventsFromPayloadMap,
  InteropSubscribable,
  Observer,
  Recipe,
  Store,
  StoreCompleteAssigner,
  StoreContext,
  StoreGetters,
  StoreInspectionEvent,
  StorePartialAssigner,
  StoreSnapshot,
  StoreTransition,
  UpdaterFn
} from './types';

const symbolObservable: typeof Symbol.observable = (() =>
  (typeof Symbol === 'function' && Symbol.observable) ||
  '@@observable')() as any;

function toObserver<T>(
  nextHandler?: Observer<T> | ((value: T) => void),
  errorHandler?: (error: any) => void,
  completionHandler?: () => void
): Observer<T> {
  const isObserver = typeof nextHandler === 'object';
  const self = isObserver ? nextHandler : undefined;

  return {
    next: (isObserver ? nextHandler.next : nextHandler)?.bind(self),
    error: (isObserver ? nextHandler.error : errorHandler)?.bind(self),
    complete: (isObserver ? nextHandler.complete : completionHandler)?.bind(
      self
    )
  };
}

function setter<TContext extends StoreContext>(
  context: TContext,
  recipe: Recipe<TContext, TContext>
): TContext {
  return recipe(context);
}

const inspectionObservers = new WeakMap<
  Store<any, any, any>,
  Set<Observer<StoreInspectionEvent>>
>();

function createStoreCore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TGetters extends Record<
    string,
    (context: TContext, getters: any) => any
  > = {},
  TEmitted extends EventObject = EventObject
>(
  initialContext: TContext,
  transitions: TransitionsFromEventPayloadMap<
    TEventPayloadMap,
    TContext,
    TEmitted
  >,
  getters?: TGetters,
  updater?: UpdaterFn<TContext>
): Store<TContext, any, TEmitted, TGetters> {
  type StoreEvent = ExtractEventsFromPayloadMap<TEventPayloadMap>;
  let observers: Set<Observer<StoreSnapshot<TContext, TGetters>>> | undefined;
  let listeners: Map<TEmitted['type'], Set<any>> | undefined;

  const initialSnapshot = {
    context: initialContext,
    status: 'active' as const,
    output: undefined,
    error: undefined,
    ...computeGetters(initialContext, getters)
  } as StoreSnapshot<TContext, TGetters>;

  let currentSnapshot: StoreSnapshot<TContext, TGetters> = initialSnapshot;

  const emit = (ev: TEmitted) => {
    if (!listeners) {
      return;
    }
    const type = ev.type;
    const typeListeners = listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach((listener) => listener(ev));
    }
  };

  const transition = createStoreTransition(transitions, getters, updater);

  function receive(event: StoreEvent) {
    let emitted: TEmitted[];

    [currentSnapshot, emitted] = transition(currentSnapshot, event);

    // Update getters when context changes
    currentSnapshot = {
      ...currentSnapshot,
      ...computeGetters(currentSnapshot.context, getters)
    };

    inspectionObservers.get(store)?.forEach((observer) => {
      observer.next?.({
        type: '@xstate.snapshot',
        event,
        snapshot: currentSnapshot,
        actorRef: store,
        rootId: store.sessionId
      });
    });

    observers?.forEach((o) => o.next?.(currentSnapshot));

    emitted.forEach(emit);
  }

  const store: Store<TContext, StoreEvent, TEmitted, TGetters> = {
    on(emittedEventType, handler) {
      if (!listeners) {
        listeners = new Map();
      }
      let eventListeners = listeners.get(emittedEventType);
      if (!eventListeners) {
        eventListeners = new Set();
        listeners.set(emittedEventType, eventListeners);
      }
      const wrappedHandler = handler.bind(undefined);
      eventListeners.add(wrappedHandler);

      return {
        unsubscribe() {
          eventListeners.delete(wrappedHandler);
        }
      };
    },
    sessionId: uniqueId(),
    send(event) {
      inspectionObservers.get(store)?.forEach((observer) => {
        observer.next?.({
          type: '@xstate.event',
          event,
          sourceRef: undefined,
          actorRef: store,
          rootId: store.sessionId
        });
      });
      receive(event as unknown as StoreEvent);
    },
    getSnapshot() {
      return currentSnapshot;
    },
    getInitialSnapshot() {
      return initialSnapshot;
    },
    subscribe(observerOrFn) {
      const observer = toObserver(observerOrFn);
      observers ??= new Set();
      observers.add(observer);

      return {
        unsubscribe() {
          return observers?.delete(observer);
        }
      };
    },
    [symbolObservable](): InteropSubscribable<
      StoreSnapshot<TContext, TGetters>
    > {
      return this;
    },
    inspect: (observerOrFn) => {
      const observer = toObserver(observerOrFn);
      inspectionObservers.set(
        store,
        inspectionObservers.get(store) ?? new Set()
      );
      inspectionObservers.get(store)!.add(observer);

      observer.next?.({
        type: '@xstate.actor',
        actorRef: store,
        rootId: store.sessionId
      });

      observer.next?.({
        type: '@xstate.snapshot',
        snapshot: initialSnapshot,
        event: { type: '@xstate.init' },
        actorRef: store,
        rootId: store.sessionId
      });

      return {
        unsubscribe() {
          return inspectionObservers.get(store)?.delete(observer);
        }
      };
    }
  };

  return store;
}

type TransitionsFromEventPayloadMap<
  TEventPayloadMap extends EventPayloadMap,
  TContext extends StoreContext,
  TEmitted extends EventObject
> = {
  [K in keyof TEventPayloadMap & string]: StoreTransition<
    TContext,
    { type: K } & TEventPayloadMap[K],
    TEmitted
  >;
};

/**
 * Creates a **store** that has its own internal state and can be sent events
 * that update its internal state based on transitions. The store now supports
 * computed getters that automatically update when context changes.
 *
 * @example
 *
 * ```ts
 * const store = createStore({
 *   types: {
 *     // ...
 *   },
 *   context: { count: 0 },
 *   on: {
 *     inc: (context, event: { by: number }) => {
 *       return {
 *         count: context.count + event.by
 *       };
 *     }
 *   },
 *   getters: {
 *     doubled: (context) => context.count * 2
 *   }
 * });
 *
 * store.subscribe((snapshot) => {
 *   console.log(snapshot);
 * });
 *
 * store.send({ type: 'inc', by: 5 });
 * // Logs { context: { count: 5, doubled: 10 }, status: 'active', ... }
 * ```
 *
 * @param config - Store configuration object containing:
 *
 *   - `context`: Initial context state
 *   - `on`: Event transition handlers
 *   - `getters`: Computed properties derived from context and other getters
 *   - `types`: Optional type definitions for emitted events
 */
export function createStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap = {},
  TGetters extends Record<string, any> = {}
>(config: {
  context: TContext;
  on: TransitionsFromEventPayloadMap<TEventPayloadMap, TContext, any>;
  types?: { emitted?: EventObject };
  getters?: StoreGetters<TContext, TGetters>;
}): Store<TContext, any, any, TGetters>;

/**
 * Creates a **store** that has its own internal state and can be sent events
 * that update its internal state based on transitions.
 *
 * @example
 *
 * ```ts
 * const store = createStore(
 *   // Initial context
 *   { count: 0 },
 *   // Transitions
 *   {
 *     inc: (context, event: { by: number }) => {
 *       return {
 *         count: context.count + event.by
 *       };
 *     }
 *   },
 *   // Getters (optional)
 *   {
 *     sum: (context, getters) => context.count + getters.product
 *   }
 * );
 *
 * store.subscribe((snapshot) => {
 *   console.log(snapshot);
 * });
 *
 * store.send({ type: 'inc', by: 5 });
 * // Logs { context: { count: 5 }, status: 'active', ... }
 * ```
 */
export function createStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap = {},
  TGetters extends Record<string, (context: TContext, getters: any) => any> = {}
>(
  initialContext: TContext,
  transitions: {
    [K in keyof TEventPayloadMap & string]: StoreTransition<
      TContext,
      { type: K } & TEventPayloadMap[K],
      any
    >;
  },
  getters?: TGetters
): Store<
  TContext,
  any,
  any,
  { [K in keyof TGetters]: ReturnType<TGetters[K]> }
>;

export function createStore(
  initialContextOrConfig: any,
  transitions?: any,
  getters?: any
) {
  if (typeof initialContextOrConfig === 'object' && transitions === undefined) {
    return createStoreCore(
      initialContextOrConfig.context,
      initialContextOrConfig.on,
      initialContextOrConfig.getters ?? {}
    );
  }
  return createStoreCore(initialContextOrConfig, transitions, getters ?? {});
}

/**
 * Creates a `Store` with a provided producer (such as Immer's `producer(…)` A
 * store has its own internal state and can receive events.
 *
 * @example
 *
 * ```ts
 * import { produce } from 'immer';
 *
 * const store = createStoreWithProducer(produce, {
 *   // Initial context
 *   { count: 0 },
 *   // Transitions
 *   {
 *     on: {
 *       inc: (context, event: { by: number }) => {
 *         context.count += event.by;
 *       }
 *     }
 *   }
 * });
 *
 * store.subscribe((snapshot) => {
 *   console.log(snapshot);
 * });
 *
 * store.send({ type: 'inc', by: 5 });
 * // Logs { context: { count: 5 }, status: 'active', ... }
 * ```
 */
export function createStoreWithProducer<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject = EventObject,
  TGetters extends Record<string, (context: TContext, getters: any) => any> = {}
>(
  producer: NoInfer<
    (context: TContext, recipe: (context: TContext) => void) => TContext
  >,
  config: {
    context: TContext;
    on: {
      [K in keyof TEventPayloadMap & string]: (
        context: NoInfer<TContext>,
        event: { type: K } & TEventPayloadMap[K],
        enqueue: EnqueueObject<TEmitted>
      ) => void;
    };
    getters?: TGetters;
  }
): Store<
  TContext,
  ExtractEventsFromPayloadMap<TEventPayloadMap>,
  TEmitted,
  TGetters
>;

export function createStoreWithProducer<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject = EventObject,
  TGetters extends Record<string, (context: TContext, getters: any) => any> = {}
>(
  producer: NoInfer<
    (context: TContext, recipe: (context: TContext) => void) => TContext
  >,
  initialContext: TContext,
  transitions: {
    [K in keyof TEventPayloadMap & string]: (
      context: NoInfer<TContext>,
      event: { type: K } & TEventPayloadMap[K],
      enqueue: EnqueueObject<TEmitted>
    ) => void;
  },
  getters?: TGetters
): Store<
  TContext,
  ExtractEventsFromPayloadMap<TEventPayloadMap>,
  TEmitted,
  TGetters
>;

export function createStoreWithProducer<
  TContext extends StoreContext,
  _TEventPayloadMap extends EventPayloadMap,
  _TEmitted extends EventObject = EventObject,
  TGetters extends Record<string, (context: TContext, getters: any) => any> = {}
>(
  producer: (
    context: TContext,
    recipe: (context: TContext) => void
  ) => TContext,
  initialContextOrConfig: any,
  transitions?: any,
  getters?: TGetters
) {
  if (
    typeof initialContextOrConfig === 'object' &&
    'context' in initialContextOrConfig &&
    'on' in initialContextOrConfig
  ) {
    // Config object style
    return createStoreCore(
      initialContextOrConfig.context,
      initialContextOrConfig.on,
      initialContextOrConfig.getters,
      producer
    );
  }

  // Parameter style (initialContext, transitions, getters?)
  return createStoreCore(
    initialContextOrConfig, // initialContext
    transitions, // transitions
    getters, // optional getters
    producer
  );
}

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}

/**
 * Creates a store function, which is a function that accepts the current
 * snapshot and an event and returns a new snapshot.
 *
 * @param transitions
 * @param updater
 * @returns
 */
export function createStoreTransition<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject = EventObject,
  TGetters extends Record<string, (context: TContext, getters: any) => any> = {}
>(
  transitions: TransitionsFromEventPayloadMap<
    TEventPayloadMap,
    TContext,
    TEmitted
  >,
  getters?: TGetters,
  updater?: (
    context: TContext,
    recipe: (context: TContext) => TContext
  ) => TContext
) {
  return (
    snapshot: StoreSnapshot<TContext, TGetters>,
    event: ExtractEventsFromPayloadMap<TEventPayloadMap>
  ): [StoreSnapshot<TContext, TGetters>, TEmitted[]] => {
    type StoreEvent = ExtractEventsFromPayloadMap<TEventPayloadMap>;
    let currentContext = snapshot.context;
    const assigner = transitions?.[event.type as StoreEvent['type']];
    const emitted: TEmitted[] = [];

    const enqueue = {
      emit: (ev: TEmitted) => {
        emitted.push(ev);
      }
    };

    if (!assigner) {
      return [snapshot, emitted];
    }

    if (typeof assigner === 'function') {
      currentContext = updater
        ? updater(currentContext, (draftContext) =>
            (
              assigner as StoreCompleteAssigner<TContext, StoreEvent, TEmitted>
            )?.(draftContext, event, enqueue)
          )
        : setter(currentContext, (draftContext) =>
            Object.assign(
              {},
              currentContext,
              assigner?.(
                draftContext,
                event as any, // TODO: help me
                enqueue
              )
            )
          );
    } else {
      const partialUpdate: Record<string, unknown> = {};
      for (const key of Object.keys(assigner)) {
        const propAssignment = assigner[key];
        partialUpdate[key] =
          typeof propAssignment === 'function'
            ? (
                propAssignment as StorePartialAssigner<
                  TContext,
                  StoreEvent,
                  typeof key,
                  TEmitted
                >
              )(currentContext, event, enqueue)
            : propAssignment;
      }
      currentContext = Object.assign({}, currentContext, partialUpdate);
    }

    return [
      {
        ...snapshot,
        context: currentContext,
        ...computeGetters(currentContext, getters)
      } as StoreSnapshot<TContext, TGetters>,
      emitted
    ];
  };
}

// create a unique 6-char id
function uniqueId() {
  return Math.random().toString(36).slice(6);
}

/**
 * @internal
 * Computes getter values using proxy-based dependency tracking.
 * Memoizes results until context or dependent getters change.
 */
const computeGetters = <
  TContext extends StoreContext,
  TGetters extends Record<string, any>
>(
  context: TContext,
  getters?: StoreGetters<TContext, TGetters>
): TGetters => {
  const computed = {} as TGetters;

  if (getters) {
    const cache = new Map<keyof TGetters, any>();
    const getterKeys = Object.keys(getters) as Array<keyof TGetters>;

    const getterProxy = new Proxy(computed, {
      get(_, prop: string) {
        // Change to string type
        const key = prop as keyof TGetters; // Add type assertion
        if (!cache.has(key)) {
          cache.set(
            key,
            getters[key](
              context,
              new Proxy(computed, {
                get: (_, depProp: string) => {
                  // Change to string type
                  const depKey = depProp as keyof TGetters; // Add type assertion
                  return computed[depKey];
                }
              })
            )
          );
        }
        return cache.get(key);
      }
    });

    getterKeys.forEach((key) => {
      computed[key] = getterProxy[key as string];
    });
  }

  return computed;
};
