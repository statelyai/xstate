import { XSTATE_TERMINATE } from './constants.ts';
import { cloneMachineSnapshot } from './State.ts';
import { createDoneActorEvent, createErrorActorEvent } from './eventUtils.ts';
import { isRemoteActorRef } from './remoteActorRef.ts';
import { getSnapshotActorRef } from './snapshotActorRef.ts';
import { encodeAddressSegment, getRootActorId } from './system.ts';
import { transition } from './transition.ts';
import { markFoldedTerminateEffect } from './transitionActions.ts';
import type {
  AnyActor,
  AnyActorLogic,
  AnyEventObject,
  AnyMachineSnapshot,
  AnyStateMachine,
  ExecutableActionObject,
  Snapshot,
  SnapshotFrom,
  TerminateExecutableActionObject
} from './types.ts';

interface ChildLink {
  /** The id under which `ref` is stored in its parent's `children`. */
  id: string;
  ref: AnyActor;
  /** The snapshot whose `children` holds `ref`. */
  parentSnapshot: AnyMachineSnapshot;
}

type ResolvedPath =
  | { kind: 'root' }
  | { kind: 'child'; links: ChildLink[] }
  | { kind: 'missing' }
  | { kind: 'remote'; segment: string };

function getRootAddress(rootSnapshot: AnyMachineSnapshot): string {
  return (
    getSnapshotActorRef(rootSnapshot)?.actor.address ??
    encodeAddressSegment(getRootActorId(rootSnapshot.machine))
  );
}

function getChildren(
  snapshot: Snapshot<unknown>
): Record<string, AnyActor | undefined> | undefined {
  return (snapshot as { children?: Record<string, AnyActor | undefined> })
    .children;
}

// Walks the embedded actor tree segment by segment. Segments are compared in
// their encoded form (the same `/`-joined, `%2F`-escaped encoding actor
// addresses use), so an id containing `/` is one segment.
function resolvePath(
  rootSnapshot: AnyMachineSnapshot,
  address: string
): ResolvedPath {
  const rootAddress = getRootAddress(rootSnapshot);
  if (address === rootAddress) {
    return { kind: 'root' };
  }
  if (!address.startsWith(`${rootAddress}/`)) {
    return { kind: 'missing' };
  }
  const links: ChildLink[] = [];
  let snapshot: Snapshot<unknown> = rootSnapshot;
  for (const segment of address.slice(rootAddress.length + 1).split('/')) {
    const children = getChildren(snapshot);
    const entry =
      children &&
      Object.entries(children).find(
        ([id, child]) => child && encodeAddressSegment(id) === segment
      );
    if (!entry) {
      return { kind: 'missing' };
    }
    const [id, ref] = entry as [string, AnyActor];
    if (isRemoteActorRef(ref)) {
      return { kind: 'remote', segment };
    }
    links.push({ id, ref, parentSnapshot: snapshot as AnyMachineSnapshot });
    snapshot = ref.getSnapshot();
  }
  return { kind: 'child', links };
}

function resolvePathOrThrow(
  rootSnapshot: AnyMachineSnapshot,
  address: string
): ResolvedPath & { kind: 'root' | 'child' } {
  const path = resolvePath(rootSnapshot, address);
  if (path.kind === 'remote') {
    throw new Error(
      `Cannot transition '${address}': '${path.segment}' is a remote reference; its state lives with another runtime.`
    );
  }
  if (path.kind === 'missing') {
    throw new Error(
      `Unable to find actor '${address}' in snapshot of '${rootSnapshot.machine.id}'.`
    );
  }
  return path;
}

/**
 * Returns the snapshot of the actor at `address` within a machine snapshot's
 * embedded actor tree, or `undefined` when no co-located actor has that
 * address (for example an actor that already completed, or one whose state
 * lives with another runtime).
 *
 * `address` is absolute, as in effect descriptors and `actor.address`: the
 * `/`-joined path of actor ids from the root, with `/` in an id encoded as
 * `%2F`. The root's own address returns `rootSnapshot`.
 *
 * @public
 * @experimental
 * @example
 *
 * ```ts
 * const snapshot = machine.restoreSnapshot(persisted);
 * getChildSnapshot(snapshot, 'root/worker/retry')?.status; // 'active'
 * ```
 */
export function getChildSnapshot(
  rootSnapshot: AnyMachineSnapshot,
  address: string
): Snapshot<unknown> | undefined {
  const path = resolvePath(rootSnapshot, address);
  switch (path.kind) {
    case 'root':
      return rootSnapshot;
    case 'child':
      return path.links.at(-1)!.ref.getSnapshot();
    default:
      return undefined;
  }
}

function replaceChild(
  parentSnapshot: AnyMachineSnapshot,
  id: string,
  previousRef: AnyActor,
  nextRef: AnyActor
): AnyMachineSnapshot {
  // Timers that target the child hold its reference; keep them addressable
  // from the new snapshot.
  let timers = parentSnapshot.timers;
  for (const timerId in timers) {
    if (timers[timerId].target === previousRef) {
      timers = {
        ...timers,
        [timerId]: { ...timers[timerId], target: nextRef }
      };
    }
  }
  return cloneMachineSnapshot(parentSnapshot, {
    children: { ...parentSnapshot.children, [id]: nextRef },
    timers
  });
}

function mergeChildSnapshot<T extends AnyMachineSnapshot>(
  links: ChildLink[],
  childSnapshot: Snapshot<unknown>
): T {
  // Path-clone bottom-up: each ancestor snapshot and the actor that holds it
  // are copied, never mutated, so earlier snapshots (and anything replaying
  // them) keep their own view of the tree.
  let nextSnapshot: Snapshot<unknown> = childSnapshot;
  for (let i = links.length - 1; i >= 0; i--) {
    const { id, ref, parentSnapshot } = links[i];
    const nextRef = (
      ref as AnyActor & {
        _withSnapshot(snapshot: Snapshot<unknown>): AnyActor;
      }
    )._withSnapshot(nextSnapshot);
    nextSnapshot = replaceChild(parentSnapshot, id, ref, nextRef);
  }
  return nextSnapshot as T;
}

/**
 * Returns a new root snapshot in which the actor at `address` reports
 * `childSnapshot`. Every ancestor snapshot on the path is copied; the original
 * root snapshot, its children and its persisted form are unchanged. The
 * child keeps its identity (`id`, `address`, `src`, `registryKey`,
 * `sessionId`): it is the same incarnation in a later state.
 *
 * The root's own address returns `childSnapshot`. Throws when no co-located
 * actor has `address`, or when the path crosses a remote reference.
 *
 * @public
 * @experimental
 */
export function withChildSnapshot<T extends AnyMachineSnapshot>(
  rootSnapshot: T,
  address: string,
  childSnapshot: Snapshot<unknown>
): T {
  const path = resolvePathOrThrow(rootSnapshot, address);
  if (path.kind === 'root') {
    return childSnapshot as T;
  }
  return mergeChildSnapshot<T>(path.links, childSnapshot);
}

function findTerminateEffect(
  effects: readonly ExecutableActionObject[],
  address: string
): TerminateExecutableActionObject | undefined {
  return effects.find(
    (effect): effect is TerminateExecutableActionObject =>
      effect.type === XSTATE_TERMINATE &&
      (effect as TerminateExecutableActionObject).actor.address === address
  );
}

/**
 * Like `transition(…)`, for the actor at `address` within a machine snapshot's
 * embedded actor tree: delivers `event` to that actor and returns the next
 * root snapshot with the result merged in, plus the effects to execute.
 *
 * When the actor becomes terminal, its completion (`xstate.done.actor` or
 * `xstate.error.actor`) is delivered to its parent in the same call, and so on
 * up the tree until an ancestor stays active or the root is reached. Effects
 * are returned in that order. The `@xstate.terminate` effects of folded
 * completions still notify observers and host runtimes, but do not relay the
 * completion to the parent again.
 *
 * Folding assumes a single writer: nothing else transitions the tree between
 * the child's completion and its parent's reaction, which holds when one host
 * loop owns the whole-tree checkpoint.
 *
 * With the root's own address, this is exactly `transition(rootLogic,
 * rootSnapshot, event)`.
 *
 * @public
 * @experimental
 * @example
 *
 * ```ts
 * // A persisted grandchild timer fires
 * const snapshot = machine.restoreSnapshot(persisted);
 * const [next, effects] = transitionChild(machine, snapshot, 'root/worker/retry', {
 *   type: 'xstate.timer',
 *   id: 'xstate.after.1000.retry.idle'
 * });
 * ```
 */
export function transitionChild<T extends AnyStateMachine>(
  rootLogic: T,
  rootSnapshot: SnapshotFrom<T>,
  address: string,
  event: AnyEventObject
): [nextRootSnapshot: SnapshotFrom<T>, effects: ExecutableActionObject[]] {
  let targetAddress = address;
  let targetEvent = event;
  let nextRoot = rootSnapshot as AnyMachineSnapshot;
  const effects: ExecutableActionObject[] = [];

  while (true) {
    const path = resolvePathOrThrow(nextRoot, targetAddress);
    if (path.kind === 'root') {
      const [snapshot, rootEffects] = transition(
        rootLogic,
        nextRoot as SnapshotFrom<T>,
        targetEvent as never
      );
      effects.push(...(rootEffects as ExecutableActionObject[]));
      return [snapshot, effects];
    }

    const { id, ref } = path.links.at(-1)!;
    const previous = ref.getSnapshot();
    const [snapshot, childEffects] = transition(
      (ref as AnyActor & { logic: AnyActorLogic }).logic,
      previous,
      targetEvent as never
    ) as [Snapshot<unknown>, ExecutableActionObject[]];
    effects.push(...childEffects);
    if (snapshot === previous) {
      return [nextRoot as SnapshotFrom<T>, effects];
    }
    nextRoot = mergeChildSnapshot(path.links, snapshot);

    const terminate = findTerminateEffect(childEffects, targetAddress);
    if (!terminate) {
      return [nextRoot as SnapshotFrom<T>, effects];
    }
    // Deliver the completion against the incarnation it came from, so the
    // parent's stale-completion check applies as in a live runtime. Only
    // remote handles lack a sessionId, and the walk never transitions one.
    const sessionId = ref.sessionId!;
    markFoldedTerminateEffect(terminate);
    targetEvent =
      terminate.status === 'done'
        ? createDoneActorEvent(id, terminate.output, sessionId)
        : createErrorActorEvent(id, terminate.error, sessionId);
    targetAddress = targetAddress.slice(0, targetAddress.lastIndexOf('/'));
  }
}
