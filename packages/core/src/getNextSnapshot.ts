import { createActor } from './createActor.ts';
import { isMachineSnapshot } from './State.ts';
import {
  createSnapshotSystem,
  getSnapshotActorRef,
  getSnapshotActorRefProvider,
  peekSnapshotActorRef,
  setLazySnapshotActorRef,
  setSnapshotActorRef,
  type SnapshotActorRef
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
import { lazyActorScope } from './actorScope.ts';

/** @internal */
export function setInertActorScopeSnapshot<T>(
  actorScope: AnyActorScope,
  snapshot: T,
  attachActorRef = true
): T {
  const lazyState = getLazyInertActorState(actorScope);
  if (lazyState) {
    lazyState.snapshot = snapshot;
    if (lazyState.m) {
      (lazyState.m.self as any)._snapshot = snapshot;
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
    !!getLazyInertActorState(actorScope) ||
    !!(actorScope.self as any).options?._inert
  );
}

/** @internal */
export function attachSnapshotActorRef<TSnapshot>(
  actorScope: AnyActorScope,
  snapshot: TSnapshot
): TSnapshot {
  setInertActorScopeSnapshot(actorScope, snapshot, false);
  const lazyState = getLazyInertActorState(actorScope);
  snapshotActorScopes.set(snapshot as object, actorScope);
  const create = () => {
    setSnapshotActorRef(
      snapshot as Snapshot<unknown>,
      actorScope.self,
      actorScope.system
    );
    return getSnapshotActorRef(snapshot as Snapshot<unknown>)!;
  };
  if (lazyState) {
    if (lazyState.m) {
      lazyState.ip = create;
    } else {
      lazyState.ip ??= create;
    }
  }
  setLazySnapshotActorRef(snapshot as Snapshot<unknown>, create);
  return snapshot;
}

type LazyInertActorState = {
  snapshot: unknown;
  m?: AnyActorScope;
  sr?: () => SnapshotActorRef;
  sc: Record<string, AnyActor | undefined>;
  ip?: () => SnapshotActorRef;
  parent?: AnyActor;
  pk: boolean;
  mz: () => AnyActorScope;
};

const lazyInertActorState = Symbol();
type LazyInertActorScope = AnyActorScope & {
  [lazyInertActorState]?: LazyInertActorState;
};
const snapshotActorScopes = new WeakMap<object, AnyActorScope>();
let inertActorMaterializationObserver: (() => void) | undefined;

function getLazyInertActorState(
  actorScope: AnyActorScope
): LazyInertActorState | undefined {
  return (actorScope as LazyInertActorScope)[lazyInertActorState];
}

function materializeInertActorScope(actorScope: AnyActorScope): AnyActorScope {
  return getLazyInertActorState(actorScope)!.mz();
}

const lazyInertActorScopePrototype = {
  [lazyActorScope]: true,
  get _parent() {
    const actorScope = this as AnyActorScope;
    const state = getLazyInertActorState(actorScope)!;
    return state.pk
      ? state.parent
      : materializeInertActorScope(actorScope).self._parent;
  },
  get self() {
    return materializeInertActorScope(this as AnyActorScope).self;
  },
  get defer() {
    return materializeInertActorScope(this as AnyActorScope).defer;
  },
  get id() {
    return materializeInertActorScope(this as AnyActorScope).id;
  },
  get logger() {
    return materializeInertActorScope(this as AnyActorScope).logger;
  },
  get sessionId() {
    return materializeInertActorScope(this as AnyActorScope).sessionId;
  },
  get stopChild() {
    return materializeInertActorScope(this as AnyActorScope).stopChild;
  },
  get system() {
    return materializeInertActorScope(this as AnyActorScope).system;
  },
  get emit() {
    return materializeInertActorScope(this as AnyActorScope).emit;
  },
  get actionExecutor() {
    return materializeInertActorScope(this as AnyActorScope).actionExecutor;
  }
};

/** Test-only allocation instrumentation. @internal */
export function setInertActorMaterializationObserver(
  observer: (() => void) | undefined
): void {
  inertActorMaterializationObserver = observer;
}

function createMaterializedInertActorScope<T extends AnyActorLogic>(
  actorLogic: T,
  sr: (() => SnapshotActorRef) | undefined,
  sc: Record<string, AnyActor | undefined>,
  currentSnapshot: SnapshotFrom<T> | undefined,
  sourceSelf?: AnyActor
): AnyActorScope {
  inertActorMaterializationObserver?.();
  const snapshotRef = sr?.();
  const previousSelf = sourceSelf ?? snapshotRef?.actor;
  const system = previousSelf
    ? createSnapshotSystem(
        previousSelf.system,
        sc,
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
    // `address` memoizes on first read assuming `_parent` is final; nothing
    // reads it between construction and this assignment, but drop any memo so
    // a future construction-time read cannot pin a root-shaped address.
    (self as unknown as { _address?: string })._address = undefined;
  }
  if (currentSnapshot) {
    (self as any)._snapshot = currentSnapshot;
  }

  // Reuse the branch actor's scope while keeping planning transactional.
  return Object.create((self as any)._actorScope, {
    defer: { value: () => {} },
    stopChild: { value: (child: AnyActor) => (child as any)._stop() },
    actionExecutor: { value: () => {} }
  });
}

/** @internal */
export function createInertActorScope<T extends AnyActorLogic>(
  actorLogic: T,
  snapshot?: SnapshotFrom<T>,
  sourceSelf?: AnyActor,
  sourceActorScope?: AnyActorScope
): AnyActorScope {
  const sourceScope =
    sourceActorScope ??
    (snapshot && typeof snapshot === 'object'
      ? snapshotActorScopes.get(snapshot as object)
      : undefined);
  const sourceState = sourceScope
    ? getLazyInertActorState(sourceScope)
    : undefined;
  const eagerSourceRef =
    snapshot && typeof snapshot === 'object'
      ? peekSnapshotActorRef(snapshot as Snapshot<unknown>)
      : undefined;
  const sr =
    sourceState?.ip ??
    (snapshot && typeof snapshot === 'object'
      ? getSnapshotActorRefProvider(snapshot as Snapshot<unknown>)
      : undefined);
  const state = {
    snapshot,
    sr,
    sc: isMachineSnapshot(snapshot) ? (snapshot as any).children : {},
    ip: sourceState?.ip ?? sr,
    parent:
      sourceSelf?._parent ??
      sourceState?.parent ??
      eagerSourceRef?.actor._parent,
    pk: !!sourceSelf || !!sourceState?.pk || !!eagerSourceRef || !snapshot
  } as LazyInertActorState;
  state.mz = () =>
    (state.m ??= createMaterializedInertActorScope(
      actorLogic,
      state.sr,
      state.sc,
      state.snapshot as SnapshotFrom<T>,
      sourceSelf
    ));
  if (!state.ip && !snapshot) {
    const identitySnapshot = {} as Snapshot<unknown>;
    const identitySourceRef = state.sr;
    const identitySourceChildren = state.sc;
    let identityScope: AnyActorScope | undefined;
    let identityRef: SnapshotActorRef | undefined;
    const getIdentityScope = () =>
      (identityScope ??= createMaterializedInertActorScope(
        actorLogic,
        identitySourceRef,
        identitySourceChildren,
        undefined,
        sourceSelf
      ));
    state.mz = () => {
      const scope = getIdentityScope();
      if (state.snapshot !== undefined) {
        (scope.self as any)._snapshot = state.snapshot;
      }
      return (state.m = scope);
    };
    state.ip = () => {
      if (identityRef) {
        return identityRef;
      }
      const scope = getIdentityScope();
      setSnapshotActorRef(identitySnapshot, scope.self, scope.system);
      return (identityRef = getSnapshotActorRef(identitySnapshot)!);
    };
  }
  const actorScope = Object.create(lazyInertActorScopePrototype) as ActorScope<
    SnapshotFrom<T>,
    EventFromLogic<T>,
    any,
    EmittedFrom<T>
  >;
  (actorScope as LazyInertActorScope)[lazyInertActorState] = state;
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
    : attachSnapshotActorRef(actorScope, nextSnapshot);
}
