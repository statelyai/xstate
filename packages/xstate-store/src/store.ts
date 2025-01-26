import {
  EnqueueObject,
  EventObject,
  EventPayloadMap,
  ExtractEventsFromPayloadMap,
  InteropSubscribable,
  Observer,
  Recipe,
  Store,
  StoreAssigner,
  StoreContext,
  StoreEffect,
  StoreInspectionEvent,
  StoreProducerAssigner,
  StoreSnapshot
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
  producer?: (
    context: NoInfer<TContext>,
    recipe: (context: NoInfer<TContext>) => void
  ) => NoInfer<TContext>
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>, TEmitted> {
  type StoreEvent = ExtractEventsFromPayloadMap<TEventPayloadMap>;
  let observers: Set<Observer<StoreSnapshot<TContext>>> | undefined;
  let listeners: Map<TEmitted['type'], Set<any>> | undefined;
  const initialSnapshot: StoreSnapshot<TContext> = {
    context: initialContext,
    status: 'active',
    output: undefined,
    error: undefined
  };
  let currentSnapshot: StoreSnapshot<TContext> = initialSnapshot;

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
    let effects: StoreEffect<TEmitted>[];
    [currentSnapshot, effects] = transition(currentSnapshot, event);

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

  const store: Store<TContext, StoreEvent, TEmitted> = {
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
  TEmitted extends EventPayloadMap
> = [
  definition: {
    context: TContext;
    on: {
      [K in keyof TEventPayloadMap & string]: StoreAssigner<
        NoInfer<TContext>,
        { type: K } & TEventPayloadMap[K],
        ExtractEventsFromPayloadMap<TEmitted>
      >;
    };
  }
];

type CreateStoreReturnType<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap
> = Store<
  TContext,
  ExtractEventsFromPayloadMap<TEventPayloadMap>,
  ExtractEventsFromPayloadMap<TEmitted>
>;

/**
 * Creates a **store** that has its own internal state and can be sent events
 * that update its internal state based on transitions.
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
function _createStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap
>(
  ...[{ context, on }]: CreateStoreParameterTypes<
    TContext,
    TEventPayloadMap,
    TEmitted
  >
): CreateStoreReturnType<TContext, TEventPayloadMap, TEmitted> {
  return createStoreCore(context, on);
}

export const createStore: {
  // those overloads are exactly the same, we only duplicate them so TypeScript can:
  // 1. assign contextual parameter types during inference attempt for the first overload when the source object is still context-sensitive and often non-inferrable
  // 2. infer correctly during inference attempt for the second overload when the parameter types are already "known"
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
    TEmitted extends EventObject
  >(
    ...args: CreateStoreParameterTypes<TContext, TEventPayloadMap, TEmitted>
  ): CreateStoreReturnType<TContext, TEventPayloadMap, TEmitted>;
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
        enqueue: EnqueueObject<ExtractEventsFromPayloadMap<TEmittedPayloadMap>>
      ) => void;
    };
  }
): Store<
  TContext,
  ExtractEventsFromPayloadMap<TEventPayloadMap>,
  ExtractEventsFromPayloadMap<TEmittedPayloadMap>
> {
  return createStoreCore(config.context, config.on, producer);
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
 * @param producer
 * @returns
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
    event: ExtractEventsFromPayloadMap<TEventPayloadMap>
  ): [StoreSnapshot<TContext>, StoreEffect<TEmitted>[]] => {
    type StoreEvent = ExtractEventsFromPayloadMap<TEventPayloadMap>;
    let currentContext = snapshot.context;
    const assigner = transitions?.[event.type as StoreEvent['type']];
    const effects: StoreEffect<TEmitted>[] = [];

    const enqueue: EnqueueObject<TEmitted> = {
      emit: (ev: TEmitted) => {
        effects.push(ev);
      },
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

// create a unique 6-char id
function uniqueId() {
  return Math.random().toString(36).slice(6);
}
