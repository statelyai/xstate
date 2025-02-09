import {
  EnqueueObject,
  EventObject,
  EventPayloadMap,
  ExtractEvents,
  InteropSubscribable,
  Observer,
  Producer,
  Recipe,
  Store,
  StoreAssigner,
  StoreContext,
  StoreEffect,
  StoreInspectionEvent,
  StoreProducerAssigner,
  StoreSnapshot,
  StoreGetters,
  ResolvedGetters
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

/**
 * Updates a context object using a recipe function.
 *
 * @param context - The current context
 * @param recipe - A function that describes how to update the context
 * @returns The updated context
 */
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
  TGetters extends Record<string, (context: TContext, getters: any) => any>,
  TEmitted extends EventObject = EventObject
>(
  initialContext: TContext,
  transitions: TransitionsFromEventPayloadMap<
    TEventPayloadMap,
    TContext,
    TEmitted
  >,
  getters?: TGetters,
  producer?: Producer<TContext>
): Store<TContext, ExtractEvents<TEventPayloadMap>, TEmitted, TGetters> {
  type StoreEvent = ExtractEvents<TEventPayloadMap>;
  let observers: Set<Observer<StoreSnapshot<TContext, TGetters>>> | undefined;
  let listeners: Map<TEmitted['type'], Set<any>> | undefined;

  const initialSnapshot: StoreSnapshot<TContext, TGetters> = {
    context: initialContext,
    status: 'active',
    output: undefined,
    error: undefined,
    ...computeGetters(initialContext, getters)
  };
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

  const transition = createStoreTransition(transitions, producer);

  function receive(event: StoreEvent) {
    const [newContext, effects] = transition(currentSnapshot.context, event);

    currentSnapshot = {
      ...currentSnapshot,
      context: newContext,
      ...computeGetters(newContext, getters)
    } as StoreSnapshot<TContext, TGetters>;

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

    for (const effect of effects) {
      if (typeof effect === 'function') {
        effect();
      } else {
        emit(effect);
      }
    }
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
    },
    trigger: {} as any
  };

  (store as any).trigger = new Proxy(
    {} as Store<TContext, StoreEvent, TEmitted>['trigger'],
    {
      get: (_, eventType: string) => {
        return (payload: any) => {
          store.send({
            type: eventType,
            ...payload
          });
        };
      }
    }
  );

  return store;
}

export type TransitionsFromEventPayloadMap<
  TEventPayloadMap extends EventPayloadMap,
  TContext extends StoreContext,
  TEmitted extends EventObject
> = {
  [K in keyof TEventPayloadMap & string]: StoreAssigner<
    TContext,
    {
      type: K;
    } & TEventPayloadMap[K],
    TEmitted
  >;
};

type CreateStoreParameterTypes<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap,
  TGetters extends Record<string, any> = {}
> = [
  definition: {
    context: TContext;
    emits?: {
      [K in keyof TEmitted & string]: (payload: TEmitted[K]) => void;
    };
    on: {
      [K in keyof TEventPayloadMap & string]: StoreAssigner<
        NoInfer<TContext>,
        { type: K } & TEventPayloadMap[K],
        ExtractEvents<TEmitted>
      >;
    };
    getters?: StoreGetters<TContext, TGetters>;
  }
];

type CreateStoreReturnType<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap,
  TGetters extends Record<string, any> = {}
> = Store<
  TContext,
  ExtractEvents<TEventPayloadMap>,
  ExtractEvents<TEmitted>,
  TGetters
>;

/**
 * Creates a **store** that has its own internal state and can be sent events
 * that update its internal state based on transitions.
 *
 * @example
 *
 * ```ts
 * const store = createStore({
 *   context: { count: 0 },
 *   on: {
 *     inc: (context, event: { by: number }) => ({
 *       count: context.count + event.by
 *     })
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
 *
 * @param config - The store configuration object
 * @param config.context - The initial state of the store
 * @param config.on - An object mapping event types to transition functions
 * @returns A store instance with methods to send events and subscribe to state
 *   changes
 */
function _createStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap,
  TGetters extends Record<string, any> = {}
>(
  ...[{ context, on, getters }]: CreateStoreParameterTypes<
    TContext,
    TEventPayloadMap,
    TEmitted,
    TGetters
  >
): CreateStoreReturnType<TContext, TEventPayloadMap, TEmitted, TGetters> {
  return createStoreCore(context, on, getters);
}

export const createStore: {
  // those overloads are exactly the same, we only duplicate them so TypeScript can:
  // 1. assign contextual parameter types during inference attempt for the first overload when the source object is still context-sensitive and often non-inferrable
  // 2. infer correctly during inference attempt for the second overload when the parameter types are already "known"
  <
    TContext extends StoreContext,
    TEventPayloadMap extends EventPayloadMap,
    TEmitted extends EventPayloadMap,
    TGetters extends Record<string, any> = {}
  >(
    ...args: CreateStoreParameterTypes<
      TContext,
      TEventPayloadMap,
      TEmitted,
      TGetters
    >
  ): CreateStoreReturnType<TContext, TEventPayloadMap, TEmitted, TGetters>;
  <
    TContext extends StoreContext,
    TEventPayloadMap extends EventPayloadMap,
    TEmitted extends EventPayloadMap,
    TGetters extends Record<string, any> = {}
  >(
    ...args: CreateStoreParameterTypes<
      TContext,
      TEventPayloadMap,
      TEmitted,
      TGetters
    >
  ): CreateStoreReturnType<TContext, TEventPayloadMap, TEmitted, TGetters>;
} = _createStore;

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
 *   context: { count: 0 },
 *   on: {
 *     inc: (context, event: { by: number }) => {
 *       context.count += event.by;
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
  TEmittedPayloadMap extends EventPayloadMap,
  TGetters extends Record<string, any> = {}
>(
  producer: NoInfer<Producer<TContext>>,
  config: {
    context: TContext;
    on: {
      [K in keyof TEventPayloadMap & string]: (
        context: NoInfer<TContext>,
        event: { type: K } & TEventPayloadMap[K],
        enqueue: EnqueueObject<ExtractEvents<TEmittedPayloadMap>>
      ) => void;
    };
    getters?: StoreGetters<TContext, TGetters>;
  }
): Store<
  TContext,
  ExtractEvents<TEventPayloadMap>,
  ExtractEvents<TEmittedPayloadMap>,
  TGetters
> {
  return createStoreCore(config.context, config.on, config.getters, producer);
}

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}

/**
 * Creates a store transition function that handles state updates based on
 * events.
 *
 * @param transitions - An object mapping event types to transition functions
 * @param producer - Optional producer function (e.g., Immer's produce) for
 *   immutable updates
 * @returns A transition function that takes a snapshot and event and returns a
 *   new snapshot with effects
 */
export function createStoreTransition<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(
  transitions: {
    [K in keyof TEventPayloadMap & string]: StoreAssigner<
      TContext,
      { type: K } & TEventPayloadMap[K],
      TEmitted
    >;
  },
  producer?: Producer<TContext>
) {
  return (
    currentContext: TContext,
    event: ExtractEvents<TEventPayloadMap>
  ): [TContext, StoreEffect<TEmitted>[]] => {
    type StoreEvent = ExtractEvents<TEventPayloadMap>;
    const assigner = transitions?.[event.type as StoreEvent['type']];
    const effects: StoreEffect<TEmitted>[] = [];

    const enqueue: EnqueueObject<TEmitted> = {
      emit: new Proxy({} as any, {
        get: (_, eventType: string) => {
          return (payload: any) => {
            effects.push({
              ...payload,
              type: eventType
            });
          };
        }
      }),
      effect: (fn) => {
        effects.push(fn);
      }
    };

    if (!assigner) {
      return [currentContext, effects];
    }

    if (typeof assigner === 'function') {
      currentContext = producer
        ? producer(currentContext, (draftContext) =>
            (assigner as StoreProducerAssigner<TContext, StoreEvent, TEmitted>)(
              draftContext,
              event,
              enqueue
            )
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
            ? (propAssignment as StoreAssigner<TContext, StoreEvent, TEmitted>)(
                currentContext,
                event,
                enqueue
              )
            : propAssignment;
      }
      currentContext = Object.assign({}, currentContext, partialUpdate);
    }

    return [currentContext, effects];
  };
}

/**
 * Generates a unique 6-character identifier.
 *
 * @returns A random string identifier
 */
function uniqueId() {
  return Math.random().toString(36).slice(6);
}

export const computeGetters = <
  TContext extends StoreContext,
  TGetters extends Record<string, (context: TContext, getters: any) => any>
>(
  context: TContext,
  getters?: TGetters
): ResolvedGetters<TGetters> => {
  const computed = {} as ResolvedGetters<TGetters>;

  if (!getters) return computed;

  Object.entries(getters).forEach(([key, fn]) => {
    computed[key as keyof TGetters] = fn(
      context,
      new Proxy(computed, {
        get(target, prop) {
          return target[prop as keyof typeof target];
        }
      })
    );
  });

  return computed;
};
