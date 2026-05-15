import { createAtom } from './atom.ts';
import {
  EnqueueObject,
  EventObject,
  EventPayloadMap,
  ExtractEvents,
  InteropSubscribable,
  Observer,
  Store,
  StoreAssigner,
  StoreLogicCreator,
  StoreSelectorsConfig,
  StoreWithSelectors,
  ResolvedStoreSelectors,
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
} from './types.ts';
import type { StandardSchemaV1 } from './schema.ts';

const symbolObservable: typeof Symbol.observable = (() =>
  (typeof Symbol === 'function' && Symbol.observable) ||
  '@@observable')() as any;
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

const UNSUPPORTED_ASYNC_TRANSITION_ERROR = 'Async transition unsupported here';

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return !!value && typeof (value as any).then === 'function';
}

function ignorePromiseRejection(value: PromiseLike<unknown>) {
  Promise.resolve(value).catch(() => {});
}

function toEvent(eventType: string, payload: any) {
  return payload === undefined
    ? { type: eventType }
    : {
        ...payload,
        type: eventType
      };
}

function createEnqueueObject<TEmitted extends EventObject>(
  effects: StoreEffect<TEmitted>[],
  trigger?: (event: EventObject) => void
): EnqueueObject<TEmitted, any> {
  return {
    emit: new Proxy({} as any, {
      get: (_, eventType: string) => {
        return (payload: any) => {
          effects.push(toEvent(eventType, payload) as TEmitted);
        };
      }
    }),
    trigger: new Proxy({} as any, {
      get: (_, eventType: string) => {
        return (payload: any) => {
          trigger?.(toEvent(eventType, payload));
        };
      }
    }),
    effect: (fn) => {
      effects.push(fn);
    }
  };
}
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
    trigger[eventType as keyof typeof trigger] = ((payload?: unknown) => {
      send(toEvent(eventType, payload) as ExtractEvents<TEventPayloadMap>);
    }) as (typeof trigger)[keyof typeof trigger];
  }

  return trigger;
}

function createConcreteCan<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(
  eventTypes: readonly string[],
  can: (event: ExtractEvents<TEventPayloadMap>) => boolean
): Store<TContext, TEventPayloadMap, TEmitted>['can'] {
  const canObject = {} as Store<TContext, TEventPayloadMap, TEmitted>['can'];

  for (const eventType of eventTypes) {
    canObject[eventType as keyof typeof canObject] = ((payload?: unknown) => {
      return can(
        toEvent(eventType, payload) as ExtractEvents<TEventPayloadMap>
      );
    }) as (typeof canObject)[keyof typeof canObject];
  }

  return canObject;
}

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
    selectors[key] = store.select(
      selectorsConfig[key]
    ) as ResolvedStoreSelectors<TContext, TSelectors>[keyof TSelectors];
  }

  const originalWith = store.with;
  const storeWithSelectors = store as StoreWithSelectors<
    TContext,
    TEventPayloadMap,
    TEmitted,
    TSelectors
  >;
  storeWithSelectors.selectors = selectors;
  storeWithSelectors.with = ((extension: any) =>
    attachSelectors(originalWith(extension), selectorsConfig)) as any;

  return storeWithSelectors;
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
  let inspectionObservers: Set<Observer<StoreInspectionEvent>> | undefined;
  const initialSnapshot = logic.getInitialSnapshot();
  let currentSnapshot: TSnapshot = initialSnapshot;
  const atom = createAtom<StoreSnapshot<TContext>>(currentSnapshot);
  const eventTypes = logic.eventTypes;

  const emit = (ev: TEmitted) => {
    listeners?.get(ev.type)?.forEach((listener) => listener(ev));
    listeners
      ?.get('*' as TEmitted['type'])
      ?.forEach((listener) => listener(ev));
  };

  const transition = logic.transition;
  const notifyInspection = (
    event: EventObject,
    snapshot: StoreSnapshot<TContext>
  ) => {
    inspectionObservers?.forEach((observer) => {
      observer.next?.({
        type: '@xstate.transition',
        event,
        snapshot,
        actorRef: store,
        rootId: store.sessionId
      });
    });
  };

  const send: Store<TContext, TEventPayloadMap, TEmitted>['send'] = (event) => {
    receive(event as unknown as StoreEvent);
  };

  function receive(event: StoreEvent) {
    const [nextSnapshot, effects] = transition(currentSnapshot, event);
    currentSnapshot = nextSnapshot;

    atom.set(nextSnapshot);
    notifyInspection(event, nextSnapshot);

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
                send(
                  toEvent(eventType, payload) as ExtractEvents<TEventPayloadMap>
                );
              };
            }
          }
        );

  const can =
    eventTypes && eventTypes.length > 0
      ? createConcreteCan<TContext, TEventPayloadMap, TEmitted>(
          eventTypes,
          (event) => canTransition(event)
        )
      : new Proxy({} as Store<TContext, TEventPayloadMap, TEmitted>['can'], {
          get: (_, eventType: string) => {
            return (payload: any) => {
              return canTransition(
                toEvent(eventType, payload) as ExtractEvents<TEventPayloadMap>
              );
            };
          }
        });

  function canTransition(event: StoreEvent) {
    const snapshot = currentSnapshot;
    const result = transition(snapshot, event);
    const allowed = (
      result as [StoreSnapshot<TContext>, StoreEffect<TEmitted>[], boolean?]
    )[2];
    return allowed ?? (result[0] !== snapshot || result[1].length > 0);
  }

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
      eventListeners.add(handler);

      return {
        unsubscribe() {
          eventListeners.delete(handler);
        }
      };
    },
    transition(state, event) {
      return transition(state as TSnapshot, event);
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
      const observer =
        typeof observerOrFn === 'function'
          ? { next: observerOrFn }
          : observerOrFn;
      (inspectionObservers ??= new Set()).add(observer);

      observer.next?.({
        type: '@xstate.transition',
        event: { type: '@xstate.init' },
        snapshot: currentSnapshot,
        actorRef: store,
        rootId: store.sessionId
      });

      return {
        unsubscribe() {
          return inspectionObservers?.delete(observer);
        }
      };
    },
    trigger,
    can,
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
    TEmitted,
    TEventPayloadMap
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
export function createStore(definitionOrLogic: any): any {
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

export function createStoreLogic<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap = {},
  TInput = undefined,
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEventSchemaMap extends StandardSchemaMap | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined,
  TSelectors extends StoreSelectorsConfig<
    ResolveStoreContext<TContext, TContextSchema>
  > = {}
>(
  config: Omit<
    StoreConfig<
      TContext,
      TEventPayloadMap,
      TEmittedPayloadMap,
      TContextSchema,
      TEventSchemaMap,
      TEmittedSchemaMap
    >,
    'context'
  > & {
    context: (input: TInput) => ResolveStoreContext<TContext, TContextSchema>;
    selectors: TSelectors;
  }
): StoreLogicCreator<
  ResolveStoreContext<TContext, TContextSchema>,
  ResolveStoreEventPayloadMap<TEventPayloadMap, TEventSchemaMap>,
  ExtractEvents<
    ResolveStoreEmittedPayloadMap<TEmittedPayloadMap, TEmittedSchemaMap>
  >,
  TInput,
  TSelectors
>;
export function createStoreLogic<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap = {},
  TInput = undefined,
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEventSchemaMap extends StandardSchemaMap | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined
>(
  config: Omit<
    StoreConfig<
      TContext,
      TEventPayloadMap,
      TEmittedPayloadMap,
      TContextSchema,
      TEventSchemaMap,
      TEmittedSchemaMap
    >,
    'context'
  > & {
    context: (input: TInput) => ResolveStoreContext<TContext, TContextSchema>;
  }
): StoreLogicCreator<
  ResolveStoreContext<TContext, TContextSchema>,
  ResolveStoreEventPayloadMap<TEventPayloadMap, TEventSchemaMap>,
  ExtractEvents<
    ResolveStoreEmittedPayloadMap<TEmittedPayloadMap, TEmittedSchemaMap>
  >,
  TInput,
  {}
>;
export function createStoreLogic<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap = {},
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEventSchemaMap extends StandardSchemaMap | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined,
  TSelectors extends StoreSelectorsConfig<
    ResolveStoreContext<TContext, TContextSchema>
  > = {}
>(
  config: StoreConfig<
    TContext,
    TEventPayloadMap,
    TEmittedPayloadMap,
    TContextSchema,
    TEventSchemaMap,
    TEmittedSchemaMap
  > & {
    selectors: TSelectors;
  }
): StoreLogicCreator<
  ResolveStoreContext<TContext, TContextSchema>,
  ResolveStoreEventPayloadMap<TEventPayloadMap, TEventSchemaMap>,
  ExtractEvents<
    ResolveStoreEmittedPayloadMap<TEmittedPayloadMap, TEmittedSchemaMap>
  >,
  void,
  TSelectors
>;
export function createStoreLogic<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap = {},
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEventSchemaMap extends StandardSchemaMap | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined
>(
  config: StoreConfig<
    TContext,
    TEventPayloadMap,
    TEmittedPayloadMap,
    TContextSchema,
    TEventSchemaMap,
    TEmittedSchemaMap
  >
): StoreLogicCreator<
  ResolveStoreContext<TContext, TContextSchema>,
  ResolveStoreEventPayloadMap<TEventPayloadMap, TEventSchemaMap>,
  ExtractEvents<
    ResolveStoreEmittedPayloadMap<TEmittedPayloadMap, TEmittedSchemaMap>
  >,
  void,
  {}
>;
export function createStoreLogic(
  config: StoreConfig<any, any, any, any, any, any> & {
    context: StoreContext | ((input: unknown) => StoreContext);
    selectors?: StoreSelectorsConfig<any>;
  }
): any {
  return {
    createStore(input?: unknown) {
      const context =
        typeof config.context === 'function'
          ? config.context(input)
          : config.context;

      const store = createStore({
        ...config,
        context
      } as any);

      return config.selectors
        ? attachSelectors(store, config.selectors)
        : store;
    }
  };
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
    [K in keyof TEventPayloadMap & string]?: StoreAssigner<
      TContext,
      { type: K } & TEventPayloadMap[K],
      TEmitted,
      TEventPayloadMap
    >;
  },
  producer?: (
    context: TContext,
    recipe: (context: TContext) => void
  ) => TContext
): StoreTransition<TContext, ExtractEvents<TEventPayloadMap>, TEmitted> {
  type StoreEvent = ExtractEvents<TEventPayloadMap>;
  const storeTransition: StoreTransition<TContext, StoreEvent, TEmitted> = (
    snapshot: StoreSnapshot<TContext>,
    event: StoreEvent
  ): [StoreSnapshot<TContext>, StoreEffect<TEmitted>[]] => {
    let currentSnapshot = snapshot;
    const effects: StoreEffect<TEmitted>[] = [];
    const pendingEvents: StoreEvent[] = [event];
    let allowed = false;

    while (pendingEvents.length > 0) {
      const currentEvent = pendingEvents.shift()!;
      const currentContext = currentSnapshot.context;
      const assigner = transitions?.[currentEvent.type as StoreEvent['type']];
      let producerAssignerResult: unknown;
      let assignerResult: TContext | void = undefined;
      const effectsLength = effects.length;

      if (!assigner) {
        continue;
      }

      const enqueue = createEnqueueObject<TEmitted>(
        effects,
        (triggeredEvent) => {
          allowed = true;
          pendingEvents.push(triggeredEvent as StoreEvent);
        }
      );

      const nextContext = producer
        ? producer(
            currentContext,
            (draftContext) =>
              (producerAssignerResult = (
                assigner as StoreProducerAssigner<
                  TContext,
                  StoreEvent,
                  TEmitted,
                  TEventPayloadMap
                >
              )(draftContext, currentEvent, enqueue))
          )
        : (assignerResult = assigner(
              currentContext,
              currentEvent as any,
              enqueue
            )) === undefined
          ? currentContext
          : assignerResult;

      if (isPromiseLike(producer ? producerAssignerResult : nextContext)) {
        ignorePromiseRejection(
          (producer
            ? producerAssignerResult
            : nextContext) as PromiseLike<unknown>
        );
        throw new Error(UNSUPPORTED_ASYNC_TRANSITION_ERROR);
      }

      allowed ||= producer
        ? nextContext !== currentContext || effects.length > effectsLength
        : assignerResult !== undefined || effects.length > effectsLength;

      if (nextContext !== currentContext) {
        currentSnapshot = { ...currentSnapshot, context: nextContext };
      }
    }

    return [currentSnapshot, effects, allowed] as any;
  };

  return storeTransition;
}

/**
 * Generates a unique 6-character identifier.
 *
 * @returns A random string identifier
 */
function uniqueId() {
  return Math.random().toString(36).slice(6);
}
