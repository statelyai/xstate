import { createAtom } from './atom';
import { toObserver } from './toObserver';
import {
  EnqueueObject,
  EventObject,
  EventPayloadMap,
  ExtractEvents,
  InteropSubscribable,
  Observer,
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
  InternalBaseAtom,
  StoreLogic,
  StoreTransition,
  AnyStoreLogic,
  SpecificStoreConfig,
  StoreSelectorsConfig,
  ResolvedStoreSelectors,
  StoreWithSelectors,
  StoreLogicCreator
} from './types';

const symbolObservable: typeof Symbol.observable = (() =>
  (typeof Symbol === 'function' && Symbol.observable) ||
  '@@observable')() as any;

const inspectionObservers = new WeakMap<
  Store<any, any, any>,
  Set<Observer<StoreInspectionEvent>>
>();

/**
 * Attaches resolved selectors to a store instance and wraps `.with()` to
 * preserve selectors through extensions.
 */
function attachSelectors<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject,
  TSelectors extends StoreSelectorsConfig<TContext>
>(
  store: Store<TContext, TEventPayloadMap, TEmitted>,
  selectorsConfig: TSelectors
): StoreWithSelectors<TContext, TEventPayloadMap, TEmitted, TSelectors> {
  const selectors = {} as ResolvedStoreSelectors<TContext, TSelectors>;
  for (const key of Object.keys(selectorsConfig) as (keyof TSelectors)[]) {
    (selectors as any)[key] = store.select(
      selectorsConfig[key] as Selector<TContext, any>
    );
  }

  const originalWith = store.with;
  const storeWithSelectors = store as StoreWithSelectors<
    TContext,
    TEventPayloadMap,
    TEmitted,
    TSelectors
  >;
  storeWithSelectors.selectors = selectors;
  storeWithSelectors.with = ((extension: any) => {
    const extended = originalWith(extension);
    return attachSelectors(extended, selectorsConfig);
  }) as any;

  return storeWithSelectors;
}

function createStoreCore<
  TContext extends StoreContext,
  TSnapshot extends StoreSnapshot<any>,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(
  logic: StoreLogic<TSnapshot, ExtractEvents<TEventPayloadMap>, TEmitted>,
  emits?: Record<string, (payload: any) => void> // TODO: improve this type
): Store<TContext, TEventPayloadMap, TEmitted> {
  type StoreEvent = ExtractEvents<TEventPayloadMap>;
  let listeners: Map<TEmitted['type'], Set<any>> | undefined;
  const initialSnapshot = logic.getInitialSnapshot();
  let currentSnapshot: TSnapshot = initialSnapshot;
  const atom = createAtom<StoreSnapshot<TContext>>(currentSnapshot);

  const emit = (ev: TEmitted) => {
    if (!listeners) {
      return;
    }
    const type = ev.type;
    const typeListeners = listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach((listener) => listener(ev));
    }
    const wildcardListeners = listeners.get('*' as TEmitted['type']);
    if (wildcardListeners) {
      wildcardListeners.forEach((listener) => listener(ev));
    }
  };

  const transition = logic.transition;

  function receive(event: StoreEvent) {
    const [nextSnapshot, effects] = transition(currentSnapshot, event);
    currentSnapshot = nextSnapshot;

    inspectionObservers.get(store)?.forEach((observer) => {
      observer.next?.({
        type: '@xstate.snapshot',
        event,
        snapshot: nextSnapshot,
        actorRef: store,
        rootId: store.sessionId
      });
    });

    atom.set(nextSnapshot);

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

  const store: Store<TContext, TEventPayloadMap, TEmitted> &
    Pick<InternalBaseAtom<any>, '_snapshot'> = {
    get _snapshot() {
      return (atom as unknown as InternalBaseAtom<any>)._snapshot;
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
    transition: logic.transition as any, // TODO: fix this
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
    get() {
      return atom.get();
    },
    getInitialSnapshot() {
      return initialSnapshot;
    },
    subscribe: atom.subscribe.bind(atom),
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
    trigger: new Proxy(
      {} as Store<TContext, TEventPayloadMap, TEmitted>['trigger'],
      {
        get: (_, eventType: string) => {
          return (payload: any) => {
            store.send({
              ...payload,
              type: eventType
            });
          };
        }
      }
    ),
    select<TSelected>(
      selector: Selector<TContext, TSelected>,
      equalityFn: (a: TSelected, b: TSelected) => boolean = Object.is
    ): Selection<TSelected> {
      return createAtom(() => selector(store.get().context), {
        compare: equalityFn
      });
    },
    with(extension) {
      const extendedLogic = extension(logic as any);
      return createStoreCore(extendedLogic, emits) as any;
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
 * @example
 *
 * ```ts
 * // With selectors
 * const store = createStore({
 *   context: { count: 0 },
 *   on: {
 *     inc: (ctx) => ({ count: ctx.count + 1 })
 *   },
 *   selectors: {
 *     doubled: (ctx) => ctx.count * 2
 *   }
 * });
 *
 * store.selectors.doubled.get(); // 0
 * store.trigger.inc();
 * store.selectors.doubled.get(); // 2
 * ```
 *
 * @param config - The store configuration object
 * @param config.context - The initial state of the store
 * @param config.on - An object mapping event types to transition functions
 * @param config.emits - An object mapping emitted event types to handlers
 * @param config.selectors - An object mapping selector names to selector
 *   functions that derive values from context. Each selector becomes a reactive
 *   `ReadonlyAtom` on `store.selectors`.
 * @returns A store instance with methods to send events and subscribe to state
 *   changes
 */
export function createStore<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap,
  TSelectors extends Record<string, (context: TContext) => unknown>
>(
  definition: StoreConfig<TContext, TEventPayloadMap, TEmittedPayloadMap> & {
    selectors: TSelectors;
  }
): StoreWithSelectors<
  TContext,
  TEventPayloadMap,
  ExtractEvents<TEmittedPayloadMap>,
  TSelectors
>;
export function createStore<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap
>(
  definition: StoreConfig<TContext, TEventPayloadMap, TEmittedPayloadMap>
): Store<TContext, TEventPayloadMap, ExtractEvents<TEmittedPayloadMap>>;
export function createStore<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
>(
  definition:
    | SpecificStoreConfig<TContext, TEvent, TEmitted>
    | StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted>
): Store<
  TContext,
  {
    [E in TEvent as E['type']]: E;
  },
  TEmitted
>;
export function createStore(
  definitionOrLogic:
    | (StoreConfig<any, any, any> & {
        selectors?: Record<string, (context: any) => any>;
      })
    | AnyStoreLogic
): any {
  if ('transition' in definitionOrLogic) {
    return createStoreCore(definitionOrLogic);
  }

  const transition = createStoreTransition(definitionOrLogic.on);
  const logic: AnyStoreLogic = {
    getInitialSnapshot: () => ({
      status: 'active' as const,
      context: definitionOrLogic.context,
      output: undefined,
      error: undefined
    }),
    transition
  } satisfies AnyStoreLogic;
  const store = createStoreCore(logic, definitionOrLogic.emits);

  if (definitionOrLogic.selectors) {
    return attachSelectors(store, definitionOrLogic.selectors);
  }

  return store;
}

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
): Store<TContext, TEventPayloadMap, ExtractEvents<TEmittedPayloadMap>> {
  const transition = createStoreTransition(config.on, producer);
  const logic = {
    getInitialSnapshot: () => ({
      status: 'active' as const,
      context: config.context,
      output: undefined,
      error: undefined
    }),
    transition
  } satisfies AnyStoreLogic;

  return createStoreCore(logic, config.emits);
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
): StoreTransition<TContext, ExtractEvents<TEventPayloadMap>, TEmitted> {
  return (
    snapshot: StoreSnapshot<TContext>,
    event: ExtractEvents<TEventPayloadMap>
  ): [StoreSnapshot<TContext>, StoreEffect<TEmitted>[]] => {
    type StoreEvent = ExtractEvents<TEventPayloadMap>;
    const currentContext = snapshot.context;
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

    const nextContext = producer
      ? producer(currentContext, (draftContext) =>
          (assigner as StoreProducerAssigner<TContext, StoreEvent, TEmitted>)(
            draftContext,
            event,
            enqueue
          )
        )
      : (assigner(currentContext, event as any, enqueue) ?? currentContext);

    return [
      nextContext === currentContext
        ? snapshot
        : { ...snapshot, context: nextContext },
      effects
    ];
  };
}

/**
 * Creates a reusable store logic definition that can be instantiated multiple
 * times with different inputs.
 *
 * @example
 *
 * ```ts
 * const counterLogic = createStoreLogic({
 *   context: (input: { initialCount: number }) => ({
 *     count: input.initialCount
 *   }),
 *   on: {
 *     inc: (ctx) => ({ count: ctx.count + 1 }),
 *     dec: (ctx) => ({ count: ctx.count - 1 })
 *   },
 *   selectors: {
 *     doubled: (ctx) => ctx.count * 2,
 *     isPositive: (ctx) => ctx.count > 0
 *   }
 * });
 *
 * const counter1 = counterLogic.createStore({ initialCount: 42 });
 * const counter2 = counterLogic.createStore({ initialCount: 0 });
 *
 * counter1.selectors.doubled.get(); // 84
 * counter2.selectors.doubled.get(); // 0
 * ```
 *
 * @example
 *
 * ```ts
 * // Without input
 * const todoLogic = createStoreLogic({
 *   context: { todos: [] as string[] },
 *   on: {
 *     add: (ctx, ev: { text: string }) => ({
 *       todos: [...ctx.todos, ev.text]
 *     })
 *   },
 *   selectors: {
 *     count: (ctx) => ctx.todos.length
 *   }
 * });
 *
 * const store = todoLogic.createStore();
 * ```
 */
// Overload: with input + selectors
export function createStoreLogic<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap,
  TInput,
  TSelectors extends Record<string, (context: TContext) => any>
>(config: {
  context: (input: TInput) => TContext;
  on: {
    [K in keyof TEventPayloadMap & string]: StoreAssigner<
      TContext,
      { type: K } & TEventPayloadMap[K],
      ExtractEvents<TEmittedPayloadMap>
    >;
  };
  emits?: {
    [K in keyof TEmittedPayloadMap & string]: (
      payload: TEmittedPayloadMap[K]
    ) => void;
  };
  selectors: TSelectors;
}): StoreLogicCreator<
  TContext,
  TEventPayloadMap,
  ExtractEvents<TEmittedPayloadMap>,
  TInput,
  TSelectors
>;
// Overload: with input, no selectors
export function createStoreLogic<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap,
  TInput
>(config: {
  context: (input: TInput) => TContext;
  on: {
    [K in keyof TEventPayloadMap & string]: StoreAssigner<
      TContext,
      { type: K } & TEventPayloadMap[K],
      ExtractEvents<TEmittedPayloadMap>
    >;
  };
  emits?: {
    [K in keyof TEmittedPayloadMap & string]: (
      payload: TEmittedPayloadMap[K]
    ) => void;
  };
}): StoreLogicCreator<
  TContext,
  TEventPayloadMap,
  ExtractEvents<TEmittedPayloadMap>,
  TInput,
  {}
>;
// Overload: static context + selectors
export function createStoreLogic<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap,
  TSelectors extends Record<string, (context: TContext) => any>
>(config: {
  context: TContext;
  on: {
    [K in keyof TEventPayloadMap & string]: StoreAssigner<
      TContext,
      { type: K } & TEventPayloadMap[K],
      ExtractEvents<TEmittedPayloadMap>
    >;
  };
  emits?: {
    [K in keyof TEmittedPayloadMap & string]: (
      payload: TEmittedPayloadMap[K]
    ) => void;
  };
  selectors: TSelectors;
}): StoreLogicCreator<
  TContext,
  TEventPayloadMap,
  ExtractEvents<TEmittedPayloadMap>,
  void,
  TSelectors
>;
// Overload: static context, no selectors
export function createStoreLogic<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap
>(config: {
  context: TContext;
  on: {
    [K in keyof TEventPayloadMap & string]: StoreAssigner<
      TContext,
      { type: K } & TEventPayloadMap[K],
      ExtractEvents<TEmittedPayloadMap>
    >;
  };
  emits?: {
    [K in keyof TEmittedPayloadMap & string]: (
      payload: TEmittedPayloadMap[K]
    ) => void;
  };
}): StoreLogicCreator<
  TContext,
  TEventPayloadMap,
  ExtractEvents<TEmittedPayloadMap>,
  void,
  {}
>;
// Implementation
export function createStoreLogic(config: {
  context: any;
  on: any;
  emits?: any;
  selectors?: any;
}): any {
  const { on, emits, selectors } = config;

  const createStoreFn = (input?: any) => {
    const context =
      typeof config.context === 'function'
        ? config.context(input)
        : config.context;

    const transition = createStoreTransition(on);
    const logic: AnyStoreLogic = {
      getInitialSnapshot: () => ({
        status: 'active' as const,
        context,
        output: undefined,
        error: undefined
      }),
      transition
    } satisfies AnyStoreLogic;

    const store = createStoreCore(logic, emits);

    if (selectors && Object.keys(selectors).length > 0) {
      return attachSelectors(store, selectors);
    }

    return store;
  };

  return { createStore: createStoreFn };
}

/**
 * Generates a unique 6-character identifier.
 *
 * @returns A random string identifier
 */
function uniqueId() {
  return Math.random().toString(36).slice(6);
}
