import { createAtom } from './atom';
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
  AsyncEnqueueObject,
  AsyncStoreAssigner,
  AsyncStoreConfig,
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

const XSTATE_ASYNC = '@';
const STEP_SUSPENDED = new Error('Step suspended');
const UNSUPPORTED_ASYNC_HANDLER_ERROR =
  'Async transition must await enq.step(...)';
const UNSUPPORTED_STEP_USAGE_ERROR = 'enq.step(...) must be awaited';
const UNSUPPORTED_ASYNC_TRANSITION_ERROR = 'Async transition unsupported here';

type InternalAsyncStepEffect = {
  type: typeof XSTATE_ASYNC;
  i: string;
  k: string;
  f: () => unknown | PromiseLike<unknown>;
};

type InternalAsyncExecutionEffect<
  TContext extends StoreContext,
  TEmitted extends EventObject
> = {
  type: typeof XSTATE_ASYNC;
  i: string;
  p: Promise<TContext | void>;
  e: StoreEffect<TEmitted>[];
  g: () => InternalAsyncStepEffect | undefined;
};

type InternalAsyncStepResolveEvent = {
  type: typeof XSTATE_ASYNC;
  i: string;
  k: string;
  v: unknown;
};

type InternalAsyncExecutionResolveEvent<
  TContext extends StoreContext,
  TEmitted extends EventObject
> = {
  type: typeof XSTATE_ASYNC;
  i: string;
  v: TContext | void;
  e: StoreEffect<TEmitted>[];
};

type InternalAsyncExecutionResumeEvent = {
  type: typeof XSTATE_ASYNC;
  i: string;
};

type AsyncExecution<TEvent extends EventObject> = {
  event: TEvent;
  steps: PublicAsyncState[string]['steps'];
};

type PublicAsyncState = NonNullable<StoreSnapshot<any>['async']>;

type InternalStoreSnapshot<
  TContext extends StoreContext,
  _TEvent extends EventObject = EventObject
> = StoreSnapshot<TContext> & {
  async: PublicAsyncState;
};

function ensureStoreSnapshot<
  TContext extends StoreContext,
  TEvent extends EventObject = EventObject
>(snapshot: StoreSnapshot<TContext>): InternalStoreSnapshot<TContext, TEvent> {
  if (snapshot.async) {
    return snapshot as InternalStoreSnapshot<TContext, TEvent>;
  }

  return {
    ...snapshot,
    async: {}
  };
}

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
  step?: AsyncEnqueueObject<TEmitted, any>['step'],
  trigger?: (event: EventObject) => void
): EnqueueObject<TEmitted, any> | AsyncEnqueueObject<TEmitted, any> {
  const enq: EnqueueObject<TEmitted, any> | AsyncEnqueueObject<TEmitted, any> =
    {
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

  if (step) {
    (enq as AsyncEnqueueObject<TEmitted, any>).step = step;
  }

  return enq;
}

function isInternalAsyncStepEffect(
  effect: unknown
): effect is InternalAsyncStepEffect {
  return (
    typeof effect === 'object' &&
    effect !== null &&
    'type' in effect &&
    effect.type === XSTATE_ASYNC &&
    'f' in effect
  );
}

function isInternalAsyncExecutionEffect<
  TContext extends StoreContext,
  TEmitted extends EventObject
>(effect: unknown): effect is InternalAsyncExecutionEffect<TContext, TEmitted> {
  return (
    typeof effect === 'object' &&
    effect !== null &&
    'type' in effect &&
    effect.type === XSTATE_ASYNC &&
    'p' in effect
  );
}

function setAsyncExecution<
  TContext extends StoreContext,
  TEvent extends EventObject
>(
  snapshot: InternalStoreSnapshot<TContext, TEvent>,
  executionId: string,
  execution: AsyncExecution<TEvent>
): InternalStoreSnapshot<TContext, TEvent> {
  const ensuredSnapshot = ensureStoreSnapshot<TContext, TEvent>(snapshot);

  return {
    ...ensuredSnapshot,
    async: {
      ...ensuredSnapshot.async,
      [executionId]: execution
    }
  };
}

function setAsyncStep<
  TContext extends StoreContext,
  TEvent extends EventObject
>(
  snapshot: InternalStoreSnapshot<TContext, TEvent>,
  executionId: string,
  stepId: string,
  effect: PublicAsyncState[string]['steps'][string]
): InternalStoreSnapshot<TContext, TEvent> {
  const ensuredSnapshot = ensureStoreSnapshot<TContext, TEvent>(snapshot);
  const execution = ensuredSnapshot.async[executionId] as
    | AsyncExecution<TEvent>
    | undefined;

  if (!execution) {
    return ensuredSnapshot;
  }

  return setAsyncExecution(ensuredSnapshot, executionId, {
    ...execution,
    steps: {
      ...execution.steps,
      [stepId]: effect
    }
  });
}

function updateAsyncExecutionStepResult<
  TContext extends StoreContext,
  TEvent extends EventObject
>(
  snapshot: InternalStoreSnapshot<TContext, TEvent>,
  executionId: string,
  stepId: string,
  value: unknown
): InternalStoreSnapshot<TContext, TEvent> {
  return setAsyncStep(snapshot, executionId, stepId, {
    status: 'done',
    output: value
  });
}

function removeAsyncExecution<
  TContext extends StoreContext,
  TEvent extends EventObject
>(
  snapshot: InternalStoreSnapshot<TContext, TEvent>,
  executionId: string
): InternalStoreSnapshot<TContext, TEvent> {
  const ensuredSnapshot = ensureStoreSnapshot<TContext, TEvent>(snapshot);

  if (!ensuredSnapshot.async[executionId]) {
    return ensuredSnapshot;
  }

  const { [executionId]: _removed, ...rest } = ensuredSnapshot.async;

  return {
    ...ensuredSnapshot,
    async: rest
  };
}

function reportUnhandledStoreError(error: unknown) {
  setTimeout(() => {
    throw error;
  });
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
    selectors[key] = select(
      store,
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
  logic: StoreLogic<TSnapshot, ExtractEvents<TEventPayloadMap>, TEmitted>,
  processEffect?: (
    effect: StoreEffect<TEmitted>,
    scope: {
      getSnapshot: () => TSnapshot;
      setSnapshot: (snapshot: TSnapshot, event: EventObject) => void;
      receive: (event: ExtractEvents<TEventPayloadMap>) => void;
    }
  ) => boolean
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
    setSnapshot(nextSnapshot, event);

    for (const effect of effects) {
      if (typeof effect === 'function') {
        effect();
      } else if (
        processEffect?.(effect, {
          getSnapshot: () => currentSnapshot,
          setSnapshot,
          receive: receive as any
        })
      ) {
        continue;
      } else {
        emit(effect);
      }
    }
  }

  function setSnapshot(snapshot: TSnapshot, event: EventObject) {
    currentSnapshot = snapshot;
    atom.set(snapshot);
    notifyInspection(event, snapshot);
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
    select<TSelected>(
      selector: Selector<TContext, TSelected>,
      equalityFn: (a: TSelected, b: TSelected) => boolean = Object.is
    ): Selection<TSelected> {
      return select(store, selector, equalityFn);
    },
    with(extension) {
      const extendedLogic = extension(logic as any);
      return createStoreCore(extendedLogic as any, processEffect) as any;
    }
  };

  if (processEffect) {
    for (const executionId of Object.keys(currentSnapshot.async ?? {})) {
      store.send({
        type: XSTATE_ASYNC,
        i: executionId
      } as any);
    }
  }

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

function createStoreTransitionWithSteps<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(transitions: {
  [K in keyof TEventPayloadMap & string]?: AsyncStoreAssigner<
    TContext,
    { type: K } & TEventPayloadMap[K],
    TEmitted,
    TEventPayloadMap
  >;
}): StoreTransition<TContext, ExtractEvents<TEventPayloadMap>, TEmitted> {
  type StoreEvent = ExtractEvents<TEventPayloadMap>;
  type InternalEvent =
    | StoreEvent
    | InternalAsyncStepResolveEvent
    | InternalAsyncExecutionResolveEvent<TContext, TEmitted>
    | InternalAsyncExecutionResumeEvent;

  const runExecution = (
    snapshot: InternalStoreSnapshot<TContext, StoreEvent>,
    executionId: string,
    executionOverride?: AsyncExecution<StoreEvent>,
    unchangedSnapshot: StoreSnapshot<TContext> = snapshot
  ): [StoreSnapshot<TContext>, StoreEffect<TEmitted>[]] => {
    const ensuredSnapshot = ensureStoreSnapshot<TContext, StoreEvent>(snapshot);
    const execution =
      executionOverride ??
      (ensuredSnapshot.async[executionId] as
        | AsyncExecution<StoreEvent>
        | undefined);

    if (!execution) {
      return [ensuredSnapshot, []];
    }

    const assigner = transitions?.[execution.event.type as StoreEvent['type']];

    if (!assigner) {
      return [removeAsyncExecution(ensuredSnapshot, executionId), []];
    }

    const effects: StoreEffect<TEmitted>[] = [];
    let requestedStep: InternalAsyncStepEffect | undefined;

    const enqueue = createEnqueueObject<TEmitted>(effects, function step<
      T
    >(stepId: string, exec: () => T | PromiseLike<T>) {
      const stepEffect = execution.steps[stepId];

      if (stepEffect?.status === 'done') {
        return Promise.resolve(stepEffect.output as T);
      }

      if (stepEffect?.status === 'error') {
        throw stepEffect.error;
      }

      requestedStep = {
        type: XSTATE_ASYNC,
        i: executionId,
        k: stepId,
        f: exec
      };

      return Promise.reject(STEP_SUSPENDED);
    }) as AsyncEnqueueObject<TEmitted, TEventPayloadMap>;

    const nextContext = assigner(
      ensuredSnapshot.context,
      execution.event as any,
      enqueue
    );

    if (requestedStep) {
      if (!isPromiseLike(nextContext)) {
        throw new Error(UNSUPPORTED_STEP_USAGE_ERROR);
      }

      ignorePromiseRejection(nextContext);

      return [
        setAsyncStep(
          setAsyncExecution(ensuredSnapshot, executionId, execution),
          executionId,
          requestedStep.k,
          { status: 'active' }
        ),
        [requestedStep as never]
      ];
    }

    if (isPromiseLike(nextContext)) {
      if (
        !Object.keys(execution.steps).some(
          (key) => key !== 'async' && execution.steps[key].status === 'done'
        )
      ) {
        ignorePromiseRejection(nextContext);
        throw new Error(UNSUPPORTED_ASYNC_HANDLER_ERROR);
      }

      return [
        setAsyncExecution(ensuredSnapshot, executionId, execution),
        [
          {
            type: XSTATE_ASYNC,
            i: executionId,
            p: Promise.resolve(nextContext),
            e: effects,
            g: () => requestedStep
          } as never
        ]
      ];
    }

    return [
      nextContext === ensuredSnapshot.context
        ? unchangedSnapshot
        : {
            ...ensuredSnapshot,
            context: nextContext ?? ensuredSnapshot.context
          },
      effects
    ];
  };

  return (
    snapshot: StoreSnapshot<TContext>,
    event: StoreEvent
  ): [StoreSnapshot<TContext>, StoreEffect<TEmitted>[]] => {
    const internalSnapshot = ensureStoreSnapshot<TContext, StoreEvent>(
      snapshot
    );
    const internalEvent = event as InternalEvent;

    if (internalEvent.type === XSTATE_ASYNC) {
      if ('e' in internalEvent) {
        return [
          internalEvent.v === undefined
            ? removeAsyncExecution(internalSnapshot, internalEvent.i)
            : removeAsyncExecution(
                {
                  ...internalSnapshot,
                  context: internalEvent.v
                },
                internalEvent.i
              ),
          internalEvent.e
        ];
      }

      if (!('i' in internalEvent)) {
        return [internalSnapshot, []];
      }

      if (!('k' in internalEvent)) {
        return runExecution(internalSnapshot, internalEvent.i);
      }

      return runExecution(
        updateAsyncExecutionStepResult(
          internalSnapshot,
          internalEvent.i,
          internalEvent.k,
          internalEvent.v
        ),
        internalEvent.i
      );
    }

    const assigner = transitions?.[internalEvent.type as StoreEvent['type']];

    if (!assigner) {
      return [snapshot, []];
    }

    return runExecution(
      internalSnapshot,
      uniqueId(),
      {
        event: internalEvent as StoreEvent,
        steps: {
          async: { status: 'active' }
        }
      },
      snapshot
    );
  };
}

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

export function select<TContext extends StoreContext, TSelected>(
  store: Store<TContext, any, any>,
  selector: Selector<TContext, TSelected>,
  equalityFn: (a: TSelected, b: TSelected) => boolean = Object.is
): Selection<TSelected> {
  return createAtom(() => selector(store.get().context), {
    compare: equalityFn
  });
}

export function createAsyncStore<
  TContext extends StoreContext,
  const TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap = {},
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEventSchemaMap extends StandardSchemaMap | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined
>(
  definition: AsyncStoreConfig<
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
export function createAsyncStore(
  definition: AsyncStoreConfig<any, any, any, any, any, any>
) {
  const transition = createStoreTransitionWithSteps(definition.on);
  const eventTypes = definition.schemas?.events
    ? Object.keys(definition.schemas.events)
    : Object.keys(definition.on);
  const logic: AnyStoreLogic = {
    eventTypes,
    getInitialSnapshot: () =>
      definition.snapshot ?? {
        status: 'active' as const,
        context: definition.context,
        output: undefined,
        error: undefined
      },
    transition
  } satisfies AnyStoreLogic;

  const store = createStoreCore(logic, (effect, scope) => {
    const rejectExecution = (executionId: string, error: unknown) => {
      const internalSnapshot = ensureStoreSnapshot(
        scope.getSnapshot() as StoreSnapshot<any>
      );

      scope.setSnapshot(
        setAsyncStep(internalSnapshot, executionId, 'async', {
          status: 'error',
          error
        }),
        { type: XSTATE_ASYNC }
      );
      reportUnhandledStoreError(error);
    };

    const runStep = (stepEffect: InternalAsyncStepEffect) => {
      Promise.resolve(stepEffect.f()).then(
        (value) => {
          scope.receive({
            type: XSTATE_ASYNC,
            i: stepEffect.i,
            k: stepEffect.k,
            v: value
          } as any);
        },
        (error) => {
          rejectExecution(stepEffect.i, error);
        }
      );
    };

    if (isInternalAsyncStepEffect(effect)) {
      runStep(effect);
      return true;
    }

    if (isInternalAsyncExecutionEffect(effect)) {
      effect.p.then(
        (value) => {
          scope.receive({
            type: XSTATE_ASYNC,
            i: effect.i,
            v: value,
            e: [...effect.e]
          } as any);
        },
        (error) => {
          const requestedStep = effect.g();

          if (error === STEP_SUSPENDED && requestedStep) {
            const internalSnapshot = ensureStoreSnapshot(
              scope.getSnapshot() as StoreSnapshot<any>
            );
            const execution = internalSnapshot.async[effect.i];

            if (execution) {
              scope.setSnapshot(
                setAsyncStep(internalSnapshot, effect.i, requestedStep.k, {
                  status: 'active'
                }),
                requestedStep
              );
              runStep(requestedStep);
              return;
            }
          }

          rejectExecution(effect.i, error);
        }
      );
      return true;
    }

    return false;
  });

  return store;
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
    let effects: StoreEffect<TEmitted>[] = [];
    let pendingEvents: StoreEvent[] = [event];

    while (pendingEvents.length > 0) {
      const currentEvent = pendingEvents.shift()!;
      const currentContext = currentSnapshot.context;
      const assigner = transitions?.[currentEvent.type as StoreEvent['type']];
      let producerAssignerResult: unknown;

      if (!assigner) {
        continue;
      }

      const enqueue = createEnqueueObject<TEmitted>(
        effects,
        undefined,
        (triggeredEvent) => pendingEvents.push(triggeredEvent as StoreEvent)
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
        : (assigner(currentContext, currentEvent as any, enqueue) ??
          currentContext);

      if (isPromiseLike(producer ? producerAssignerResult : nextContext)) {
        ignorePromiseRejection(
          (producer
            ? producerAssignerResult
            : nextContext) as PromiseLike<unknown>
        );
        throw new Error(UNSUPPORTED_ASYNC_TRANSITION_ERROR);
      }

      if (nextContext !== currentContext) {
        currentSnapshot = { ...currentSnapshot, context: nextContext };
      }
    }

    return [currentSnapshot, effects];
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
