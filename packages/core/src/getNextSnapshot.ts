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
    !!getLazyInertActorState(actorScope) ||
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
    if (lazyState.materialized) {
      lazyState.identityProvider = create;
    } else {
      lazyState.identityProvider ??= create;
    }
  }
  setLazySnapshotActorRef(snapshot as Snapshot<unknown>, create);
  return snapshot;
}

type LazyInertActorState = {
  snapshot: unknown;
  materialized?: AnyActorScope;
  sourceRef?: () => SnapshotActorRef;
  sourceChildren: Record<string, AnyActor | undefined>;
  identityProvider?: () => SnapshotActorRef;
  parent?: AnyActor;
  parentKnown: boolean;
  materialize: () => AnyActorScope;
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
  return getLazyInertActorState(actorScope)!.materialize();
}

const lazyInertActorScopePrototype = {
  [lazyActorScope]: true,
  get _parent() {
    const actorScope = this as AnyActorScope;
    const state = getLazyInertActorState(actorScope)!;
    return state.parentKnown
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
  sourceRef: (() => SnapshotActorRef) | undefined,
  sourceChildren: Record<string, AnyActor | undefined>,
  currentSnapshot: SnapshotFrom<T> | undefined,
  sourceSelf?: AnyActor
): AnyActorScope {
  inertActorMaterializationObserver?.();
  const snapshotRef = sourceRef?.();
  const previousSelf = sourceSelf ?? snapshotRef?.actor;
  const baseSystem = previousSelf?.system;
  const system =
    previousSelf && baseSystem
      ? createSnapshotSystem(
          baseSystem,
          sourceChildren,
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
  const sourceRef =
    sourceState?.identityProvider ??
    (snapshot && typeof snapshot === 'object'
      ? getSnapshotActorRefProvider(snapshot as Snapshot<unknown>)
      : undefined);
  const state = {
    snapshot,
    sourceRef,
    sourceChildren: isMachineSnapshot(snapshot)
      ? (snapshot as any).children
      : {},
    identityProvider: sourceState?.identityProvider ?? sourceRef,
    parent:
      sourceSelf?._parent ??
      sourceState?.parent ??
      eagerSourceRef?.actor._parent,
    parentKnown:
      !!sourceSelf ||
      !!sourceState?.parentKnown ||
      !!eagerSourceRef ||
      !snapshot
  } as LazyInertActorState;
  state.materialize = () =>
    (state.materialized ??= createMaterializedInertActorScope(
      actorLogic,
      state.sourceRef,
      state.sourceChildren,
      state.snapshot as SnapshotFrom<T>,
      sourceSelf
    ));
  if (!state.identityProvider && !snapshot) {
    const identitySnapshot = {} as Snapshot<unknown>;
    const identitySourceRef = state.sourceRef;
    const identitySourceChildren = state.sourceChildren;
    let identityRef: SnapshotActorRef | undefined;
    state.identityProvider = () => {
      if (identityRef) {
        return identityRef;
      }
      const identityScope = createMaterializedInertActorScope(
        actorLogic,
        identitySourceRef,
        identitySourceChildren,
        undefined,
        sourceSelf
      );
      setSnapshotActorRef(
        identitySnapshot,
        identityScope.self,
        identityScope.system
      );
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
    : attachSnapshotActorRef(actorLogic, actorScope, nextSnapshot);
}
