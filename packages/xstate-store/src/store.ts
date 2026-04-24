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
  StoreLogic,
  StoreTransition,
  AnyStoreLogic,
  SpecificStoreConfig,
  ResolveStoreContext,
  ResolveStoreEventPayloadMap,
  ResolveStoreEmittedPayloadMap,
  StandardSchemaMap
} from './types';
import type { StandardSchemaV1 } from './schema';

const symbolObservable: typeof Symbol.observable = (() =>
  (typeof Symbol === 'function' && Symbol.observable) ||
  '@@observable')() as any;

const inspectionObservers = new WeakMap<
  Store<any, any, any>,
  Set<Observer<StoreInspectionEvent>>
>();
const isDevelopment =
  (
    globalThis as {
      process?: {
        env?: {
          NODE_ENV?: string;
        };
      };
    }
  ).process?.env?.NODE_ENV !== 'production';

function getDistinctEventTypes(eventTypes: readonly string[]): string[] {
  return [...new Set(eventTypes)];
}

export function assertNoInternalEventTypeCollisions(
  existingEventTypes: readonly string[] | undefined,
  internalEventTypes: readonly string[],
  extensionName: string
): void {
  if (!isDevelopment || !existingEventTypes?.length) {
    return;
  }

  const existingEventTypeSet = new Set(existingEventTypes);
  const collisions = getDistinctEventTypes(
    internalEventTypes.filter((eventType) =>
      existingEventTypeSet.has(eventType)
    )
  );

  if (collisions.length === 0) {
    return;
  }

  throw new Error(
    `The "${extensionName}" store extension uses reserved event type(s): ${collisions
      .map((eventType) => `"${eventType}"`)
      .join(
        ', '
      )}. Rename the conflicting store event(s) before applying the extension.`
  );
}

export function appendInternalEventTypes(
  existingEventTypes: readonly string[] | undefined,
  internalEventTypes: readonly string[],
  extensionName: string
): readonly string[] {
  assertNoInternalEventTypeCollisions(
    existingEventTypes,
    internalEventTypes,
    extensionName
  );

  return getDistinctEventTypes([
    ...(existingEventTypes ?? []),
    ...internalEventTypes
  ]);
}

function createConcreteTrigger<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(
  eventTypes: readonly string[],
  send: Store<TContext, TEventPayloadMap, TEmitted>['send']
): Store<TContext, TEventPayloadMap, TEmitted>['trigger'] {
  const trigger = {} as Store<TContext, TEventPayloadMap, TEmitted>['trigger'];

  for (const eventType of eventTypes) {
    Object.defineProperty(trigger, eventType, {
      enumerable: true,
      configurable: false,
      writable: false,
      value: (payload?: unknown) => {
        send(
          (payload === undefined
            ? { type: eventType }
            : {
                ...(payload as object),
                type: eventType
              }) as ExtractEvents<TEventPayloadMap>
        );
      }
    });
  }

  return Object.freeze(trigger);
}

function createStoreCore<
  TContext extends StoreContext,
  TSnapshot extends StoreSnapshot<any>,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(
  logic: StoreLogic<TSnapshot, ExtractEvents<TEventPayloadMap>, TEmitted>
): Store<TContext, TEventPayloadMap, TEmitted> {
  type StoreEvent = ExtractEvents<TEventPayloadMap>;
  let listeners: Map<TEmitted['type'], Set<any>> | undefined;
  const initialSnapshot = logic.getInitialSnapshot();
  let currentSnapshot: TSnapshot = initialSnapshot;
  const atom = createAtom<StoreSnapshot<TContext>>(currentSnapshot);
  const eventTypes = logic.eventTypes;

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
  const send: Store<TContext, TEventPayloadMap, TEmitted>['send'] = (event) => {
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
  };

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
        emit(effect);
      }
    }
  }

  const trigger =
    eventTypes && eventTypes.length > 0
      ? createConcreteTrigger<TContext, TEventPayloadMap, TEmitted>(
          eventTypes,
          (event) => store.send(event)
        )
      : new Proxy(
          {} as Store<TContext, TEventPayloadMap, TEmitted>['trigger'],
          {
            get: (_, eventType: string) => {
              return (payload: any) => {
                send({
                  ...payload,
                  type: eventType
                } as ExtractEvents<TEventPayloadMap>);
              };
            }
          }
        );

  const store: Store<TContext, TEventPayloadMap, TEmitted> = {
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
    transition(state, event) {
      return transition(state as TSnapshot, event as StoreEvent);
    },
    sessionId: uniqueId(),
    send,
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
    trigger,
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
      return createStoreCore(extendedLogic) as any;
    }
  };

  return store;
}

export type TransitionsFromEventPayloadMap<
  TEventPayloadMap extends EventPayloadMap,
  TContext extends StoreContext,
  TEmitted extends EventObject
> = {
  [K in keyof TEventPayloadMap & string]?: StoreAssigner<
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
 * @param config - The store configuration object
 * @param config.context - The initial state of the store
 * @param config.schemas - Optional standard-schema definitions used as type
 *   sources for context, events, and emitted events
 * @param config.on - An object mapping event types to transition functions
 * @returns A store instance with methods to send events and subscribe to state
 *   changes
 */
export function createStore<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap = {},
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEventSchemaMap extends StandardSchemaMap | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined
>(
  definition: StoreConfig<
    TContext,
    TEventPayloadMap,
    TEmittedPayloadMap,
    TContextSchema,
    TEventSchemaMap,
    TEmittedSchemaMap
  >
): Store<
  ResolveStoreContext<TContext, TContextSchema>,
  ResolveStoreEventPayloadMap<TEventPayloadMap, TEventSchemaMap>,
  ExtractEvents<
    ResolveStoreEmittedPayloadMap<TEmittedPayloadMap, TEmittedSchemaMap>
  >
>;
export function createStore<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEventSchemaMap extends StandardSchemaMap | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined
>(
  definition:
    | SpecificStoreConfig<
        TContext,
        TEvent,
        TEmitted,
        TContextSchema,
        TEventSchemaMap,
        TEmittedSchemaMap
      >
    | StoreLogic<
        StoreSnapshot<ResolveStoreContext<TContext, TContextSchema>>,
        TEvent,
        TEmitted
      >
): Store<
  ResolveStoreContext<TContext, TContextSchema>,
  {
    [E in TEvent as E['type']]: E;
  },
  TEmitted
>;
export function createStore(
  definitionOrLogic: StoreConfig<any, any, any, any, any, any> | AnyStoreLogic
) {
  if ('transition' in definitionOrLogic) {
    return createStoreCore(definitionOrLogic);
  }

  const transition = createStoreTransition(definitionOrLogic.on);
  const eventTypes = definitionOrLogic.schemas?.events
    ? Object.keys(definitionOrLogic.schemas.events)
    : Object.keys(definitionOrLogic.on);
  const logic: AnyStoreLogic = {
    eventTypes,
    getInitialSnapshot: () => ({
      status: 'active' as const,
      context: definitionOrLogic.context,
      output: undefined,
      error: undefined
    }),
    transition
  } satisfies AnyStoreLogic;
  return createStoreCore(logic);
}

function _createStoreConfig<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap = {},
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEventSchemaMap extends StandardSchemaMap | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined
>(
  definition: StoreConfig<
    TContext,
    TEventPayloadMap,
    TEmitted,
    TContextSchema,
    TEventSchemaMap,
    TEmittedSchemaMap
  >
): StoreConfig<
  TContext,
  TEventPayloadMap,
  TEmitted,
  TContextSchema,
  TEventSchemaMap,
  TEmittedSchemaMap
> {
  return definition;
}

export const createStoreConfig: {
  <
    TContext extends StoreContext,
    TEventPayloadMap extends EventPayloadMap,
    TEmitted extends EventPayloadMap = {},
    TContextSchema extends StandardSchemaV1 | undefined = undefined,
    TEventSchemaMap extends StandardSchemaMap | undefined = undefined,
    TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined
  >(
    definition: StoreConfig<
      TContext,
      TEventPayloadMap,
      TEmitted,
      TContextSchema,
      TEventSchemaMap,
      TEmittedSchemaMap
    >
  ): StoreConfig<
    TContext,
    TEventPayloadMap,
    TEmitted,
    TContextSchema,
    TEventSchemaMap,
    TEmittedSchemaMap
  >;
} = _createStoreConfig;

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
    [K in keyof TEventPayloadMap & string]?: StoreAssigner<
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
 * Generates a unique 6-character identifier.
 *
 * @returns A random string identifier
 */
function uniqueId() {
  return Math.random().toString(36).slice(6);
}
