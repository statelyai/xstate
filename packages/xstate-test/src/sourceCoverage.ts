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
export interface XStateSourceCoverageSessionOptions<T extends AnyStateMachine> {
  /** Exact runtime identity recorded in replay fixtures, e.g. xstate@6.0.0-alpha.70. */
  runtimeId: string;
  input?: InputFrom<T>;
  /** Optional host validation; type-only schemas cannot validate payload fields. */
  validateEvent?: (
    event: EventFromLogic<T>,
    snapshot: SnapshotFrom<T>
  ) => void | Promise<void>;
  /** Called after calculation, for assertions or comparison with a real SUT. */
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
export function createXStateSourceCoverageSession<T extends AnyStateMachine>(
  machine: T,
  control: SourceCoverageControl,
  options: XStateSourceCoverageSessionOptions<T>
) {
  if (!options.runtimeId)
    throw new Error('Source coverage sessions require a runtimeId');
  let snapshot: AnyMachineSnapshot;
  const calculate = (
    event?: EventFromLogic<T>
  ): SourceCoverageSessionStep<SnapshotFrom<T>> => {
    const ids = new Set<string>();
    const previous = control.observer;
    const faults = control.faults;
    control.observer = (id) => ids.add(id);
    try {
      const steps =
        event === undefined
          ? getInitialMicrosteps(machine, options.input as InputFrom<T>)
          : getMicrosteps(machine, snapshot as SnapshotFrom<T>, event);
      snapshot =
        (steps.at(-1)?.[0] as AnyMachineSnapshot | undefined) ?? snapshot;
      if (!snapshot || snapshot.status === 'error')
        throw new Error('Source coverage execution failed', {
          cause: snapshot?.error
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
      options.check?.(snapshot as SnapshotFrom<T>, event);
      return {
        stateId: serializeSnapshot(snapshot),
        snapshot: snapshot as SnapshotFrom<T>,
        outcomeIds: [...ids],
        terminal: snapshot.status !== 'active'
      };
    } finally {
      control.observer = previous;
    }
  };
  const initial = calculate();
  return {
    runtimeId: options.runtimeId,
    initial,
    async step(event: EventFromLogic<T>) {
      if (snapshot.status !== 'active')
        throw new Error('Cannot send a coverage event to a terminal snapshot');
      await options.validateEvent?.(event, snapshot as SnapshotFrom<T>);
      return calculate(event);
    }
  };
}
