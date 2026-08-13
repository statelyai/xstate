import type { ActorSystemRuntime } from '../system.ts';
import { initialTransition, transition } from '../transition.ts';
import type {
  AnyActorLogic,
  EventFromLogic,
  ExecutableActionObjectFromLogic,
  InputFrom,
  SnapshotFrom
} from '../types.ts';

export interface DurableEffectMetadata {
  /** Stable within one durable execution. */
  id: string;
  transitionIndex: number;
  effectIndex: number;
}

export interface DurableEffect<TEffect> extends DurableEffectMetadata {
  effect: TEffect;
}

export interface DurableExecutionAdapter<TLogic extends AnyActorLogic> {
  /**
   * Runtime operations supplied by the durable host. Timers, messaging and
   * child actors should be translated to equivalent host operations.
   */
  runtime?: Partial<ActorSystemRuntime>;
  /**
   * Executes one effect durably. The host should memoize or deduplicate the
   * execution using `metadata.id`.
   */
  executeEffect(
    effect: ExecutableActionObjectFromLogic<TLogic>,
    metadata: DurableEffectMetadata,
    runtime: Partial<ActorSystemRuntime>
  ): void | PromiseLike<void>;
  /** Waits for the next event addressed to this durable execution. */
  waitForEvent(): EventFromLogic<TLogic> | PromiseLike<EventFromLogic<TLogic>>;
  /** Index assigned to the first transition. Defaults to `0`. */
  transitionIndex?: number;
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
export function createDurableExecution<TLogic extends AnyActorLogic>(
  logic: TLogic,
  adapter: DurableExecutionAdapter<TLogic>
): DurableExecution<TLogic> {
  let nextTransitionIndex = adapter.transitionIndex ?? 0;
  const runtime = adapter.runtime ?? {};

  if (!Number.isSafeInteger(nextTransitionIndex) || nextTransitionIndex < 0) {
    throw new RangeError('transitionIndex must be a non-negative safe integer');
  }

  const tagEffects = (
    effects: ExecutableActionObjectFromLogic<TLogic>[]
  ): DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[] => {
    const transitionIndex = nextTransitionIndex++;
    return effects.map((effect, effectIndex) => ({
      id: `${transitionIndex}:${effectIndex}`,
      transitionIndex,
      effectIndex,
      effect
    }));
  };

  return {
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
        await adapter.executeEffect(effect, metadata, runtime);
      }
    },
    async waitForEvent() {
      return adapter.waitForEvent();
    }
  };
}
