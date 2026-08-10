import { createActor } from './createActor.ts';
import { isMachineSnapshot } from './State.ts';
import {
  copySnapshotActorRef,
  createSnapshotSystem,
  getSnapshotActorRef,
  setLazySnapshotActorRef,
  setSnapshotActorRef
} from './snapshotActorRef.ts';
import {
  ActorScope,
  AnyActor,
  AnyActorLogic,
  AnyActorScope,
  EmittedFrom,
  EventFromLogic,
  InputFrom,
  Snapshot,
  SnapshotFrom
} from './types.ts';

/** @internal */
export function setInertActorScopeSnapshot<T>(
  actorScope: AnyActorScope,
  snapshot: T,
  attachActorRef = true
): T {
  const lazyState = lazyInertActorScopes.get(actorScope);
  if (lazyState) {
    lazyState.snapshot = snapshot;
    if (lazyState.materialized) {
      (lazyState.materialized.self as any)._snapshot = snapshot;
    }
  } else {
    (actorScope.self as any)._snapshot = snapshot;
  }
  if (attachActorRef && snapshot && typeof snapshot === 'object') {
    setSnapshotActorRef(snapshot as any, actorScope.self);
  }
  return snapshot;
}

/** @internal */
export function isInertActorScope(actorScope: AnyActorScope): boolean {
  return (
    lazyInertActorScopes.has(actorScope) ||
    !!(actorScope.self as any).options?._inert
  );
}

/** @internal */
export function attachSnapshotActorRef<T extends AnyActorLogic, TSnapshot>(
  _actorLogic: T,
  actorScope: AnyActorScope,
  snapshot: TSnapshot
): TSnapshot {
  setInertActorScopeSnapshot(actorScope, snapshot, false);
  const lazyState = lazyInertActorScopes.get(actorScope);
  if (
    lazyState &&
    !lazyState.materialized &&
    lazyState.sourceSnapshot &&
    typeof lazyState.sourceSnapshot === 'object' &&
    copySnapshotActorRef(
      lazyState.sourceSnapshot as Snapshot<unknown>,
      snapshot as Snapshot<unknown>
    )
  ) {
    snapshotActorScopes.set(
      snapshot as object,
      lazyState.sourceScope ?? actorScope
    );
    return snapshot;
  }
  snapshotActorScopes.set(snapshot as object, actorScope);
  setLazySnapshotActorRef(snapshot as Snapshot<unknown>, () => {
    setSnapshotActorRef(
      snapshot as Snapshot<unknown>,
      actorScope.self,
      actorScope.system
    );
    return getSnapshotActorRef(snapshot as Snapshot<unknown>)!;
  });
  return snapshot;
}

type LazyInertActorState = {
  sourceSnapshot: unknown;
  snapshot: unknown;
  materialized?: AnyActorScope;
  sourceScope?: AnyActorScope;
  parent?: AnyActor;
  parentKnown: boolean;
};

const lazyInertActorScopes = new WeakMap<AnyActorScope, LazyInertActorState>();
const snapshotActorScopes = new WeakMap<object, AnyActorScope>();
let inertActorMaterializationObserver: (() => void) | undefined;

/** Test-only allocation instrumentation. @internal */
export function setInertActorMaterializationObserver(
  observer: (() => void) | undefined
): void {
  inertActorMaterializationObserver = observer;
}

function createMaterializedInertActorScope<T extends AnyActorLogic>(
  actorLogic: T,
  sourceSnapshot: SnapshotFrom<T> | undefined,
  currentSnapshot: SnapshotFrom<T> | undefined,
  sourceSelf?: AnyActor
): AnyActorScope {
  inertActorMaterializationObserver?.();
  const snapshotRef = sourceSnapshot
    ? getSnapshotActorRef(sourceSnapshot)
    : undefined;
  const previousSelf = sourceSelf ?? snapshotRef?.actor;
  const baseSystem = previousSelf?.system;
  const system =
    previousSelf && baseSystem
      ? createSnapshotSystem(
          baseSystem,
          isMachineSnapshot(sourceSnapshot)
            ? (sourceSnapshot as any).children
            : {},
          sourceSelf ? undefined : snapshotRef?.systemState
        )
      : undefined;
  const self = createActor(
    actorLogic as AnyActorLogic,
    {
      _inert: true,
      ...(previousSelf
        ? {
            id: previousSelf.id,
            _sessionId: previousSelf.sessionId
          }
        : {}),
      ...(system ? { _systemRef: { current: system } } : {})
    } as any
  );
  if (previousSelf?._parent) {
    self._parent = previousSelf._parent;
  }
  if (currentSnapshot) {
    (self as any)._snapshot = currentSnapshot;
    setSnapshotActorRef(
      currentSnapshot as Snapshot<unknown>,
      self,
      self.system,
      sourceSnapshot as Snapshot<unknown> | undefined
    );
  }

  return {
    self: self as any,
    defer: () => {},
    id: self.id,
    logger: self.system._logger,
    sessionId: self.sessionId,
    stopChild: (child) => (child as any)._stop(),
    system: self.system,
    emit: (event) => self.system.emitEvent(self, event),
    actionExecutor: () => {}
  };
}

/** @internal */
export function createInertActorScope<T extends AnyActorLogic>(
  actorLogic: T,
  snapshot?: SnapshotFrom<T>,
  sourceSelf?: AnyActor
): AnyActorScope {
  const sourceScope =
    snapshot && typeof snapshot === 'object'
      ? snapshotActorScopes.get(snapshot as object)
      : undefined;
  const sourceState = sourceScope
    ? lazyInertActorScopes.get(sourceScope)
    : undefined;
  const state: LazyInertActorState = {
    sourceSnapshot: snapshot,
    snapshot,
    sourceScope,
    parent: sourceSelf?._parent ?? sourceState?.parent,
    parentKnown: !!sourceSelf || !!sourceState?.parentKnown || !snapshot
  };
  const materialize = () =>
    (state.materialized ??= createMaterializedInertActorScope(
      actorLogic,
      state.sourceSnapshot as SnapshotFrom<T>,
      state.snapshot as SnapshotFrom<T>,
      sourceSelf
    ));
  const actorScope = {} as ActorScope<
    SnapshotFrom<T>,
    EventFromLogic<T>,
    any,
    EmittedFrom<T>
  >;
  const systemProxy = new Proxy({} as AnyActor['system'], {
    get: (_, key) => {
      if (key === '_hasInspectionObservers') {
        return () => false;
      }
      if (key === '_sendInspectionEvent') {
        return () => {};
      }
      const system = materialize().system as any;
      return Reflect.get(system, key, system);
    },
    set: (_, key, value) => {
      const system = materialize().system as any;
      return Reflect.set(system, key, value, system);
    }
  });
  const selfProxy = new Proxy({} as AnyActor, {
    get: (_, key) => {
      if (key === '_parent' && state.parentKnown) {
        return state.parent;
      }
      if (key === 'system') {
        return systemProxy;
      }
      const self = materialize().self as any;
      return Reflect.get(self, key, self);
    },
    set: (_, key, value) => {
      const self = materialize().self as any;
      return Reflect.set(self, key, value, self);
    },
    has: (_, key) => {
      if (key === 'system' || (key === '_parent' && state.parentKnown)) {
        return true;
      }
      return key in materialize().self;
    },
    ownKeys: () => Reflect.ownKeys(materialize().self),
    getOwnPropertyDescriptor: (_, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(
        materialize().self,
        key
      );
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    }
  });
  Object.defineProperties(actorScope, {
    _isInert: { value: true },
    self: { enumerable: true, value: selfProxy },
    defer: { enumerable: true, get: () => materialize().defer },
    id: { enumerable: true, get: () => materialize().id },
    logger: { enumerable: true, get: () => materialize().logger },
    sessionId: { enumerable: true, get: () => materialize().sessionId },
    stopChild: { enumerable: true, get: () => materialize().stopChild },
    system: { enumerable: true, value: systemProxy },
    emit: { enumerable: true, get: () => materialize().emit },
    actionExecutor: {
      enumerable: true,
      get: () => materialize().actionExecutor
    }
  });
  lazyInertActorScopes.set(actorScope, state);
  return actorScope;
}

/** @deprecated Use `initialTransition(…)` instead. */
export function getInitialSnapshot<T extends AnyActorLogic>(
  actorLogic: T,
  ...[input]: undefined extends InputFrom<T>
    ? [input?: InputFrom<T>]
    : [input: InputFrom<T>]
): SnapshotFrom<T> {
  const actorScope = createInertActorScope(actorLogic);
  return actorLogic.initialTransition(input, actorScope)[0];
}

/**
 * Determines the next snapshot for the given `actorLogic` based on the given
 * `snapshot` and `event`.
 *
 * If the `snapshot` is `undefined`, the initial snapshot of the `actorLogic` is
 * used.
 *
 * @deprecated Use `transition(…)` instead.
 * @example
 *
 * ```ts
 * import { getNextSnapshot } from 'xstate';
 * import { trafficLightMachine } from './trafficLightMachine.ts';
 *
 * const nextSnapshot = getNextSnapshot(
 *   trafficLightMachine, // actor logic
 *   undefined, // snapshot (or initial state if undefined)
 *   { type: 'TIMER' }
 * ); // event object
 *
 * console.log(nextSnapshot.value);
 * // => 'yellow'
 *
 * const nextSnapshot2 = getNextSnapshot(
 *   trafficLightMachine, // actor logic
 *   nextSnapshot, // snapshot
 *   { type: 'TIMER' }
 * ); // event object
 *
 * console.log(nextSnapshot2.value);
 * // =>'red'
 * ```
 */
export function getNextSnapshot<T extends AnyActorLogic>(
  actorLogic: T,
  snapshot: SnapshotFrom<T>,
  event: EventFromLogic<T>
): SnapshotFrom<T> {
  const actorScope = createInertActorScope(actorLogic, snapshot);
  const transitionResult = actorLogic.transition(snapshot, event, actorScope);
  const nextSnapshot = Array.isArray(transitionResult)
    ? transitionResult[0]
    : transitionResult;
  setInertActorScopeSnapshot(actorScope, nextSnapshot, false);
  return nextSnapshot === snapshot
    ? nextSnapshot
    : attachSnapshotActorRef(actorLogic, actorScope, nextSnapshot);
}
