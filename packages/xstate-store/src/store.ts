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
  InteropSubscribable
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

function createStoreCore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap
>(
  initialContext: TContext,
  transitions: {
    [K in keyof TEventPayloadMap & string]:
      | StoreAssigner<NoInfer<TContext>, { type: K } & TEventPayloadMap[K]>
      | StorePropertyAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K]
        >;
  },
  updater?: (
    context: NoInfer<TContext>,
    recipe: (context: NoInfer<TContext>) => NoInfer<TContext>
  ) => NoInfer<TContext>
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>> {
  type StoreEvent = ExtractEventsFromPayloadMap<TEventPayloadMap>;
  let observers: Set<Observer<StoreSnapshot<TContext>>> | undefined;
  const initialSnapshot = {
    context: initialContext,
    status: 'active',
    output: undefined,
    error: undefined
  } satisfies StoreSnapshot<TContext> as StoreSnapshot<TContext>;
  let currentSnapshot = initialSnapshot;
  const transition = createStoreTransition<TContext, TEventPayloadMap>(
    transitions,
    updater
  );

  function receive(event: StoreEvent) {
    currentSnapshot = transition(currentSnapshot, event);

    observers?.forEach((o) => o.next?.(currentSnapshot));
  }

  const store: Store<TContext, StoreEvent> = {
    send(event) {
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
    }
  };

  return store;
}

/**
 * Creates a **store** that has its own internal state and can be sent events that
 * update its internal state based on transitions.
 *
 * @example
  ```ts
  const store = createStore({
    // Initial context
    { count: 0 },
    // Transitions
    {
      on: {
        inc: (context, event: { by: number }) => {
          return {
            count: context.count + event.by
          }
        }
      }
    }
  });

  store.subscribe((snapshot) => {
    console.log(snapshot);
  });

  store.send({ type: 'inc', by: 5 });
  // Logs { context: { count: 5 }, status: 'active', ... }
  ```
 */
export function createStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap
>(
  initialContext: TContext,
  transitions: {
    [K in keyof TEventPayloadMap & string]:
      | StoreAssigner<NoInfer<TContext>, { type: K } & TEventPayloadMap[K]>
      | StorePropertyAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K]
        >;
  }
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>> {
  return createStoreCore(initialContext, transitions);
}

/**
 * Creates a `Store` with a provided producer (such as Immer's `producer(…)`
 * A store has its own internal state and can receive events.
 *
 * @example
  ```ts
  import { produce } from 'immer';

  const store = createStoreWithProducer(produce, {
    // Initial context
    { count: 0 },
    // Transitions
    {
      on: {
        inc: (context, event: { by: number }) => {
          context.count += event.by;
        }
      }
    }
  });

  store.subscribe((snapshot) => {
    console.log(snapshot);
  });

  store.send({ type: 'inc', by: 5 });
  // Logs { context: { count: 5 }, status: 'active', ... }
  ```
 */
export function createStoreWithProducer<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap
>(
  producer: NoInfer<(
    context: TContext,
    recipe: (context: TContext) => void
  ) => TContext>,
  initialContext: TContext,
  transitions: {
    [K in keyof TEventPayloadMap & string]: (
      context: NoInfer<TContext>,
      event: { type: K } & TEventPayloadMap[K]
    ) => void;
  }
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>> {
  return createStoreCore(initialContext, transitions as any, producer);
}

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}

/**
 * Creates a store function, which is a function that accepts the current snapshot and an event and returns a new snapshot.
 * @param transitions
 * @param updater
 * @returns
 */
export function createStoreTransition<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap
>(
  transitions: {
    [K in keyof TEventPayloadMap & string]:
      | StoreAssigner<NoInfer<TContext>, { type: K } & TEventPayloadMap[K]>
      | StorePropertyAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K]
        >;
  },
  updater?: (
    context: NoInfer<TContext>,
    recipe: (context: NoInfer<TContext>) => NoInfer<TContext>
  ) => NoInfer<TContext>
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
              (assigner as StoreCompleteAssigner<TContext, StoreEvent>)?.(
                draftContext,
                event
              )
          )
        : setter(currentContext, (draftContext) =>
            Object.assign(
              {},
              currentContext,
              assigner?.(
                draftContext,
                event as any // TODO: help me
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
                  typeof key
                >
              )(currentContext, event)
            : propAssignment;
      }
      currentContext = Object.assign({}, currentContext, partialUpdate);
    }

    return { ...snapshot, context: currentContext };
  };
}
