import {
  getInitialMicrosteps,
  getMicrosteps,
  type AnyStateMachine,
  type AnyMachineSnapshot,
  type EventFromLogic,
  type InputFrom,
  type SnapshotFrom
} from 'xstate';
import { serializeSnapshot } from 'xstate/graph';

/** File-local control exported by source-coverage instrumentation. @experimental */
export interface SourceCoverageControl {
  observer: ((id: string) => void) | undefined;
  faults: number;
}
/** One successfully calculated source-coverage step. @experimental */
export interface SourceCoverageSessionStep<TSnapshot = unknown> {
  stateId: string;
  snapshot: TSnapshot;
  outcomeIds: string[];
  terminal: boolean;
}
/** @experimental */
export interface SourceCoverageSessionOptions<T extends AnyStateMachine> {
  /** Exact runtime identity recorded in replay fixtures, e.g. xstate@6.0.0-alpha.70. */
  runtimeId: string;
  input?: InputFrom<T>;
  /** Optional host validation; type-only schemas cannot validate payload fields. */
  validateEvent?: (
    event: EventFromLogic<T>,
    snapshot: SnapshotFrom<T>
  ) => void | Promise<void>;
  /** Synchronous assertions or SUT comparisons. Thenables fail initialization or the step. */
  check?: (
    snapshot: SnapshotFrom<T>,
    event: EventFromLogic<T> | undefined
  ) => void;
}
/**
 * Runs an instrumented v6 machine once per step, collecting source outcomes
 * and static transition metadata from the same microstep calculation. External
 * effects are returned by XState but are not executed here.
 *
 * @experimental
 */
export function createSourceCoverageSession<T extends AnyStateMachine>(
  machine: T,
  control: SourceCoverageControl,
  options: SourceCoverageSessionOptions<T>
) {
  if (!options.runtimeId)
    throw new Error('Source coverage sessions require a runtimeId');
  let snapshot: AnyMachineSnapshot;
  let pending = false;
  const calculate = (
    event?: EventFromLogic<T>
  ): SourceCoverageSessionStep<SnapshotFrom<T>> => {
    const ids = new Set<string>();
    const previous = control.observer;
    const faults = control.faults;
    let candidate: typeof snapshot;
    control.observer = (id) => ids.add(id);
    try {
      const steps =
        event === undefined
          ? getInitialMicrosteps(machine, options.input as InputFrom<T>)
          : getMicrosteps(machine, snapshot as SnapshotFrom<T>, event);
      candidate =
        (steps.at(-1)?.[0] as AnyMachineSnapshot | undefined) ?? snapshot;
      if (!candidate || candidate.status === 'error')
        throw new Error('Source coverage execution failed', {
          cause: candidate?.error
        });
      for (const [, , transitions] of steps)
        for (const transition of transitions) {
          const id = (transition as unknown as Record<symbol, unknown>)[
            Symbol.for('@statelyai.sourceCoverage')
          ];
          if (typeof id === 'string') ids.add(id);
        }
      if (control.faults !== faults)
        throw new Error('Source coverage observer failed');
    } finally {
      control.observer = previous;
    }
    const checked: unknown = options.check?.(
      candidate as SnapshotFrom<T>,
      event
    );
    if (
      checked !== null &&
      (typeof checked === 'object' || typeof checked === 'function') &&
      'then' in checked
    ) {
      const then = checked.then;
      if (typeof then === 'function') {
        void new Promise((resolve, reject) => {
          then.call(checked, resolve, reject);
        }).catch(() => {});
        throw new TypeError('Source coverage checks must be synchronous');
      }
    }
    const result = {
      stateId: serializeSnapshot(candidate),
      snapshot: candidate as SnapshotFrom<T>,
      outcomeIds: [...ids],
      terminal: candidate.status !== 'active'
    };
    snapshot = candidate;
    return result;
  };
  const initial = calculate();
  return {
    runtimeId: options.runtimeId,
    initial,
    async step(event: EventFromLogic<T>) {
      if (pending)
        throw new Error('Cannot run concurrent source coverage steps');
      pending = true;
      try {
        if (snapshot.status !== 'active')
          throw new Error(
            'Cannot send a coverage event to a terminal snapshot'
          );
        await options.validateEvent?.(event, snapshot as SnapshotFrom<T>);
        return calculate(event);
      } finally {
        pending = false;
      }
    }
  };
}
