import type { ActorSystemRuntime } from '../system.ts';
export {
  createDurableSystem,
  type DurableActorRecord,
  type DurableActorRef,
  type DurableSystem,
  type DurableSystemEffect,
  type DurableSystemEffectExecutor,
  type DurableSystemEffectMetadata,
  type DurableSystemSnapshot,
  type DurableSystemState,
  type DurableSystemTransition,
  type PersistedDurableSystemState
} from './system.ts';
import { initialTransition, transition } from '../transition.ts';
import type {
  AnyActorLogic,
  CustomExecutableActionObject,
  EventFromLogic,
  ExecutableActionObjectFromLogic,
  InputFrom,
  OutputFrom,
  Snapshot,
  SnapshotFrom
} from '../types.ts';

export interface DurableEffectMetadata {
  /** Stable within one durable execution. */
  id: string;
  transitionIndex: number;
  effectIndex: number;
}

export interface DurableWaitMetadata {
  /** Stable within one durable execution. */
  id: string;
  transitionIndex: number;
}

export interface DurableEffect<TEffect> extends DurableEffectMetadata {
  effect: TEffect;
}

export interface DurableExecutionAdapter<TLogic extends AnyActorLogic> {
  /**
   * Executes a custom action as a durable host step or activity. The host
   * should identify the action by `type` and memoize or deduplicate it using
   * `metadata.id`.
   */
  executeAction(
    action: CustomExecutableActionObject,
    metadata: DurableEffectMetadata,
    runtime: Partial<ActorSystemRuntime>
  ): void | PromiseLike<void>;
  /**
   * Creates the runtime used by one effect. Timers, messaging and
   * child actors should be translated to equivalent host operations. The
   * complete effect is provided for hosts that need serializable actor source,
   * input, event or target data beyond the runtime method arguments.
   */
  runtime?(
    metadata: DurableEffectMetadata,
    effect: ExecutableActionObjectFromLogic<TLogic>
  ): Partial<ActorSystemRuntime>;
  /** Waits durably for the next event addressed to this execution. */
  waitForEvent(
    metadata: DurableWaitMetadata
  ): EventFromLogic<TLogic> | PromiseLike<EventFromLogic<TLogic>>;
  /** Index assigned to the first transition. Defaults to `0`. */
  transitionIndex?: number;
}

export class DurableExecutionCancelledError extends Error {
  constructor() {
    super('Durable execution was stopped');
    this.name = 'DurableExecutionCancelledError';
  }
}

export class DurableExecutionResumeError extends Error {
  constructor() {
    super(
      'run() can only start a fresh durable execution; resume checkpoints with transition() and the persisted snapshot'
    );
    this.name = 'DurableExecutionResumeError';
  }
}

export interface DurableExecution<TLogic extends AnyActorLogic> {
  /** Index assigned to the next transition. Persist this with checkpoints. */
  readonly nextTransitionIndex: number;
  initialTransition(
    ...[input]: undefined extends InputFrom<TLogic>
      ? [input?: InputFrom<TLogic>]
      : [input: InputFrom<TLogic>]
  ): [
    snapshot: SnapshotFrom<TLogic>,
    effects: DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[]
  ];
  transition(
    snapshot: SnapshotFrom<TLogic>,
    event: EventFromLogic<TLogic>
  ): [
    snapshot: SnapshotFrom<TLogic>,
    effects: DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[]
  ];
  executeEffects(
    effects: readonly DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[]
  ): Promise<void>;
  waitForEvent(): Promise<EventFromLogic<TLogic>>;
  run(
    ...[input]: undefined extends InputFrom<TLogic>
      ? [input?: InputFrom<TLogic>]
      : [input: InputFrom<TLogic>]
  ): Promise<OutputFrom<TLogic>>;
}

/**
 * Creates a host-neutral durable execution around pure actor transitions.
 *
 * The returned transition methods only calculate snapshots and tag their
 * effects. Persistence, retries, messaging, timers and child execution remain
 * responsibilities of the adapter.
 *
 * @experimental
 */
export function createDurable<TLogic extends AnyActorLogic>(
  logic: TLogic,
  adapter: DurableExecutionAdapter<TLogic>
): DurableExecution<TLogic> {
  let nextTransitionIndex = adapter.transitionIndex ?? 0;
  const startingTransitionIndex = nextTransitionIndex;
  let lastTransitionIndex =
    nextTransitionIndex === 0 ? undefined : nextTransitionIndex - 1;

  if (!Number.isSafeInteger(nextTransitionIndex) || nextTransitionIndex < 0) {
    throw new RangeError('transitionIndex must be a non-negative safe integer');
  }

  const tagEffects = (
    effects: ExecutableActionObjectFromLogic<TLogic>[]
  ): DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[] => {
    const transitionIndex = nextTransitionIndex++;
    lastTransitionIndex = transitionIndex;
    return effects.map((effect, effectIndex) => ({
      id: `${transitionIndex}:${effectIndex}`,
      transitionIndex,
      effectIndex,
      effect
    }));
  };

  const execution: DurableExecution<TLogic> = {
    get nextTransitionIndex() {
      return nextTransitionIndex;
    },
    initialTransition(...args) {
      const [snapshot, effects] = initialTransition(logic, ...args);
      return [snapshot, tagEffects(effects)];
    },
    transition(snapshot, event) {
      const [nextSnapshot, effects] = transition(logic, snapshot, event);
      return [nextSnapshot, tagEffects(effects)];
    },
    async executeEffects(effects) {
      for (const { effect, ...metadata } of effects) {
        const runtime = adapter.runtime?.(metadata, effect) ?? {};
        if (effect.kind === 'action') {
          await adapter.executeAction(effect, metadata, runtime);
        } else {
          await effect.exec(runtime);
        }
      }
    },
    async waitForEvent() {
      if (lastTransitionIndex === undefined) {
        throw new Error('Cannot wait for an event before the first transition');
      }
      return adapter.waitForEvent({
        id: `event:${lastTransitionIndex}`,
        transitionIndex: lastTransitionIndex
      });
    },
    async run(...args) {
      if (
        startingTransitionIndex !== 0 ||
        nextTransitionIndex !== startingTransitionIndex
      ) {
        throw new DurableExecutionResumeError();
      }
      let [snapshot, effects] = execution.initialTransition(...args);
      await execution.executeEffects(effects);

      while ((snapshot as Snapshot<OutputFrom<TLogic>>).status === 'active') {
        const event = await execution.waitForEvent();
        [snapshot, effects] = execution.transition(snapshot, event);
        await execution.executeEffects(effects);
      }

      const terminalSnapshot = snapshot as Snapshot<OutputFrom<TLogic>>;
      if (terminalSnapshot.status === 'done') {
        return terminalSnapshot.output;
      }
      if (terminalSnapshot.status === 'error') {
        throw terminalSnapshot.error;
      }
      throw new DurableExecutionCancelledError();
    }
  };

  return execution;
}
