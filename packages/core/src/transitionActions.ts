import isDevelopment from '#is-development';
import { assertSendToEvent, builtInActions } from './actions.ts';
import { resolveRegisteredActorSource } from './actorSource.ts';
import { listenerLogic, type ListenerInput } from './actors/listener.ts';
import {
  subscriptionLogic,
  type SubscriptionInput,
  type SubscriptionMappers
} from './actors/subscription.ts';
import { XSTATE_SPAWN, XSTATE_START, XSTATE_TERMINATE } from './constants.ts';
import { createErrorPlatformEvent } from './eventUtils.ts';
import {
  getActorIdPrefix,
  parseGeneratedActorId,
  type ActorSystemRuntime,
  type DeadLetterDetail,
  type EventRejectionReason
} from './system.ts';
import { withActorScope } from './actorScope.ts';
import { getEventOutput } from './utils.ts';
import type {
  Action,
  ActorTermination,
  AnyAction,
  AnyActor,
  AnyActorLogic,
  AnyActorScope,
  AnyEventObject,
  AnyMachineSnapshot,
  CancelExecutableActionObject,
  CustomExecutableActionObject,
  EmitExecutableActionObject,
  EnqueueObject,
  EventObject,
  ExecutableActionObject,
  MachineContext,
  RaiseExecutableActionObject,
  DeadLetterExecutableActionObject,
  SendToExecutableActionObject,
  Snapshot,
  SpecialExecutableAction,
  SpawnExecutableActionObject,
  StartExecutableActionObject,
  StopExecutableActionObject,
  TerminateExecutableActionObject
} from './types.ts';

type TransitionActionRecord = {
  action: (...args: any[]) => any;
  args: any[];
  childUpdate?:
    | {
        type: 'add';
        actor: AnyActor;
        id: string;
        counters?: Record<string, number>;
      }
    | { type: 'remove'; actor: AnyActor };
};

type EffectRuntime = Partial<ActorSystemRuntime>;

function execCustomEffect(
  this: CustomExecutableActionObject
): void | PromiseLike<void> | undefined {
  return this.action?.(...this.args);
}

function execEmitEffect(
  this: EmitExecutableActionObject,
  runtime: EffectRuntime = this.source.system
): void | PromiseLike<void> {
  return runtime.emitEvent!(this.source, this.event);
}

/** @internal Creates an emitted-event effect. */
export function createEmitEffect(
  actorScope: AnyActorScope,
  event: EventObject
): EmitExecutableActionObject {
  return {
    kind: 'emit',
    exec: execEmitEffect,
    type: event.type,
    source: actorScope.self,
    event,
    params: undefined,
    args: []
  };
}

function execDeadLetterEffect(
  this: DeadLetterExecutableActionObject,
  runtime: EffectRuntime = this.target.system
): void | PromiseLike<void> {
  return runtime.deadLetter!(
    this.source,
    this.target,
    this.event,
    this.reason,
    this.detail
  );
}

/** @internal Creates a dead-letter effect for a boundary-rejected event. */
export function createDeadLetterEffect(
  actorScope: AnyActorScope,
  source: AnyActor | undefined,
  event: AnyEventObject,
  reason: EventRejectionReason,
  detail?: DeadLetterDetail
): DeadLetterExecutableActionObject {
  return {
    kind: 'builtin',
    type: '@xstate.deadLetter',
    exec: execDeadLetterEffect,
    source,
    target: actorScope.self,
    event,
    reason,
    detail,
    params: undefined,
    args: []
  };
}

/** @internal Creates a directly executable user effect. */
export function createCustomEffect(
  type: string,
  action: (runtime?: EffectRuntime) => void | PromiseLike<void> | undefined,
  params?: unknown
): CustomExecutableActionObject {
  return {
    kind: 'action',
    exec: action,
    type,
    action: action as () => void | PromiseLike<void>,
    params,
    args: []
  };
}

function execSpawnEffect(
  this: SpawnExecutableActionObject,
  runtime: EffectRuntime = this.actor.system
) {
  return runtime.spawnActor!(this.source, this.actor);
}
function execStartEffect(
  this: StartExecutableActionObject,
  runtime: EffectRuntime = this.actor.system
) {
  return runtime.startActor!(this.actor);
}
function execStopEffect(
  this: StopExecutableActionObject,
  runtime: EffectRuntime = this.source.system
) {
  return runtime.stopActor!(this.actor);
}
function execTerminateEffect(
  this: TerminateExecutableActionObject,
  runtime: EffectRuntime = this.actor.system
) {
  const termination: ActorTermination =
    this.status === 'done'
      ? { status: 'done', output: this.output, error: undefined }
      : { status: 'error', output: undefined, error: this.error };
  return runtime.terminateActor!(this.actor, termination);
}
function execRaiseEffect(
  this: RaiseExecutableActionObject,
  runtime: EffectRuntime = this.source.system
) {
  return runtime.scheduleTimer!(this.source, this.id!, this.delay ?? 0);
}
function execSendToEffect(
  this: SendToExecutableActionObject,
  runtime: EffectRuntime = this.source.system
) {
  assertSendToEvent(this.event);
  return this.delay === undefined
    ? runtime.sendEvent!(this.source, this.target, this.event)
    : runtime.scheduleTimer!(this.source, this.id!, this.delay);
}
function execCancelEffect(
  this: CancelExecutableActionObject,
  runtime: EffectRuntime = this.source.system
) {
  return runtime.cancelTimer!(this.source, this.id);
}

function updateLogicalTimers(
  snapshot: AnyMachineSnapshot,
  effect: ExecutableActionObject,
  actorScope: AnyActorScope
): AnyMachineSnapshot {
  if (!isBuiltInExecutableAction(effect)) {
    return snapshot;
  }

  if (effect.type === '@xstate.cancel') {
    if (!snapshot.timers?.[effect.id]) {
      return snapshot;
    }
    const timers = { ...snapshot.timers };
    delete timers[effect.id];
    return { ...snapshot, timers };
  }

  if (
    (effect.type !== '@xstate.raise' && effect.type !== '@xstate.sendTo') ||
    effect.delay === undefined
  ) {
    return snapshot;
  }

  let nextTimerId = snapshot._nextTimerId ?? 0;
  const id = effect.id ?? `xstate.timer.auto.${nextTimerId++}`;
  effect.id = id;
  const target =
    effect.type === '@xstate.raise' || effect.target === actorScope.self
      ? 'self'
      : effect.target;

  return {
    ...snapshot,
    timers: {
      ...snapshot.timers,
      [id]: {
        id,
        delay: effect.delay,
        type: effect.type,
        event: effect.event,
        target
      }
    },
    _nextTimerId: nextTimerId
  };
}

export function mergeContextPatch(
  context: MachineContext,
  patch: MachineContext
): MachineContext {
  return { ...context, ...patch };
}

function pushBuiltInAction(actions: any[], action: any, ...args: any[]) {
  const actionRecord: TransitionActionRecord = { action, args };
  actions.push(actionRecord as AnyAction);
  return actionRecord;
}

/** @internal Max-merges generated-id counter records, copy-on-write. */
export function mergeActorIdCounters(
  current: Record<string, number> | undefined,
  update: Record<string, number>
): Record<string, number> {
  const merged = { ...current };
  for (const key of Object.keys(update)) {
    merged[key] = Math.max(merged[key] ?? 0, update[key]);
  }
  return merged;
}

function applyChildUpdate(
  snapshot: AnyMachineSnapshot,
  update: NonNullable<TransitionActionRecord['childUpdate']>,
  actorScope: AnyActorScope
): AnyMachineSnapshot {
  if (update.type === 'add') {
    return {
      ...snapshot,
      children: { ...snapshot.children, [update.id]: update.actor },
      ...(update.counters && {
        _nextActorIds: mergeActorIdCounters(
          snapshot._nextActorIds,
          update.counters
        )
      })
    };
  }

  const children = { ...snapshot.children };
  let owned = update.actor._parent === actorScope.self;
  for (const key of Object.keys(children)) {
    if (children[key] === update.actor) {
      owned = true;
      delete children[key];
    }
  }
  if (!owned) {
    throw new Error(
      isDevelopment
        ? `Cannot stop child actor ${update.actor.id} of ${actorScope.self.id} because it is not a child`
        : `Cannot stop non-child actor ${update.actor.id}`
    );
  }
  actorScope.system._unregister(update.actor);
  return { ...snapshot, children };
}

function getTransitionActionRecord(
  action: AnyAction
): TransitionActionRecord | undefined {
  if (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    typeof action.action === 'function'
  ) {
    return action as TransitionActionRecord;
  }
  return undefined;
}

function pushSpawnedChild(
  actions: any[],
  actor: AnyActor,
  id: string,
  counters?: Record<string, number>
) {
  const action = pushBuiltInAction(
    actions,
    builtInActions['@xstate.spawn'],
    actor
  );
  action.childUpdate = { type: 'add', actor, id, counters };
}

/**
 * Spawn-allocation state shared by every enqueue object of one transition, so
 * generated ids stay unique and resolvable across action functions and
 * microsteps of the same event.
 */
interface SpawnAllocation {
  counters: Map<string, number>;
  /** Explicit child ids claimed by spawns/invokes of this transition. */
  explicitIds: Set<string>;
  /** Ids of children stopped by this transition, freeing them for reuse. */
  stoppedIds: Set<string>;
}

const spawnAllocations = new WeakMap<object, SpawnAllocation>();

const createSpawnAllocation = (): SpawnAllocation => ({
  counters: new Map(),
  explicitIds: new Set(),
  stoppedIds: new Set()
});

/**
 * Starts a fresh spawn-allocation transaction for one logical transition.
 * Called at every transition boundary so pure replays from the same snapshot
 * allocate identical ids.
 *
 * @internal
 */
export function beginSpawnAllocation(actorScope: AnyActorScope): void {
  spawnAllocations.set(actorScope, createSpawnAllocation());
}

// Read the raw snapshot: getSnapshot() throws while the actor initializes,
// and entry actions run before any snapshot exists.
function getWorkingSnapshotOf(actorScope: AnyActorScope):
  | {
      _nextActorIds?: Record<string, number>;
      children?: Record<string, AnyActor | undefined>;
    }
  | undefined {
  return (
    actorScope.self as {
      _snapshot?: {
        _nextActorIds?: Record<string, number>;
        children?: Record<string, AnyActor | undefined>;
      };
    }
  )._snapshot;
}

function getRegisteredActors(
  actorScope: AnyActorScope
): Record<string, AnyActorLogic> | undefined {
  return (
    actorScope.self as {
      logic?: { sources?: { actors?: Record<string, AnyActorLogic> } };
    }
  ).logic?.sources?.actors;
}

function resolveTransitionSpawnSource(
  actorScope: AnyActorScope,
  source: string | AnyActorLogic
): { logic: AnyActorLogic; src: string | undefined } {
  const registeredActors = getRegisteredActors(actorScope);
  if (typeof source === 'string') {
    const logic = registeredActors?.[source];
    if (!logic) {
      throw new Error(`Actor source '${source}' is not provided`);
    }
    return { logic, src: source };
  }
  if (!registeredActors) {
    return { logic: source, src: undefined };
  }
  return {
    logic: source,
    src: resolveRegisteredActorSource(registeredActors, source)
  };
}

/**
 * Internal helper actors (listeners, subscriptions) number their ids from
 * system-level counters under `xstate.`-prefixed names; snapshot-owned
 * children number from per-snapshot counters. The two spaces only stay
 * collision-free because their prefixes are disjoint, so user sources must
 * not enter the reserved namespace.
 */
function assertUnreservedPrefix(prefix: string): void {
  if (isDevelopment && prefix.startsWith('xstate.')) {
    throw new Error(
      `Child actor ids with the "xstate." prefix are reserved for internal actors; rename the "${prefix}" source or logic id.`
    );
  }
}

/**
 * The next free index for a prefix. The parent snapshot's persisted counter
 * is always a floor, so a freed id is never handed out again — not even when
 * an explicit id reserved a lower one earlier in the transition.
 */
function nextChildIndex(
  actorScope: AnyActorScope,
  allocation: SpawnAllocation,
  prefix: string
): number {
  return Math.max(
    allocation.counters.get(prefix) ?? 0,
    getWorkingSnapshotOf(actorScope)?._nextActorIds?.[prefix] ?? 0
  );
}

/**
 * Allocates the next generated child id for the transition's allocation
 * transaction, seeded from the parent snapshot's own persisted counters. This
 * is the single allocator for snapshot-owned children (`enq.spawn` and
 * context-factory spawns); a correct allocation cannot collide.
 *
 * @internal
 */
export function allocateChildId(
  actorScope: AnyActorScope,
  src: string | AnyActorLogic,
  localAllocation?: SpawnAllocation
): { id: string; counters: Record<string, number> } {
  if (isDevelopment && !spawnAllocations.get(actorScope)) {
    console.warn(
      'A child id was generated outside a spawn-allocation transaction; ids may repeat across enqueue objects. Transition entry points must call beginSpawnAllocation().'
    );
  }
  const allocation =
    spawnAllocations.get(actorScope) ??
    localAllocation ??
    createSpawnAllocation();
  const prefix = getActorIdPrefix(src);
  assertUnreservedPrefix(prefix);
  const next = nextChildIndex(actorScope, allocation, prefix);
  allocation.counters.set(prefix, next + 1);
  return { id: `${prefix}:${next}`, counters: { [prefix]: next + 1 } };
}

/**
 * Requires an explicit child id to be unoccupied before a spawn or invoke
 * claims it: an address must name at most one live actor. An id is occupied
 * when a child of this parent already holds it and this transition has not
 * stopped that child, or when an earlier spawn of this transition claimed it.
 *
 * @internal
 */
export function assertChildIdFree(
  actorScope: AnyActorScope,
  id: string,
  localAllocation?: SpawnAllocation
): void {
  const allocation =
    spawnAllocations.get(actorScope) ??
    localAllocation ??
    createSpawnAllocation();
  const existing = getWorkingSnapshotOf(actorScope)?.children?.[id] as
    | AnyActor
    | undefined;
  // A terminated child no longer occupies its id: it relayed its completion
  // and is removed from `children` right after the transition handling it,
  // so the supervisor pattern — respawn under the same name while handling
  // the child's done/error event — must not conflict with the outgoing
  // entry. Remote handles never expose a terminal status locally; the
  // completion event that removes one is the owning runtime's business.
  const occupied =
    existing !== undefined &&
    !allocation.stoppedIds.has(id) &&
    existing.getSnapshot().status === 'active';
  if (allocation.explicitIds.has(id) || occupied) {
    throw new Error(
      isDevelopment
        ? `Cannot spawn child actor with id '${id}': the id is already in use by another child of '${actorScope.self.id}'. Stop the existing child before reusing its id.`
        : `Child actor id '${id}' is already in use`
    );
  }
  allocation.explicitIds.add(id);
}

/**
 * Records that this transition stopped a child, freeing its id for a later
 * spawn or invoke of the same transition (the invoke restart pattern).
 *
 * @internal
 */
function recordStoppedChild(actorScope: AnyActorScope, actor: AnyActor): void {
  const allocation = spawnAllocations.get(actorScope);
  if (allocation) {
    allocation.stoppedIds.add(actor.id);
    allocation.explicitIds.delete(actor.id);
  }
}

/**
 * Reserves an explicit generated-shaped id (`worker:5`) in the transaction
 * and the parent snapshot, so live runs and pure replays allocate the same
 * later ids even after this child is removed.
 *
 * @internal
 */
export function reserveChildId(
  actorScope: AnyActorScope,
  id: string,
  localAllocation?: SpawnAllocation
): Record<string, number> | undefined {
  const generated = parseGeneratedActorId(id);
  if (!generated) {
    return undefined;
  }
  assertUnreservedPrefix(generated.prefix);
  const allocation =
    spawnAllocations.get(actorScope) ??
    localAllocation ??
    createSpawnAllocation();
  // The requested id is used as asked, but numbering continues from the
  // highest reservation: an explicit low id never rewinds the counter.
  const next = Math.max(
    nextChildIndex(actorScope, allocation, generated.prefix),
    generated.index + 1
  );
  allocation.counters.set(generated.prefix, next);
  return { [generated.prefix]: next };
}

/**
 * The counters allocated so far in the transition's transaction, for
 * committing into a snapshot built outside `applyChildUpdate` (the
 * pre-initial snapshot with context-factory spawns).
 *
 * @internal
 */
export function takeSpawnAllocationCounters(
  actorScope: AnyActorScope
): Record<string, number> | undefined {
  const counters = spawnAllocations.get(actorScope)?.counters;
  if (!counters?.size) {
    return undefined;
  }
  return Object.fromEntries(counters);
}

export function createTransitionEnqueue(
  actorScope: AnyActorScope,
  actions: any[],
  internalEvents: EventObject[],
  actorSubscriptions = false,
  createActors = true
) {
  // Paths that never begin a transaction keep a per-enqueue scope.
  const localAllocation =
    spawnAllocations.get(actorScope) ?? createSpawnAllocation();
  const props: Partial<EnqueueObject<any, any>> = {
    cancel: (id: string) => {
      pushBuiltInAction(
        actions,
        builtInActions['@xstate.cancel'],
        actorScope,
        id
      );
    },
    emit: (emittedEvent) => {
      actions.push(emittedEvent);
    },
    log: (...args) => {
      pushBuiltInAction(actions, actorScope.logger, ...args);
    },
    raise: (raisedEvent, options) => {
      if (typeof raisedEvent === 'string') {
        throw new Error(
          isDevelopment
            ? `Only event objects may be used with raise; use raise({ type: "${raisedEvent}" }) instead`
            : `Only event objects may be used with raise`
        );
      }
      if (options?.delay !== undefined) {
        pushBuiltInAction(
          actions,
          builtInActions['@xstate.raise'],
          actorScope,
          raisedEvent,
          options
        );
      } else {
        internalEvents.push(raisedEvent);
      }
    },
    spawn: (source: string | AnyActorLogic, options: any) => {
      const { logic, src } = resolveTransitionSpawnSource(actorScope, source);
      if (!createActors) {
        // TODO: replace this speculative placeholder with a typed inert actor ref.
        return {
          id: options?.id ?? options?.registryKey ?? src ?? (logic as any).id
        } as AnyActor;
      }
      // Generated ids allocate from the parent snapshot's own counters
      // through the transition's allocation transaction; explicit
      // generated-shaped ids reserve their numbering the same way.
      let id = options?.id;
      let counters: Record<string, number> | undefined;
      if (id === undefined) {
        ({ id, counters } = allocateChildId(
          actorScope,
          src ?? logic,
          localAllocation
        ));
      } else {
        assertChildIdFree(actorScope, id, localAllocation);
        counters = reserveChildId(actorScope, id, localAllocation);
      }
      const actor = actorScope.system.createActorRef(logic, {
        ...options,
        ...(src !== undefined && { src }),
        id,
        parent: actorScope.self
      });
      pushSpawnedChild(actions, actor, id, counters);
      return actor;
    },
    sendTo: (actor, event, options) => {
      if (!actor) {
        internalEvents.push(
          createErrorPlatformEvent('communication', {
            message: 'Unable to send event to an undefined actor',
            event
          })
        );
        return;
      }
      pushBuiltInAction(
        actions,
        builtInActions['@xstate.sendTo'],
        actorScope,
        actor,
        event,
        options
      );
    },
    stop: (actor) => {
      if (actor) {
        // enq.stop accepts the consumer ActorRef contract; refs handed to
        // machine code are always full actor instances at runtime.
        const actorInstance = actor as AnyActor;
        const action = pushBuiltInAction(
          actions,
          builtInActions['@xstate.stop'],
          actorScope,
          actorInstance
        );
        action.childUpdate = { type: 'remove', actor: actorInstance };
        recordStoppedChild(actorScope, actorInstance);
      }
    }
  };

  if (actorSubscriptions) {
    Object.assign(props, {
      listen: (actor: any, eventType: string, mapper: any) => {
        if (!createActors) {
          return { id: undefined } as unknown as AnyActor;
        }
        const input: ListenerInput<any, any> = {
          actor,
          eventType,
          mapper
        };
        const listenerActor = actorScope.system.createActorRef(listenerLogic, {
          input,
          parent: actorScope.self
        });
        pushBuiltInAction(
          actions,
          builtInActions['@xstate.spawn'],
          listenerActor
        );
        return listenerActor;
      },
      subscribeTo: (actor: any, mappers: any) => {
        if (!createActors) {
          return { id: undefined } as unknown as AnyActor;
        }
        const normalizedMappers: SubscriptionMappers<any, any, any> =
          typeof mappers === 'function' ? { snapshot: mappers } : mappers;

        const input: SubscriptionInput<any, any, any, any> = {
          actor,
          mappers: normalizedMappers
        };
        const subscriptionActor = actorScope.system.createActorRef(
          subscriptionLogic,
          {
            input,
            parent: actorScope.self
          }
        );
        pushBuiltInAction(
          actions,
          builtInActions['@xstate.spawn'],
          subscriptionActor
        );
        return subscriptionActor;
      }
    });
  }

  return createEnqueueObject(props, (action, ...args) => {
    pushBuiltInAction(actions, action, ...args);
  });
}

function getBuiltInActionFields(
  action: (...args: any[]) => void,
  args: unknown[]
): Partial<SpecialExecutableAction> | undefined {
  const [scope, first, second, third] = args as any[];
  switch (action) {
    case builtInActions['@xstate.spawn']: {
      const actor = scope as AnyActor;
      return {
        kind: 'builtin',
        exec: execSpawnEffect,
        source: actor._parent,
        actor,
        id: actor.id,
        logic: (actor as any).logic,
        src: actor.src,
        input: (actor as any).options?.input
      };
    }
    case builtInActions['@xstate.raise']: {
      return {
        kind: 'builtin',
        exec: execRaiseEffect,
        source: scope.self,
        event: first,
        id: second?.id,
        delay: second?.delay
      };
    }
    case builtInActions['@xstate.sendTo']: {
      return {
        kind: 'builtin',
        exec: execSendToEffect,
        source: scope.self,
        target: first,
        event: second,
        id: third?.id,
        delay: third?.delay
      };
    }
    case builtInActions['@xstate.cancel']: {
      return {
        kind: 'builtin',
        exec: execCancelEffect,
        source: scope.self,
        id: first
      };
    }
    case builtInActions['@xstate.stop']: {
      return {
        kind: 'builtin',
        exec: execStopEffect,
        source: scope.self,
        actor: first,
        id: first.id
      };
    }
    default:
      return undefined;
  }
}

function createStartEffect(actor: AnyActor): StartExecutableActionObject {
  const args: Parameters<(typeof builtInActions)['@xstate.start']> = [actor];
  return {
    kind: 'builtin',
    exec: execStartEffect,
    type: XSTATE_START,
    source: actor._parent,
    params: undefined,
    args,
    actor,
    id: actor.id
  };
}

export function createSpawnEffect(
  actor: AnyActor
): SpawnExecutableActionObject {
  const args: Parameters<(typeof builtInActions)['@xstate.spawn']> = [actor];
  return {
    ...getBuiltInActionFields(builtInActions['@xstate.spawn'], args),
    type: XSTATE_SPAWN,
    params: undefined,
    args
  } as SpawnExecutableActionObject;
}

/** @internal Creates an immediate actor-to-actor delivery effect. */
export function createSendToEffect(
  actorScope: AnyActorScope,
  target: AnyActor,
  event: EventObject
): SendToExecutableActionObject {
  const args: Parameters<(typeof builtInActions)['@xstate.sendTo']> = [
    actorScope,
    target,
    event,
    {}
  ];
  return {
    kind: 'builtin',
    exec: execSendToEffect,
    type: '@xstate.sendTo',
    source: actorScope.self,
    target,
    event,
    id: undefined,
    delay: undefined,
    params: undefined,
    args
  };
}

/** @internal Creates the terminal lifecycle effect for an actor. */
export function createTerminationEffect(
  actorScope: AnyActorScope,
  snapshot: Snapshot<unknown>
): TerminateExecutableActionObject {
  if (snapshot.status !== 'done' && snapshot.status !== 'error') {
    throw new Error('Cannot terminate an active or stopped actor');
  }
  const termination: ActorTermination =
    snapshot.status === 'done'
      ? { status: 'done', output: snapshot.output, error: undefined }
      : { status: 'error', output: undefined, error: snapshot.error };
  const args: Parameters<(typeof builtInActions)['@xstate.terminate']> = [
    actorScope.self,
    termination
  ];
  return {
    kind: 'builtin',
    exec: execTerminateEffect,
    type: XSTATE_TERMINATE,
    source: actorScope.self,
    actor: actorScope.self,
    id: actorScope.self.id,
    ...termination,
    params: undefined,
    args
  };
}

/**
 * Ensures that a newly terminal snapshot has exactly one ordered actor
 * termination effect.
 *
 * @internal
 */
export function finalizeTransitionResult<
  TSnapshot extends Snapshot<unknown>,
  TEffect
>(
  actorScope: AnyActorScope,
  previousSnapshot: TSnapshot | undefined,
  [nextSnapshot, effects]: [TSnapshot, TEffect[]]
): [TSnapshot, Array<TEffect | TerminateExecutableActionObject>] {
  const becameTerminal =
    nextSnapshot.status === 'done' || nextSnapshot.status === 'error';
  const wasTerminal =
    previousSnapshot?.status === 'done' || previousSnapshot?.status === 'error';
  const hasTerminationEffect = effects.some(
    (effect) =>
      typeof effect === 'object' &&
      effect !== null &&
      'type' in effect &&
      effect.type === XSTATE_TERMINATE
  );

  return becameTerminal && !wasTerminal && !hasTerminationEffect
    ? [
        nextSnapshot,
        [...effects, createTerminationEffect(actorScope, nextSnapshot)]
      ]
    : [nextSnapshot, effects];
}

/**
 * Attached (listener/subscription) starts are ordered before child starts so
 * that a listener/subscription captures events emitted synchronously as its
 * target actor starts.
 */
export function deriveDeferredStarts(
  effects: ReadonlyArray<ExecutableActionObject>
): StartExecutableActionObject[] {
  const attachedStarts: StartExecutableActionObject[] = [];
  const childStarts: StartExecutableActionObject[] = [];

  for (const effect of effects) {
    if (!isBuiltInExecutableAction(effect) || effect.type !== XSTATE_SPAWN) {
      continue;
    }
    const { actor, logic } = effect;
    const start = createStartEffect(actor);
    if (logic === listenerLogic || logic === subscriptionLogic) {
      attachedStarts.push(start);
    } else {
      childStarts.push(start);
    }
  }

  return [...attachedStarts, ...childStarts];
}

export function isBuiltInExecutableAction(
  action: ExecutableActionObject
): action is SpecialExecutableAction {
  return action.kind === 'builtin';
}

/** Executes transition effects sequentially, awaiting each runtime operation. */
export async function executeEffects(
  effects: readonly ExecutableActionObject[],
  runtime?: Partial<ActorSystemRuntime>
): Promise<void> {
  for (const effect of effects) {
    await effect.exec(runtime);
  }
}

export function resolveActionsWithContext(
  currentSnapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  actions: AnyAction[]
): [AnyMachineSnapshot, ExecutableActionObject[]] {
  let intermediateSnapshot = currentSnapshot;
  const executableActions: ExecutableActionObject[] = [];

  for (const action of actions) {
    const actionArgs = withActorScope(
      {
        context: intermediateSnapshot.context,
        event,
        output: getEventOutput(event),
        children: intermediateSnapshot.children,
        actions: currentSnapshot.machine.sources.actions,
        actors: currentSnapshot.machine.sources.actors
      },
      actorScope
    );

    const isInline = typeof action === 'function';
    const actionRecord = getTransitionActionRecord(action);

    const resolvedAction = isInline
      ? action
      : actionRecord
        ? actionRecord.action.bind(null, ...actionRecord.args)
        : false;

    let actionParams = undefined;

    if (typeof action === 'object' && action !== null) {
      const {
        type: _,
        childUpdate: _childUpdate,
        ...emittedEventParams
      } = action as any;
      actionParams = emittedEventParams;
    }

    if (actionRecord?.childUpdate) {
      intermediateSnapshot = applyChildUpdate(
        intermediateSnapshot,
        actionRecord.childUpdate,
        actorScope
      );
    }

    if (resolvedAction && '_special' in resolvedAction) {
      executableActions.push({
        kind: 'action',
        exec: execCustomEffect,
        type:
          typeof action === 'object'
            ? 'action' in action && typeof action.action === 'function'
              ? (action.action.name ?? '(anonymous)')
              : ((action as any).type ?? '(anonymous)')
            : action.name || '(anonymous)',
        params: actionParams,
        args: [],
        action: undefined
      });

      const specialAction = resolvedAction as unknown as Action<
        any,
        any,
        any,
        any,
        any,
        any,
        any
      >;

      const res = specialAction(actionArgs as any, emptyEnqueueObject);

      if (res && ('context' in res || 'children' in res)) {
        // Special-action patches never change `nodes`, so a shallow clone is
        // equivalent to `cloneMachineSnapshot` — and keeps this module (and
        // non-machine logic like `createFSM`) independent of State.ts.
        intermediateSnapshot = {
          ...intermediateSnapshot,
          ...(res.context !== undefined
            ? {
                context: mergeContextPatch(
                  intermediateSnapshot.context,
                  res.context
                )
              }
            : {}),
          ...('children' in res ? { children: res.children } : {})
        };
      }
      continue;
    }

    if (!resolvedAction || !('resolve' in resolvedAction)) {
      const builtInFields =
        typeof action === 'object' &&
        action !== null &&
        'action' in action &&
        typeof action.action === 'function'
          ? getBuiltInActionFields(action.action, action.args)
          : undefined;
      const isEmittedEvent =
        typeof action === 'object' && action !== null && !actionRecord;

      const executableAction = {
        kind: builtInFields
          ? ('builtin' as const)
          : isEmittedEvent
            ? ('emit' as const)
            : ('action' as const),
        type:
          typeof action === 'object'
            ? 'action' in action && typeof action.action === 'function'
              ? (action.action.name ?? '(anonymous)')
              : (action as AnyEventObject).type
            : action.name || '(anonymous)',
        params: builtInFields ? undefined : actionParams,
        args:
          typeof action === 'object' && 'action' in action ? action.args : [],
        ...(builtInFields
          ? {}
          : isEmittedEvent
            ? { source: actorScope.self, event: action }
            : {
                action: actionRecord?.action ?? (isInline ? action : undefined)
              }),
        ...(!builtInFields
          ? { exec: isEmittedEvent ? execEmitEffect : execCustomEffect }
          : {}),
        ...builtInFields
      };

      const typedExecutableAction = executableAction as ExecutableActionObject;
      intermediateSnapshot = updateLogicalTimers(
        intermediateSnapshot,
        typedExecutableAction,
        actorScope
      );
      executableActions.push(typedExecutableAction);
      continue;
    }
  }

  return [intermediateSnapshot, executableActions];
}

export function createEnqueueObject(
  props: Partial<EnqueueObject<any, any>>,
  action: <T extends (...args: any[]) => any>(
    fn: T,
    ...args: Parameters<T>
  ) => void
): EnqueueObject<any, any> {
  const enqueueFn = (
    fn: (...args: any[]) => any,
    ...args: Parameters<typeof fn>
  ) => {
    action(fn, ...args);
  };

  Object.assign(enqueueFn, {
    cancel: noop,
    emit: noop,
    log: noop,
    raise: noop,
    spawn: emptyActor,
    sendTo: noop,
    stop: noop,
    listen: emptyActor,
    subscribeTo: emptyActor,
    ...props
  });

  return enqueueFn as any;
}

const noop = () => {};
const emptyActor = () => ({}) as any;

const emptyEnqueueObject = createEnqueueObject({}, noop);
