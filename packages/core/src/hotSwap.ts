import { ProcessingStatus } from './createActor.ts';
import { createMachineSnapshot } from './State.ts';
import { getAllStateNodes, getStateNodes } from './stateUtils.ts';
import type {
  AnyActor,
  AnyActorLogic,
  AnyActorRef,
  AnyMachineSnapshot,
  AnyStateMachine,
  AnyStateNode,
  HistoryValue
} from './types.ts';
import { isActorRefLike, resolveReferencedActor } from './utils.ts';

/**
 * Switches a running machine actor to another version of its machine, for
 * development hot reloading. The live snapshot is carried over in memory and
 * never serialized, so context may hold values that `getPersistedSnapshot()`
 * cannot represent (DOM nodes, cycles).
 *
 * Children whose logic is unchanged by identity keep running; other children
 * are stopped and restarted from the new machine's logic. Returns `false`,
 * leaving the actor unchanged, when the actor is not a running machine actor
 * with the same machine id, a state or history id does not exist on the new
 * machine, a child's logic cannot be resolved statically, context or a pending
 * timer references a child that would restart, or the new machine's validator
 * rejects the snapshot.
 *
 * @experimental Used by framework integrations; not part of the stable API.
 */
export function hotSwapActorLogic(
  actorRef: AnyActorRef,
  machine: AnyStateMachine
): boolean {
  const actor = actorRef as AnyActor & {
    _processingStatus: ProcessingStatus;
    _stopChild(child: AnyActor): void;
    _setSnapshot(snapshot: unknown): void;
    _next(snapshot: unknown): void;
    logic: AnyActorLogic;
  };
  const snapshot = actor.getSnapshot() as AnyMachineSnapshot;
  if (
    actor._processingStatus !== ProcessingStatus.Running ||
    snapshot.status !== 'active' ||
    snapshot.machine?.id !== machine.id
  ) {
    return false;
  }

  let nodes: AnyStateNode[];
  const historyValue: HistoryValue = {};
  try {
    // Throws when a state in the value no longer exists.
    nodes = [...getAllStateNodes(getStateNodes(machine.root, snapshot.value))];
    for (const [key, items] of Object.entries(snapshot.historyValue ?? {})) {
      if (machine.getStateNodeById(key).type !== 'history') {
        return false;
      }
      historyValue[key] = items.map((item) =>
        machine.getStateNodeById(item.id)
      );
    }
  } catch {
    return false;
  }
  const children: Record<string, AnyActor | undefined> = {};
  const restarts: Array<[string, AnyActor, AnyActorLogic]> = [];
  for (const [childId, child] of Object.entries(
    snapshot.children as Record<string, AnyActor | undefined>
  )) {
    if (!child) {
      continue;
    }
    if (typeof child.src !== 'string') {
      // Inline spawned logic and remote handles: nothing to resolve against.
      children[childId] = child;
      continue;
    }
    let logic: unknown;
    try {
      logic = resolveReferencedActor(machine, child.src);
    } catch {
      // The invoking state or its invoke entry no longer exists.
    }
    // Missing, or a dynamic `src` function: start a fresh actor instead.
    if (!logic || typeof logic === 'function') {
      return false;
    }
    if (logic === (child as { logic?: unknown }).logic) {
      children[childId] = child;
    } else {
      restarts.push([childId, child, logic as AnyActorLogic]);
    }
  }

  // Context is user-owned and timers were scheduled against the old refs, so
  // neither can be rebound to a restarted child.
  const restarting = new Set<unknown>(restarts.map(([, child]) => child));
  if (
    restarting.size &&
    (Object.values(snapshot.timers ?? {}).some((timer) =>
      restarting.has(timer.target)
    ) ||
      holdsActorRef(snapshot.context, restarting))
  ) {
    return false;
  }

  // `value` is left for `createMachineSnapshot` to derive from the nodes: an
  // active atomic state may have gained substates whose initial states are
  // now active too.
  const buildSnapshot = () =>
    createMachineSnapshot(
      {
        ...snapshot,
        _nodes: nodes,
        value: undefined,
        children,
        historyValue
      } as any,
      machine
    ) as AnyMachineSnapshot;

  if (
    machine.validator?.check({
      kind: 'result',
      logic: machine,
      snapshot: buildSnapshot(),
      effects: []
    })
  ) {
    return false;
  }

  // Install replacements in the committed snapshot before starting them: a
  // child that emits while starting is matched against the parent's current
  // children, and the old refs would reject it as stale.
  for (const [childId, child, logic] of restarts) {
    actor._stopChild(child);
    children[childId] = actor.system.createActorRef(logic, {
      id: childId,
      parent: actor,
      syncSnapshot: (child as { _syncSnapshot?: boolean })._syncSnapshot,
      src: child.src,
      registryKey: child.registryKey,
      input: (child as { options?: { input?: unknown } }).options?.input
    });
  }

  if (actor.src === actor.logic) {
    actor.src = machine;
  }
  actor.logic = machine;
  const next = buildSnapshot();
  actor._setSnapshot(next);
  actor._next(next);
  for (const [childId] of restarts) {
    children[childId]!.start();
  }
  return true;
}

/**
 * Whether `value` holds any of `refs`, searching plain objects, arrays, maps
 * and sets. Actor refs, class instances and host objects (DOM nodes) are not
 * searched into.
 */
function holdsActorRef(
  value: unknown,
  refs: Set<unknown>,
  visited = new Set<object>()
): boolean {
  if (!value || typeof value !== 'object' || visited.has(value)) {
    return false;
  }
  visited.add(value);
  if (isActorRefLike(value)) {
    return refs.has(value);
  }
  const proto = Object.getPrototypeOf(value);
  const items =
    value instanceof Map || value instanceof Set
      ? [...value.values()]
      : Array.isArray(value) || proto === Object.prototype || proto === null
        ? Object.values(value)
        : [];
  return items.some((item) => holdsActorRef(item, refs, visited));
}
