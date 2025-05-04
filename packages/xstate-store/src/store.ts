import { createAtom, createBaseAtom } from './atom';
import { toObserver } from './toObserver';
import {
  EnqueueObject,
  EventObject,
  EventPayloadMap,
  ExtractEvents,
  InteropSubscribable,
  Observer,
  Recipe,
  Store,
  StoreAssigner,
  StoreContext,
  StoreConfig,
  StoreEffect,
  StoreInspectionEvent,
  StoreProducerAssigner,
  StoreSnapshot,
  Selector,
  Selection,
  InternalBaseAtom
} from './types';

const symbolObservable: typeof Symbol.observable = (() =>
  (typeof Symbol === 'function' && Symbol.observable) ||
  '@@observable')() as any;

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
  TEmitted extends EventObject
>(
  initialContext: TContext,
  transitions: {
    [K in keyof TEventPayloadMap & string]: StoreAssigner<
      NoInfer<TContext>,
      { type: K } & TEventPayloadMap[K],
      TEmitted
    >;
  },
  emits?: Record<string, (payload: any) => void>, // TODO: improve this type
  producer?: (
    context: NoInfer<TContext>,
    recipe: (context: NoInfer<TContext>) => void
  ) => NoInfer<TContext>
): Store<TContext, ExtractEvents<TEventPayloadMap>, TEmitted> {
  type StoreEvent = ExtractEvents<TEventPayloadMap>;
  let listeners: Map<TEmitted['type'], Set<any>> | undefined;
  const initialSnapshot: StoreSnapshot<TContext> = {
    context: initialContext,
    status: 'active',
    output: undefined,
    error: undefined
  };
  const internalAtom = createBaseAtom<
    [StoreSnapshot<TContext>, StoreEffect<TEmitted>[]],
    StoreEvent
  >([initialSnapshot, []], ([state], event) => {
    return transition(state, event);
  });

  const storeAtom = createAtom(() => internalAtom.get()[0]);

  const emit = (ev: TEmitted) => {
    if (!listeners) {
      return;
    }
    const { type } = ev;
    const typeListeners = listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach((listener) => listener(ev));
    }
  };

  const transition = createStoreTransition(transitions, producer);

  function receive(event: StoreEvent) {
    (internalAtom as InternalBaseAtom<any, StoreEvent>).send(event);
    const [currentSnapshot, effects] = internalAtom.get();

    inspectionObservers.get(store)?.forEach((observer) => {
      observer.next?.({
        type: '@xstate.snapshot',
        event,
        snapshot: currentSnapshot,
        actorRef: store,
        rootId: store.sessionId
      });
    });

    for (const effect of effects) {
      if (typeof effect === 'function') {
        effect();
      } else {
        // handle the inherent effect first
        emits?.[effect.type]?.(effect);
        emit(effect);
      }
    }
  }

  const store: Store<TContext, StoreEvent, TEmitted> &
    Pick<InternalBaseAtom<any>, '_snapshot'> = {
    get _snapshot() {
      return (internalAtom as unknown as InternalBaseAtom<any>)._snapshot[0];
    },
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
    transition,
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
      return storeAtom.get();
    },
    get() {
      return storeAtom.get();
    },
    getInitialSnapshot() {
      return initialSnapshot;
    },
    subscribe: storeAtom.subscribe.bind(storeAtom),
    [symbolObservable](): InteropSubscribable<StoreSnapshot<TContext>> {
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
    trigger: new Proxy({} as Store<TContext, StoreEvent, TEmitted>['trigger'], {
      get: (_, eventType: string) => {
        return (payload: any) => {
          store.send({
            type: eventType,
            ...payload
          });
        };
      }
    }),
    select<TSelected>(
      selector: Selector<TContext, TSelected>,
      equalityFn: (a: TSelected, b: TSelected) => boolean = Object.is
    ): Selection<TSelected> {
      return createAtom(() => selector(storeAtom.get().context), {
        compare: equalityFn
      });
    }
  };

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
  TEmitted extends EventPayloadMap
> = [definition: StoreConfig<TContext, TEventPayloadMap, TEmitted>];

type CreateStoreReturnType<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap
> = Store<TContext, ExtractEvents<TEventPayloadMap>, ExtractEvents<TEmitted>>;

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
 * @param config.emits - An object mapping emitted event types to handlers
 * @returns A store instance with methods to send events and subscribe to state
 *   changes
 */
function _createStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap
>(
  ...[{ context, on, emits }]: CreateStoreParameterTypes<
    TContext,
    TEventPayloadMap,
    TEmitted
  >
): CreateStoreReturnType<TContext, TEventPayloadMap, TEmitted> {
  return createStoreCore(context, on, emits);
}

// those overloads are exactly the same, we only duplicate them so TypeScript can:
// 1. assign contextual parameter types during inference attempt for the first overload when the source object is still context-sensitive and often non-inferrable
// 2. infer correctly during inference attempt for the second overload when the parameter types are already "known"
export const createStore: {
  /**
   * Creates a **store** that has its own internal state and can be sent events
   * that update its internal state based on transitions.
   *
   * @example
   *
   * ```ts
   * const store = createStore({
   *   context: { count: 0, name: 'Ada' },
   *   on: {
   *     inc: (context, event: { by: number }) => ({
   *       ...context,
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
   * // Logs { context: { count: 5, name: 'Ada' }, status: 'active', ... }
   * ```
   *
   * @param config - The store configuration object
   * @param config.context - The initial state of the store
   * @param config.on - An object mapping event types to transition functions
   * @param config.emits - An object mapping emitted event types to handlers
   * @returns A store instance with methods to send events and subscribe to
   *   state changes
   */
  <
    TContext extends StoreContext,
    TEventPayloadMap extends EventPayloadMap,
    TEmitted extends EventPayloadMap
  >(
    ...args: CreateStoreParameterTypes<TContext, TEventPayloadMap, TEmitted>
  ): CreateStoreReturnType<TContext, TEventPayloadMap, TEmitted>;
  <
    TContext extends StoreContext,
    TEventPayloadMap extends EventPayloadMap,
    TEmitted extends EventPayloadMap
  >(
    ...args: CreateStoreParameterTypes<TContext, TEventPayloadMap, TEmitted>
  ): CreateStoreReturnType<TContext, TEventPayloadMap, TEmitted>;
} = _createStore;

function _createStoreConfig<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap
>(
  definition: StoreConfig<TContext, TEventPayloadMap, TEmitted>
): StoreConfig<TContext, TEventPayloadMap, TEmitted> {
  return definition;
}

export const createStoreConfig: {
  <
    TContext extends StoreContext,
    TEventPayloadMap extends EventPayloadMap,
    TEmitted extends EventPayloadMap
  >(
    definition: StoreConfig<TContext, TEventPayloadMap, TEmitted>
  ): StoreConfig<TContext, TEventPayloadMap, TEmitted>;
  <
    TContext extends StoreContext,
    TEventPayloadMap extends EventPayloadMap,
    TEmitted extends EventPayloadMap
  >(
    definition: StoreConfig<TContext, TEventPayloadMap, TEmitted>
  ): StoreConfig<TContext, TEventPayloadMap, TEmitted>;
} = _createStoreConfig;

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
  TEmittedPayloadMap extends EventPayloadMap
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
        enqueue: EnqueueObject<ExtractEvents<TEmittedPayloadMap>>
      ) => void;
    };
    emits?: {
      [K in keyof TEmittedPayloadMap & string]: (
        payload: TEmittedPayloadMap[K]
      ) => void;
    };
  }
): Store<
  TContext,
  ExtractEvents<TEventPayloadMap>,
  ExtractEvents<TEmittedPayloadMap>
> {
  return createStoreCore(config.context, config.on, config.emits, producer);
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
  producer?: (
    context: TContext,
    recipe: (context: TContext) => void
  ) => TContext
) {
  return (
    snapshot: StoreSnapshot<TContext>,
    event: ExtractEvents<TEventPayloadMap>
  ): [StoreSnapshot<TContext>, StoreEffect<TEmitted>[]] => {
    type StoreEvent = ExtractEvents<TEventPayloadMap>;
    let currentContext = snapshot.context;
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
      return [snapshot, effects];
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

    return [{ ...snapshot, context: currentContext }, effects];
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
