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
  HistoryValue,
  StateValue
} from './types.ts';

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
 * machine, a child's logic cannot be resolved, or the new machine's validator
 * rejects the snapshot.
 *
 * @internal
 */
export function hotSwapActorLogic(
  actorRef: AnyActorRef,
  machine: AnyStateMachine
): boolean {
  const actor = actorRef as AnyActor & {
    _processingStatus: ProcessingStatus;
    _actorScope: any;
    _setSnapshot(snapshot: unknown): void;
    _next(snapshot: unknown): void;
    _stopChild(child: AnyActor): void;
    logic: AnyActorLogic;
  };
  const snapshot = actor.getSnapshot() as AnyMachineSnapshot;
  if (
    actor._processingStatus !== ProcessingStatus.Running ||
    snapshot.status !== 'active' ||
    typeof (machine as { getStateNodeById?: unknown }).getStateNodeById !==
      'function' ||
    snapshot.machine?.id !== machine.id ||
    findMissingStatePath(machine.root, snapshot.value) !== undefined
  ) {
    return false;
  }
  const nodes = Array.from(
    getAllStateNodes(getStateNodes(machine.root, snapshot.value))
  );

  const historyValue: HistoryValue = {};
  for (const key of Object.keys(snapshot.historyValue ?? {})) {
    const resolved: AnyStateNode[] = [];
    for (const item of snapshot.historyValue[key]!) {
      try {
        resolved.push(machine.getStateNodeById(item.id));
      } catch {
        return false;
      }
    }
    historyValue[key] = resolved;
  }

  const children: Record<string, AnyActorRef | undefined> = {};
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
    let logic: AnyActorLogic | undefined;
    try {
      logic = resolveChildLogic(machine, child.src, snapshot, actor);
    } catch {
      logic = undefined;
    }
    if (!logic) {
      return false;
    }
    if (logic === (child as { logic?: unknown }).logic) {
      children[childId] = child;
    } else {
      restarts.push([childId, child, logic]);
    }
  }

  const data = snapshot as AnyMachineSnapshot & {
    _stateInputs?: Record<string, unknown>;
    _nextTimerId?: number;
    _nextActorIds?: Record<string, number>;
  };
  const buildSnapshot = () =>
    createMachineSnapshot(
      {
        status: data.status,
        output: data.output,
        error: data.error,
        context: data.context,
        _nodes: nodes,
        value: data.value,
        children,
        timers: data.timers,
        historyValue,
        _stateInputs: data._stateInputs,
        _nextTimerId: data._nextTimerId,
        _nextActorIds: data._nextActorIds
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

  for (const [childId, child, logic] of restarts) {
    actor._stopChild(child);
    const restarted = actor.system.createActorRef(logic, {
      id: childId,
      parent: actor,
      syncSnapshot: (child as { _syncSnapshot?: boolean })._syncSnapshot,
      src: child.src,
      registryKey: child.registryKey,
      input: (child as { options?: { input?: unknown } }).options?.input
    });
    children[childId] = restarted;
    restarted.start();
  }

  if (actor.src === actor.logic) {
    actor.src = machine;
  }
  actor.logic = machine;
  const next = buildSnapshot();
  actor._setSnapshot(next);
  actor._next(next);
  return true;
}

/**
 * Resolves a child's source name against `machine`, evaluating an inline
 * invoke `src` function the way entering the invoking state does.
 */
function resolveChildLogic(
  machine: AnyStateMachine,
  src: string,
  snapshot: AnyMachineSnapshot,
  self: AnyActorRef
): AnyActorLogic | undefined {
  const match = /^xstate\.invoke\.(\d+)\.(.*)$/.exec(src);
  if (!match) {
    return machine.sources.actors[src];
  }
  let logic: unknown = machine.getStateNodeById(match[2]!).invoke[
    Number(match[1])
  ]?.logic;
  if (typeof logic === 'function') {
    logic = logic({
      actors: machine.sources.actors,
      context: snapshot.context,
      event: undefined,
      self
    });
  }
  return typeof logic === 'string'
    ? machine.sources.actors[logic]
    : (logic as AnyActorLogic | undefined);
}

/**
 * Returns the path of the first state in `stateValue` that does not exist
 * under `node`, or `undefined` when every state exists.
 */
function findMissingStatePath(
  node: AnyStateNode,
  stateValue: StateValue,
  path: string[] = []
): string[] | undefined {
  if (typeof stateValue === 'string') {
    return node.states[stateValue] ? undefined : path.concat(stateValue);
  }
  if (!stateValue || typeof stateValue !== 'object') {
    return undefined;
  }
  for (const key of Object.keys(stateValue)) {
    const childNode = node.states[key];
    const missing = childNode
      ? findMissingStatePath(childNode, stateValue[key]!, path.concat(key))
      : path.concat(key);
    if (missing) {
      return missing;
    }
  }
  return undefined;
}
