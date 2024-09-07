import { EventObject } from 'xstate';
import {
  Recipe,
  EventPayloadMap,
  Store,
  ExtractEventsFromPayloadMap,
  StoreSnapshot,
  StorePartialAssigner,
  StoreCompleteAssigner,
  StoreAssigner,
  StorePropertyAssigner,
  Observer,
  StoreContext,
  InteropSubscribable,
  InspectionEvent,
  Compute
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
  Set<Observer<InspectionEvent>>
>();

function createStoreCore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(
  initialContext: TContext,
  transitions: {
    [K in keyof TEventPayloadMap & string]:
      | StoreAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K],
          TEmitted
        >
      | StorePropertyAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K],
          TEmitted
        >;
  },
  updater?: (
    context: NoInfer<TContext>,
    recipe: (context: NoInfer<TContext>) => NoInfer<TContext>
  ) => NoInfer<TContext>
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>, TEmitted> {
  type StoreEvent = ExtractEventsFromPayloadMap<TEventPayloadMap>;
  let observers: Set<Observer<StoreSnapshot<TContext>>> | undefined;
  let listeners: Map<TEmitted['type'], Set<any>> | undefined;
  const initialSnapshot = {
    context: initialContext,
    status: 'active',
    output: undefined,
    error: undefined
  } satisfies StoreSnapshot<TContext> as StoreSnapshot<TContext>;
  let currentSnapshot = initialSnapshot;
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
  const transition = createStoreTransition<
    TContext,
    TEventPayloadMap,
    TEmitted
  >(transitions, updater, { emit });

  function receive(event: StoreEvent) {
    currentSnapshot = transition(currentSnapshot, event);

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
  }

  const store: Store<TContext, StoreEvent, TEmitted> = {
    on: (event, fn) => {
      if (!listeners) {
        listeners = new Map();
      }
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      const set = listeners.get(event)!;
      set.add(fn);

      return {
        unsubscribe() {
          set.delete(fn);
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
    }
  };

  return store;
}

export type TransitionsFromEventPayloadMap<
  TEventPayloadMap extends EventPayloadMap,
  TContext extends StoreContext,
  TEmitted extends EventObject
> = {
  [K in keyof TEventPayloadMap & string]:
    | StoreAssigner<
        NoInfer<TContext>,
        {
          type: K;
        } & TEventPayloadMap[K],
        TEmitted
      >
    | StorePropertyAssigner<
        NoInfer<TContext>,
        {
          type: K;
        } & TEventPayloadMap[K],
        TEmitted
      >;
};

export function createStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TTypes extends { emitted: EventObject }
>({
  context,
  on,
  types
}: {
  context: TContext;
  on: {
    [K in keyof TEventPayloadMap & string]:
      | StoreAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K],
          TTypes['emitted']
        >
      | StorePropertyAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K],
          TTypes['emitted']
        >;
  };
} & { types: TTypes }): Store<
  TContext,
  ExtractEventsFromPayloadMap<TEventPayloadMap>,
  TTypes['emitted']
>;

export function createStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TSchemas extends { emitted: Record<string, { _output: unknown }> }
>({
  context,
  on,
  schemas
}: {
  context: TContext;
  on: {
    [K in keyof TEventPayloadMap & string]:
      | StoreAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K],
          EmittedFromSchemas<TSchemas['emitted']>
        >
      | StorePropertyAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K],
          EmittedFromSchemas<TSchemas['emitted']>
        >;
  };
} & { schemas: TSchemas }): Store<
  TContext,
  ExtractEventsFromPayloadMap<TEventPayloadMap>,
  EmittedFromSchemas<TSchemas['emitted']>
>;

/**
 * Creates a **store** that has its own internal state and can be sent events
 * that update its internal state based on transitions.
 *
 * @example
 *
 * ```ts
 * const store = createStore({
 *   // Initial context
 *   { count: 0 },
 *   // Transitions
 *   {
 *     on: {
 *       inc: (context, event: { by: number }) => {
 *         return {
 *           count: context.count + event.by
 *         }
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
export function createStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap
>(
  initialContext: TContext,
  transitions: TransitionsFromEventPayloadMap<
    TEventPayloadMap,
    TContext,
    EventObject
  >
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>, EventObject>;

export function createStore(initialContextOrObject: any, transitions?: any) {
  if (transitions === undefined) {
    return createStoreCore(
      initialContextOrObject.context,
      initialContextOrObject.on
    );
  }
  return createStoreCore(initialContextOrObject, transitions);
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
  TEmitted extends EventObject = EventObject
>(
  producer: NoInfer<
    (context: TContext, recipe: (context: TContext) => void) => TContext
  >,
  initialContext: TContext,
  transitions: {
    [K in keyof TEventPayloadMap & string]: (
      context: NoInfer<TContext>,
      event: { type: K } & TEventPayloadMap[K]
    ) => void;
  }
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>, TEmitted> {
  return createStoreCore(initialContext, transitions as any, producer);
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
  TEmitted extends EventObject
>(
  transitions: {
    [K in keyof TEventPayloadMap & string]:
      | StoreAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K],
          TEmitted
        >
      | StorePropertyAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K],
          TEmitted
        >;
  },
  updater?: (
    context: NoInfer<TContext>,
    recipe: (context: NoInfer<TContext>) => NoInfer<TContext>
  ) => NoInfer<TContext>,
  enqueue: { emit: (ev: TEmitted) => void } = {
    emit: (_ev: TEmitted) => void 0
  }
) {
  return (
    snapshot: StoreSnapshot<TContext>,
    event: ExtractEventsFromPayloadMap<TEventPayloadMap>
  ): StoreSnapshot<TContext> => {
    type StoreEvent = ExtractEventsFromPayloadMap<TEventPayloadMap>;
    let currentContext = snapshot.context;
    const assigner = transitions?.[event.type as StoreEvent['type']];

    if (!assigner) {
      return snapshot;
    }

    if (typeof assigner === 'function') {
      currentContext = updater
        ? updater(
            currentContext,
            (draftContext) =>
              (
                assigner as StoreCompleteAssigner<
                  TContext,
                  StoreEvent,
                  TEmitted
                >
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

    return { ...snapshot, context: currentContext };
  };
}

// create a unique 6-char id
function uniqueId() {
  return Math.random().toString(36).slice(6);
}

type MaybeZod<T> = T extends { _output: infer U } ? U : never;

export type EmittedFromSchemas<T extends Record<string, { _output: unknown }>> =
  {
    [K in keyof T]: Compute<{ type: K } & MaybeZod<T[K]> & EventObject>;
  }[keyof T];
