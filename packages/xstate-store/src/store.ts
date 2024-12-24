import {
  Cast,
  EnqueueObject,
  EventObject,
  EventPayloadMap,
  ExtractEventsFromPayloadMap,
  InteropSubscribable,
  Observer,
  Recipe,
  Store,
  StoreAssigner,
  StoreCompleteAssigner,
  StoreContext,
  StoreInspectionEvent,
  StorePartialAssigner,
  StorePropertyAssigner,
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
  const store = new StoreImpl(initialContext, transitions, updater);

  return store;
}

export type TransitionsFromEventPayloadMap<
  TEventPayloadMap extends EventPayloadMap,
  TContext extends StoreContext,
  TEmitted extends EventObject
> = {
  [K in keyof TEventPayloadMap & string]:
    | StoreAssigner<
        TContext,
        {
          type: K;
        } & TEventPayloadMap[K],
        TEmitted
      >
    | StorePropertyAssigner<
        TContext,
        {
          type: K;
        } & TEventPayloadMap[K],
        TEmitted
      >;
};

class StoreImpl<
    TContext extends StoreContext,
    TEventPayloadMap extends EventPayloadMap,
    TEmitted extends EventObject
  >
  extends EventTarget
  implements
    Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>, TEmitted>
{
  public transition: (
    snapshot: StoreSnapshot<TContext>,
    event: ExtractEventsFromPayloadMap<TEventPayloadMap>
  ) => [StoreSnapshot<TContext>, TEmitted[]];
  constructor(
    initialContext: TContext,
    transitions: TransitionsFromEventPayloadMap<
      TEventPayloadMap,
      TContext,
      TEmitted
    >,
    updater?: (
      context: TContext,
      recipe: (context: TContext) => TContext
    ) => TContext
  ) {
    super();
    this.transition = createStoreTransition(transitions, updater);
    this.initialSnapshot = {
      context: initialContext,
      status: 'active',
      output: undefined,
      error: undefined
    };
    this.currentSnapshot = this.initialSnapshot;
    this.observers = new Set();
    this._emit = this._emit.bind(this);
  }
  private listeners: Map<TEmitted['type'], Set<any>> | undefined;
  public sessionId: string = uniqueId();
  public on<TEmittedType extends TEmitted['type']>(
    emittedEventType: TEmittedType,
    handler: (event: Extract<TEmitted, { type: TEmittedType }>) => void
  ) {
    const wrappedHandler = ((e: CustomEvent<TEmitted>) => {
      handler(e.detail as Extract<TEmitted, { type: TEmittedType }>);
    }) as EventListener;

    this.addEventListener(emittedEventType, wrappedHandler);

    return {
      unsubscribe: () => {
        this.removeEventListener(emittedEventType, wrappedHandler);
      }
    };
  }

  public initialSnapshot: StoreSnapshot<TContext>;
  public currentSnapshot: StoreSnapshot<TContext>;
  public observers: Set<Observer<StoreSnapshot<TContext>>>;
  public send(event: ExtractEventsFromPayloadMap<TEventPayloadMap>) {
    inspectionObservers.get(this)?.forEach((observer) => {
      observer.next?.({
        type: '@xstate.event',
        event,
        sourceRef: undefined,
        actorRef: this,
        rootId: this.sessionId
      });
    });
    this.receive(
      event as unknown as ExtractEventsFromPayloadMap<TEventPayloadMap>
    );
  }
  private _emit(ev: TEmitted) {
    super.dispatchEvent(new CustomEvent(ev.type, { detail: ev }));
  }
  public receive(event: ExtractEventsFromPayloadMap<TEventPayloadMap>) {
    let emitted: TEmitted[];
    [this.currentSnapshot, emitted] = this.transition(
      this.currentSnapshot,
      event
    );

    inspectionObservers.get(this)?.forEach((observer) => {
      observer.next?.({
        type: '@xstate.snapshot',
        event,
        snapshot: this.currentSnapshot,
        actorRef: this,
        rootId: this.sessionId
      });
    });

    this.observers.forEach((o) => o.next?.(this.currentSnapshot));
    emitted.forEach(this._emit);
  }
  public getSnapshot() {
    return this.currentSnapshot;
  }
  public getInitialSnapshot() {
    return this.initialSnapshot;
  }
  public subscribe(
    observerOrFn:
      | Observer<StoreSnapshot<TContext>>
      | ((snapshot: StoreSnapshot<TContext>) => void)
  ) {
    const observer = toObserver(observerOrFn);
    this.observers.add(observer);
    return {
      unsubscribe: () => {
        this.observers.delete(observer);
      }
    };
  }
  [symbolObservable](): InteropSubscribable<StoreSnapshot<TContext>> {
    return this;
  }
  public inspect(
    observerOrFn:
      | Observer<StoreInspectionEvent>
      | ((event: StoreInspectionEvent) => void)
  ) {
    const observer = toObserver(observerOrFn);
    inspectionObservers.set(this, inspectionObservers.get(this) ?? new Set());
    inspectionObservers.get(this)!.add(observer);

    observer.next?.({
      type: '@xstate.actor',
      actorRef: this,
      rootId: this.sessionId
    });

    observer.next?.({
      type: '@xstate.snapshot',
      snapshot: this.initialSnapshot,
      event: { type: '@xstate.init' },
      actorRef: this,
      rootId: this.sessionId
    });

    return {
      unsubscribe: () => {
        return inspectionObservers.get(this)?.delete(observer);
      }
    };
  }
}

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
export function createStore<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TTypes extends { emitted?: EventObject }
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
          Cast<TTypes['emitted'], EventObject>
        >
      | StorePropertyAssigner<
          NoInfer<TContext>,
          { type: K } & TEventPayloadMap[K],
          Cast<TTypes['emitted'], EventObject>
        >;
  };
} & { types?: TTypes }): Store<
  TContext,
  ExtractEventsFromPayloadMap<TEventPayloadMap>,
  Cast<TTypes['emitted'], EventObject>
>;

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
  config: {
    context: TContext;
    on: {
      [K in keyof TEventPayloadMap & string]: (
        context: NoInfer<TContext>,
        event: { type: K } & TEventPayloadMap[K],
        enqueue: EnqueueObject<TEmitted>
      ) => void;
    };
  }
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>, TEmitted>;
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
      event: { type: K } & TEventPayloadMap[K],
      enqueue: EnqueueObject<TEmitted>
    ) => void;
  }
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>, TEmitted>;

export function createStoreWithProducer<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject = EventObject
>(
  producer: (
    context: TContext,
    recipe: (context: TContext) => void
  ) => TContext,
  initialContextOrConfig: any,
  transitions?: any
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>, TEmitted> {
  if (
    typeof initialContextOrConfig === 'object' &&
    'context' in initialContextOrConfig &&
    'on' in initialContextOrConfig
  ) {
    return createStoreCore(
      initialContextOrConfig.context,
      initialContextOrConfig.on,
      producer
    );
  }
  return createStoreCore(initialContextOrConfig, transitions, producer);
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
      | StoreAssigner<TContext, { type: K } & TEventPayloadMap[K], TEmitted>
      | StorePropertyAssigner<
          TContext,
          { type: K } & TEventPayloadMap[K],
          TEmitted
        >;
  },
  updater?: (
    context: TContext,
    recipe: (context: TContext) => TContext
  ) => TContext
) {
  return (
    snapshot: StoreSnapshot<TContext>,
    event: ExtractEventsFromPayloadMap<TEventPayloadMap>
  ): [StoreSnapshot<TContext>, TEmitted[]] => {
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

    return [{ ...snapshot, context: currentContext }, emitted];
  };
}

// create a unique 6-char id
function uniqueId() {
  return Math.random().toString(36).slice(6);
}
