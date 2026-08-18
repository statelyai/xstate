import type {
  ActorOptions,
  AnyActor,
  AnyActorLogic,
  AnyActorScope,
  AnyEventObject,
  AnyMachineSnapshot,
  AnyStateMachine,
  CustomExecutableActionObject,
  EventFromLogic,
  ExecutableActionObject,
  InputFrom,
  Snapshot,
  SnapshotFrom
} from '../types.ts';
import { resolveActorId } from '../system.ts';
import { finalizeTransitionResult } from '../transitionActions.ts';

export interface DurableActorRef {
  /** Stable logical identity for this actor incarnation. */
  id: string;
  /** Human-readable ID relative to the parent actor. */
  actorId: string;
}

export interface DurableActorRecord {
  ref: DurableActorRef;
  parent?: string;
  src?: string;
  registryKey?: string;
}

export interface DurableSystemSnapshot {
  root: string;
  nextActorId: number;
  actors: Record<string, DurableActorRecord>;
}

export interface DurableSystemState<TLogic extends AnyStateMachine> {
  snapshot: SnapshotFrom<TLogic>;
  system: DurableSystemSnapshot;
  nextTransitionIndex: number;
}

export interface PersistedDurableSystemState {
  snapshot: Snapshot<unknown>;
  system: DurableSystemSnapshot;
  nextTransitionIndex: number;
}

export interface DurableSystemEffectMetadata {
  id: string;
  transitionIndex: number;
  effectIndex: number;
}

export type DurableSystemEffect = DurableSystemEffectMetadata &
  (
    | { type: 'action'; actionType: string; params: unknown }
    | { type: 'event.emit'; source: DurableActorRef; event: AnyEventObject }
    | {
        type: 'actor.spawn';
        source: DurableActorRef;
        actor: DurableActorRef;
        src: string;
        input: unknown;
      }
    | { type: 'actor.start'; actor: DurableActorRef }
    | { type: 'actor.stop'; source: DurableActorRef; actor: DurableActorRef }
    | {
        type: 'actor.terminate';
        actor: DurableActorRef;
        status: 'done' | 'error';
        output: unknown;
        error: unknown;
      }
    | {
        type: 'event.send';
        source: DurableActorRef;
        target: DurableActorRef;
        event: AnyEventObject;
      }
    | {
        type: 'timer.schedule';
        source: DurableActorRef;
        target: DurableActorRef;
        timerId: string;
        delay: number;
        event: AnyEventObject;
      }
    | { type: 'timer.cancel'; source: DurableActorRef; timerId: string }
  );

export interface DurableSystemTransition<TLogic extends AnyStateMachine> {
  state: DurableSystemState<TLogic>;
  effects: DurableSystemEffect[];
  /** False when an event names an actor incarnation that is no longer live. */
  accepted: boolean;
}

export interface DurableSystemEffectExecutor {
  /**
   * Commits one effect. `executeAction` is present only for local action
   * effects and lets a host wrap execution in its durable step primitive.
   */
  execute(
    effect: DurableSystemEffect,
    executeAction?: () => void | PromiseLike<void>
  ): void | PromiseLike<void>;
}

export interface DurableSystem<TLogic extends AnyStateMachine> {
  initialTransition(
    ...[input]: undefined extends InputFrom<TLogic>
      ? [input?: InputFrom<TLogic>]
      : [input: InputFrom<TLogic>]
  ): DurableSystemTransition<TLogic>;
  transition(
    state: DurableSystemState<TLogic>,
    event: EventFromLogic<TLogic>
  ): DurableSystemTransition<TLogic>;
  /** Persists only the root machine. Suitable when it has no durable children. */
  getPersistedSnapshot(state: DurableSystemState<TLogic>): Snapshot<unknown>;
  /** Persists root state plus logical actor identity and effect ordering. */
  getPersistedSystemSnapshot(
    state: DurableSystemState<TLogic>
  ): PersistedDurableSystemState;
  restoreSnapshot(
    snapshot: Snapshot<unknown>,
    options?: { transitionIndex?: number }
  ): DurableSystemState<TLogic>;
  restoreSystemSnapshot(
    persisted: PersistedDurableSystemState
  ): DurableSystemState<TLogic>;
  /** Executes the local implementation captured by an `action` effect. */
  executeAction(effect: DurableSystemEffect): void | PromiseLike<void>;
  /** Executes effects in plan order, awaiting each host operation. */
  executeEffects(
    effects: readonly DurableSystemEffect[],
    executor: DurableSystemEffectExecutor
  ): Promise<void>;
}

const rootRef: DurableActorRef = { id: 'root:0', actorId: 'root' };

function createInitialSystemSnapshot(): DurableSystemSnapshot {
  return {
    root: rootRef.id,
    nextActorId: 1,
    actors: { [rootRef.id]: { ref: rootRef } }
  };
}

function cloneSystemSnapshot(
  snapshot: DurableSystemSnapshot
): DurableSystemSnapshot {
  return {
    root: snapshot.root,
    nextActorId: snapshot.nextActorId,
    actors: Object.fromEntries(
      Object.entries(snapshot.actors).map(([id, record]) => [
        id,
        { ...record, ref: { ...record.ref } }
      ])
    )
  };
}

const durableRefByActor = new WeakMap<object, DurableActorRef>();

function getDurableRef(actor: AnyActor): DurableActorRef {
  const ref = durableRefByActor.get(actor);
  if (!ref) {
    throw new Error(`Actor '${actor.id}' has no durable logical identity.`);
  }
  return ref;
}

function createPlanningScope(
  logic: AnyActorLogic,
  systemSnapshot: DurableSystemSnapshot,
  options: {
    actorId: string;
    ref: DurableActorRef;
    parent?: AnyActor;
    input?: unknown;
    snapshot?: Snapshot<unknown>;
    src?: string | AnyActorLogic;
    registryKey?: string;
  },
  sharedSystem?: any
): { scope: AnyActorScope; setSnapshot(snapshot: Snapshot<unknown>): void } {
  let currentSnapshot: Snapshot<unknown> | undefined = options.snapshot;
  const keyedActors =
    sharedSystem?.keyedActors ?? new Map<PropertyKey, AnyActor>();
  const registeredActors =
    sharedSystem?.children ?? new Map<string, AnyActor>();

  const unavailable = (operation: string): never => {
    throw new Error(
      `Cannot ${operation} a durable actor reference during pure planning.`
    );
  };

  const actor = {
    id: options.actorId,
    sessionId: options.ref.id,
    src: options.src ?? logic,
    logic,
    registryKey: options.registryKey,
    _parent: options.parent,
    _processingStatus: 0,
    _isRunning: () => false,
    options: { _inert: true, input: options.input },
    getSnapshot: () => currentSnapshot,
    getPersistedSnapshot: (persistOptions?: unknown) =>
      logic.getPersistedSnapshot(currentSnapshot!, persistOptions as never),
    send: () => unavailable('send to'),
    _send: () => unavailable('send to'),
    start: () => unavailable('start'),
    stop: () => unavailable('stop'),
    subscribe: () => ({ unsubscribe() {} }),
    on: () => ({ unsubscribe() {} }),
    select: () => ({
      get: () => unavailable('select from'),
      subscribe: () => ({ unsubscribe() {} }),
      [Symbol.observable]() {
        return this;
      }
    }),
    trigger: new Proxy(
      {},
      { get: () => () => unavailable('trigger an event on') }
    ),
    toJSON: () => ({ xstate$$type: 1, id: options.actorId })
  } as unknown as AnyActor;
  (actor as any).ref = actor;
  durableRefByActor.set(actor, options.ref);

  const system = sharedSystem ?? {
    children: registeredActors,
    keyedActors,
    reverseKeyedActors: new WeakMap(),
    _identity: { systemId: 'durable', nextSessionId: 0 },
    _snapshot: {
      _scheduledTimers: {},
      _nextActorId:
        options.snapshot && '_nextActorId' in options.snapshot
          ? ((options.snapshot as any)._nextActorId ?? 0)
          : 0
    },
    _snapshotVersion: 0,
    _clock: {
      setTimeout: () => unavailable('schedule timers in'),
      clearTimeout() {}
    },
    _logger: console.log,
    scheduler: {
      schedule: () => unavailable('schedule timers in'),
      cancel() {},
      cancelAll() {}
    },
    createActorRef(childLogic: AnyActorLogic, childOptions: ActorOptions<any>) {
      const parent = childOptions.parent as AnyActor;
      const parentRef = getDurableRef(parent);
      const requestedId = childOptions.id;
      const existing = childOptions.snapshot
        ? Object.values(systemSnapshot.actors).find(
            (record) =>
              record.parent === parentRef.id &&
              record.ref.actorId === requestedId
          )
        : undefined;
      if (childOptions.snapshot && !existing) {
        throw new Error(
          `Durable snapshot has no logical identity for restored actor '${requestedId}'.`
        );
      }
      const actorId =
        existing?.ref.actorId ?? resolveActorId(system as any, requestedId);
      const ref =
        existing?.ref ??
        ({
          id: `${actorId}:${systemSnapshot.nextActorId++}`,
          actorId
        } satisfies DurableActorRef);
      if (!existing) {
        systemSnapshot.actors[ref.id] = {
          ref,
          parent: parentRef.id,
          src:
            typeof childOptions.src === 'string' ? childOptions.src : undefined,
          registryKey: childOptions.registryKey
        };
      }
      const child = createPlanningScope(
        childLogic,
        systemSnapshot,
        {
          actorId,
          ref,
          parent,
          input: childOptions.input,
          snapshot: childOptions.snapshot,
          src: childOptions.src,
          registryKey: childOptions.registryKey
        },
        system
      );
      const childSnapshot = childOptions.snapshot
        ? childLogic.restoreSnapshot
          ? childLogic.restoreSnapshot(childOptions.snapshot, child.scope)
          : childOptions.snapshot
        : childLogic.initialTransition(childOptions.input, child.scope)[0];
      child.setSnapshot(childSnapshot);
      const childActor = child.scope.self;
      registeredActors.set(ref.id, childActor);
      if (childOptions.registryKey) {
        keyedActors.set(childOptions.registryKey, childActor);
        (system.reverseKeyedActors as WeakMap<AnyActor, PropertyKey>).set(
          childActor,
          childOptions.registryKey
        );
      }
      return childActor;
    },
    _register(sessionId: string, registered: AnyActor) {
      registeredActors.set(sessionId, registered);
      return sessionId;
    },
    _unregister(unregistered: AnyActor) {
      registeredActors.delete(unregistered.sessionId!);
      deleteActorTree(systemSnapshot, getDurableRef(unregistered).id);
    },
    _set(key: PropertyKey, registered: AnyActor) {
      keyedActors.set(key, registered);
    },
    get: (key: PropertyKey) => keyedActors.get(key),
    getAll: () => Object.fromEntries(keyedActors),
    _getRootActor: () => undefined,
    _peekChildren: () => registeredActors,
    _peekKeyedActors: () => keyedActors,
    _hasInspectionObservers: () => false,
    _sendInspectionEvent() {},
    inspect: () => ({ unsubscribe() {} }),
    _relay: () => unavailable('relay events in'),
    getSnapshot: () => ({ _scheduledTimers: {} }),
    start() {},
    spawnActor: () => unavailable('spawn actors in'),
    startActor: () => unavailable('start actors in'),
    stopActor: () => unavailable('stop actors in'),
    terminateActor: () => unavailable('terminate actors in'),
    sendEvent: () => unavailable('send events in'),
    emitEvent: () => unavailable('emit events in'),
    scheduleTimer: () => unavailable('schedule timers in'),
    cancelTimer: () => unavailable('cancel timers in'),
    cancelAllTimers: () => unavailable('cancel timers in')
  };

  const scope = {
    self: actor,
    id: actor.id,
    sessionId: actor.sessionId,
    logger: system._logger,
    defer() {},
    emit: () => unavailable('emit events from'),
    system,
    stopChild(child: AnyActor) {
      system._unregister(child);
    },
    actionExecutor() {}
  } as unknown as AnyActorScope;
  (actor as any).system = system;

  if (!sharedSystem && options.snapshot && 'children' in options.snapshot) {
    const registerChildren = (snapshot: Snapshot<unknown>) => {
      for (const child of Object.values(getChildren(snapshot))) {
        if (!child || typeof child.getSnapshot !== 'function') {
          continue;
        }
        registeredActors.set(child.sessionId!, child);
        if (child.registryKey) {
          keyedActors.set(child.registryKey, child);
          (system.reverseKeyedActors as WeakMap<AnyActor, PropertyKey>).set(
            child,
            child.registryKey
          );
        }
        const childSnapshot = child.getSnapshot();
        if (childSnapshot) {
          registerChildren(childSnapshot);
        }
      }
    };
    registerChildren(options.snapshot);
    if ('_nextActorId' in options.snapshot) {
      system._snapshot._nextActorId =
        (options.snapshot as any)._nextActorId ?? 0;
    }
  }

  return {
    scope,
    setSnapshot(snapshot) {
      currentSnapshot = snapshot;
    }
  };
}

function createRootPlanningScope(
  logic: AnyActorLogic,
  systemSnapshot: DurableSystemSnapshot,
  snapshot?: Snapshot<unknown>
) {
  return createPlanningScope(logic, systemSnapshot, {
    actorId: rootRef.actorId,
    ref: systemSnapshot.actors[systemSnapshot.root].ref,
    snapshot
  });
}

function getChildren(snapshot: unknown): Record<string, AnyActor | undefined> {
  return snapshot && typeof snapshot === 'object' && 'children' in snapshot
    ? ((snapshot as AnyMachineSnapshot).children as Record<
        string,
        AnyActor | undefined
      >)
    : {};
}

function deleteActorTree(system: DurableSystemSnapshot, actorId: string): void {
  for (const [id, record] of Object.entries(system.actors)) {
    if (record.parent === actorId) {
      deleteActorTree(system, id);
    }
  }
  delete system.actors[actorId];
}

function isActorLifecycleEvent(event: AnyEventObject): boolean {
  return (
    event.type === 'xstate.done.actor' ||
    event.type === 'xstate.error.actor' ||
    event.type === 'xstate.snapshot.actor' ||
    event.type === 'xstate.timeout.actor'
  );
}

/**
 * Creates a pure durable actor-system planner.
 *
 * Unlike `ActorSystemRuntime`, this API never exposes live actors to the host.
 * Effects use serializable logical refs whose generations survive restore.
 *
 * @experimental
 */
export function createDurableSystem<TLogic extends AnyStateMachine>(
  logic: TLogic
): DurableSystem<TLogic> {
  const executableActions = new WeakMap<
    DurableSystemEffect,
    CustomExecutableActionObject
  >();

  const plan = (
    snapshot: SnapshotFrom<TLogic>,
    system: DurableSystemSnapshot,
    transitionIndex: number,
    executableEffects: ExecutableActionObject[]
  ): DurableSystemTransition<TLogic> => {
    const root = system.actors[system.root].ref;

    const refFor = (actor: AnyActor | undefined): DurableActorRef => {
      if (!actor) {
        return root;
      }
      return getDurableRef(actor);
    };

    const normalizeValue = (value: unknown): any => {
      if (!value || typeof value !== 'object') {
        return value;
      }
      if (durableRefByActor.has(value as object)) {
        return getDurableRef(value as AnyActor);
      }
      if ('sessionId' in value && 'send' in value && 'ref' in value) {
        return refFor(value as unknown as AnyActor);
      }
      if (Array.isArray(value)) {
        return value.map(normalizeValue);
      }
      if (Object.getPrototypeOf(value) !== Object.prototype) {
        return value;
      }
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          normalizeValue(child)
        ])
      );
    };

    const effects: DurableSystemEffect[] = [];
    for (const [effectIndex, effect] of executableEffects.entries()) {
      const metadata = {
        id: `${transitionIndex}:${effectIndex}`,
        transitionIndex,
        effectIndex
      };
      let normalized: DurableSystemEffect;

      if (effect.kind === 'action') {
        normalized = {
          ...metadata,
          type: 'action',
          actionType: effect.type,
          params: normalizeValue(effect.params)
        };
        executableActions.set(normalized, effect);
        effects.push(normalized);
        continue;
      }
      if (effect.kind === 'emit') {
        effects.push({
          ...metadata,
          type: 'event.emit',
          source: refFor(effect.source),
          event: normalizeValue(effect.event)
        });
        continue;
      }

      switch (effect.type) {
        case '@xstate.spawn': {
          if (typeof effect.src !== 'string') {
            throw new Error(
              `Durable actor '${effect.id}' must use a registered string source.`
            );
          }
          const source = refFor(effect.source);
          const actor = refFor(effect.actor);
          normalized = {
            ...metadata,
            type: 'actor.spawn',
            source,
            actor,
            src: effect.src,
            input: normalizeValue(effect.input)
          };
          break;
        }
        case '@xstate.start':
          normalized = {
            ...metadata,
            type: 'actor.start',
            actor: refFor(effect.actor)
          };
          break;
        case '@xstate.stop': {
          const actor = refFor(effect.actor);
          normalized = {
            ...metadata,
            type: 'actor.stop',
            source: refFor(effect.source),
            actor
          };
          break;
        }
        case '@xstate.terminate':
          normalized = {
            ...metadata,
            type: 'actor.terminate',
            actor: refFor(effect.actor),
            status: effect.status,
            output: normalizeValue(effect.output),
            error: normalizeValue(effect.error)
          };
          break;
        case '@xstate.raise':
          normalized = {
            ...metadata,
            type: 'timer.schedule',
            source: refFor(effect.source),
            target: refFor(effect.source),
            timerId: effect.id!,
            delay: effect.delay ?? 0,
            event: normalizeValue(effect.event)
          };
          break;
        case '@xstate.sendTo':
          normalized =
            effect.delay === undefined
              ? {
                  ...metadata,
                  type: 'event.send',
                  source: refFor(effect.source),
                  target: refFor(effect.target),
                  event: normalizeValue(effect.event)
                }
              : {
                  ...metadata,
                  type: 'timer.schedule',
                  source: refFor(effect.source),
                  target: refFor(effect.target),
                  timerId: effect.id!,
                  delay: effect.delay,
                  event: normalizeValue(effect.event)
                };
          break;
        case '@xstate.cancel':
          normalized = {
            ...metadata,
            type: 'timer.cancel',
            source: refFor(effect.source),
            timerId: effect.id
          };
          break;
      }
      effects.push(normalized);
    }

    return {
      state: {
        snapshot,
        system,
        nextTransitionIndex: transitionIndex + 1
      },
      effects,
      accepted: true
    };
  };

  const durable: DurableSystem<TLogic> = {
    initialTransition(...[input]) {
      const system = createInitialSystemSnapshot();
      const planning = createRootPlanningScope(logic, system);
      const [snapshot, effects] = finalizeTransitionResult(
        planning.scope,
        undefined,
        logic.initialTransition(input as never, planning.scope)
      );
      planning.setSnapshot(snapshot);
      return plan(snapshot, system, 0, effects);
    },
    transition(state, event) {
      const resolvedEvent = event as AnyEventObject;
      if (
        isActorLifecycleEvent(resolvedEvent) &&
        typeof resolvedEvent.sessionId === 'string' &&
        typeof resolvedEvent.actorId === 'string'
      ) {
        const record = state.system.actors[resolvedEvent.sessionId];
        const child = getChildren(state.snapshot)[resolvedEvent.actorId];
        if (
          !record ||
          record.parent !== state.system.root ||
          record.ref.actorId !== resolvedEvent.actorId ||
          !child
        ) {
          return { state, effects: [], accepted: false };
        }
      }
      const system = cloneSystemSnapshot(state.system);
      const planning = createRootPlanningScope(logic, system, state.snapshot);
      const [snapshot, effects] = finalizeTransitionResult(
        planning.scope,
        state.snapshot,
        logic.transition(
          state.snapshot,
          resolvedEvent as EventFromLogic<TLogic>,
          planning.scope
        )
      );
      planning.setSnapshot(snapshot);
      return plan(snapshot, system, state.nextTransitionIndex, effects);
    },
    getPersistedSnapshot(state) {
      return logic.getPersistedSnapshot(state.snapshot);
    },
    getPersistedSystemSnapshot(state) {
      return {
        snapshot: logic.getPersistedSnapshot(state.snapshot),
        system: cloneSystemSnapshot(state.system),
        nextTransitionIndex: state.nextTransitionIndex
      };
    },
    restoreSnapshot(snapshot, options) {
      const system = createInitialSystemSnapshot();
      const planning = createRootPlanningScope(logic, system, snapshot);
      const restored = logic.restoreSnapshot!(snapshot, planning.scope);
      planning.setSnapshot(restored);
      if (Object.keys(getChildren(restored)).length) {
        throw new Error(
          'Machine-only durable snapshots cannot restore child actor identities; use getPersistedSystemSnapshot().'
        );
      }
      return {
        snapshot: restored,
        system,
        nextTransitionIndex: options?.transitionIndex ?? 0
      };
    },
    restoreSystemSnapshot(persisted) {
      const system = cloneSystemSnapshot(persisted.system);
      const planning = createRootPlanningScope(
        logic,
        system,
        persisted.snapshot
      );
      const snapshot = logic.restoreSnapshot!(
        persisted.snapshot,
        planning.scope
      );
      planning.setSnapshot(snapshot);
      return {
        snapshot,
        system,
        nextTransitionIndex: persisted.nextTransitionIndex
      };
    },
    executeAction(effect) {
      const executable = executableActions.get(effect);
      if (!executable) {
        throw new Error(
          `Durable effect '${effect.id}' is not executable here.`
        );
      }
      return executable.exec();
    },
    async executeEffects(effects, executor) {
      for (const effect of effects) {
        await executor.execute(
          effect,
          effect.type === 'action'
            ? () => durable.executeAction(effect)
            : undefined
        );
      }
    }
  };

  return durable;
}
