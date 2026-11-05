// Structural validation of persisted machine snapshots.
import type {
  AnyActorLogic,
  AnyStateMachine,
  AnyStateNode,
  StateValue
} from './types.ts';
import { getAllStateNodes, getStateNodes } from './stateUtils.ts';
import isDevelopment from '#is-development';
import { describeMachine, resolveInvokedActorLogic } from './utils.ts';
import { xstateError } from './xstateError.ts';
import { isSerializedActorRef } from './remoteActorRef.ts';

/**
 * The error a machine reports when a persisted snapshot cannot represent one
 * of its states: the snapshot has an invalid state value, malformed children
 * or timers, or a child source that the machine cannot restore.
 * `restoreActor(machine, snapshot)` reports it as an `'error'` snapshot
 * instead of starting.
 *
 * @public
 */
export class InvalidSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSnapshotError';
  }
}

export function isSnapshotRecord(
  value: unknown
): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isActorLogic(value: unknown): value is AnyActorLogic {
  return (
    isSnapshotRecord(value) &&
    typeof value.transition === 'function' &&
    typeof value.getInitialSnapshot === 'function'
  );
}

function validatePersistedStateValue(
  machine: AnyStateMachine,
  stateValue: unknown,
  node: AnyStateNode,
  path: string[]
): void {
  if (typeof stateValue === 'string') {
    if (!node.states[stateValue]) {
      throw new InvalidSnapshotError(
        isDevelopment
          ? `Persisted snapshot references state '${path.concat(stateValue).join('.')}' which does not exist on ${describeMachine(machine.id)}.`
          : xstateError(21, path.concat(stateValue).join('.'))
      );
    }
    return;
  }
  const invalidValue = (code: 22 | 23) =>
    new InvalidSnapshotError(
      isDevelopment
        ? `Persisted snapshot for ${describeMachine(machine.id)} has an invalid state value${path.length ? ` at '${path.join('.')}'` : ''}: ${
            code === 22
              ? 'expected a state name or an object of state values'
              : `state '${path.length ? path.join('.') : node.key}' is not parallel, so only one child state can be active`
          }.`
        : code === 22
          ? xstateError(22, path.join('.'))
          : xstateError(23, path.join('.'))
    );
  if (
    !stateValue ||
    typeof stateValue !== 'object' ||
    Array.isArray(stateValue)
  ) {
    throw invalidValue(22);
  }
  const keys = Object.keys(stateValue);
  if (keys.length > 1 && node.type !== 'parallel') {
    throw invalidValue(23);
  }
  for (const key of keys) {
    const childNode = node.states[key];
    if (!childNode) {
      throw new InvalidSnapshotError(
        isDevelopment
          ? `Persisted snapshot references state '${path.concat(key).join('.')}' which does not exist on ${describeMachine(machine.id)}.`
          : xstateError(21, path.concat(key).join('.'))
      );
    }
    validatePersistedStateValue(
      machine,

      (stateValue as Record<string, unknown>)[key],
      childNode,
      path.concat(key)
    );
  }
}

export function validatePersistedSnapshot(
  machine: AnyStateMachine,
  snapshot: unknown
): {
  nodes: AnyStateNode[];
  childLogics: Map<string, AnyActorLogic>;
} {
  if (!isSnapshotRecord(snapshot)) {
    throw new InvalidSnapshotError(
      isDevelopment
        ? `Persisted snapshot for ${describeMachine(machine.id)} must be an object.`
        : xstateError(24, machine.id)
    );
  }
  if (snapshot.value === undefined) {
    throw new InvalidSnapshotError(
      isDevelopment
        ? `Persisted snapshot for ${describeMachine(machine.id)} has no state value.`
        : xstateError(25, machine.id)
    );
  }
  validatePersistedStateValue(machine, snapshot.value, machine.root, []);
  const nodes = Array.from(
    getAllStateNodes(getStateNodes(machine.root, snapshot.value as StateValue))
  );
  if (!isSnapshotRecord(snapshot.children)) {
    throw new InvalidSnapshotError(
      isDevelopment
        ? "Persisted snapshot has invalid 'children'."
        : xstateError(26)
    );
  }
  const childLogics = new Map<string, AnyActorLogic>();
  for (const [id, child] of Object.entries(snapshot.children)) {
    if (
      !isSnapshotRecord(child) ||
      (child.remote !== undefined && typeof child.remote !== 'boolean') ||
      (child.address !== undefined && typeof child.address !== 'string') ||
      (child.syncSnapshot !== undefined &&
        typeof child.syncSnapshot !== 'boolean') ||
      (child.registryKey !== undefined &&
        typeof child.registryKey !== 'string') ||
      (child.incarnation !== undefined &&
        typeof child.incarnation !== 'string') ||
      (child.snapshot !== undefined && !isSnapshotRecord(child.snapshot))
    ) {
      throw new InvalidSnapshotError(
        isDevelopment
          ? `Persisted snapshot has invalid child '${id}'.`
          : xstateError(27, id)
      );
    }
    if (child.remote === true) {
      if (typeof child.address !== 'string' || typeof child.src !== 'string') {
        throw new InvalidSnapshotError(
          isDevelopment
            ? `Unable to restore remote child '${id}': a child referenced by address requires a registered source key and an address.`
            : xstateError(28, id)
        );
      }
      continue;
    }
    if (
      child.src !== undefined &&
      typeof child.src !== 'string' &&
      !isActorLogic(child.src)
    ) {
      throw new InvalidSnapshotError(
        isDevelopment
          ? `Persisted snapshot has invalid child '${id}'.`
          : xstateError(27, id)
      );
    }
    try {
      const logic =
        child.src === undefined
          ? resolveInvokedActorLogic(machine, nodes, id)
          : typeof child.src === 'string'
            ? Object.hasOwn(machine.sources.actors, child.src)
              ? machine.sources.actors[child.src]
              : undefined
            : child.src;
      if (!logic) {
        throw new InvalidSnapshotError(
          isDevelopment
            ? `Unable to restore child actor '${id}': child source '${typeof child.src === 'string' ? child.src : '<inline>'}' is not provided in ${describeMachine(machine.id)}.`
            : xstateError(
                29,
                id,
                typeof child.src === 'string' ? child.src : '<inline>'
              )
        );
      }
      childLogics.set(id, logic);
    } catch (error) {
      if (error instanceof InvalidSnapshotError) {
        throw error;
      }
      throw new InvalidSnapshotError(
        error instanceof Error
          ? error.message
          : isDevelopment
            ? `Unable to restore child actor '${id}'.`
            : xstateError(30, id)
      );
    }
  }
  if (snapshot.timers !== undefined && !Array.isArray(snapshot.timers)) {
    throw new InvalidSnapshotError(
      isDevelopment
        ? "Persisted snapshot has invalid 'timers'."
        : xstateError(31)
    );
  }
  for (const timer of snapshot.timers ?? []) {
    if (
      !isSnapshotRecord(timer) ||
      typeof timer.delay !== 'number' ||
      (timer.type !== '@xstate.raise' && timer.type !== '@xstate.sendTo') ||
      !isSnapshotRecord(timer.event) ||
      typeof timer.event.type !== 'string' ||
      (timer.id !== undefined && typeof timer.id !== 'string') ||
      (timer.seq !== undefined && typeof timer.seq !== 'number') ||
      (timer.scheduledAt !== undefined &&
        typeof timer.scheduledAt !== 'number') ||
      !(
        typeof timer.target === 'string' ||
        (isSnapshotRecord(timer.target) && timer.target.type === 'parent') ||
        isSerializedActorRef(timer.target)
      )
    ) {
      throw new InvalidSnapshotError(
        isDevelopment
          ? 'Persisted snapshot has invalid timer.'
          : xstateError(32)
      );
    }
    if (
      typeof timer.target === 'string' &&
      timer.target !== 'self' &&
      !Object.hasOwn(snapshot.children, timer.target)
    ) {
      throw new InvalidSnapshotError(
        isDevelopment
          ? `Unable to restore timer: target actor '${timer.target}' is unavailable.`
          : xstateError(33, timer.target)
      );
    }
  }
  return { nodes, childLogics };
}
