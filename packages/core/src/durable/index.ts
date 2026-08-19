import {
  getEffectDescriptor,
  type EffectDescriptor
} from '../effectDescriptor.ts';
import { deliverEvent } from '../runtimeHelpers.ts';
import { getSnapshotActorRef } from '../snapshotActorRef.ts';
import {
  getRootActorId,
  RUNTIME_OPERATIONS,
  type ActorSystemRuntime,
  type AnyActorSystem
} from '../system.ts';
import { initialTransition, transition } from '../transition.ts';
import type {
  AnyActor,
  AnyActorLogic,
  AnyEventObject,
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

/**
 * An event addressed to a durable execution's root actor, captured while
 * effects settled. `source` is the live reference of the sending actor when
 * one initiated the send.
 */
export interface DurableRootEvent<TEvent> {
  event: TEvent;
  source: AnyActor | undefined;
}

export interface DurableEffect<TEffect> extends DurableEffectMetadata {
  effect: TEffect;
  /**
   * Serializable view of the effect: actor references replaced by logical
   * addresses and actor sources by source keys, for journaling and
   * deduplication. Payload fields are only as serializable as their values.
   */
  descriptor: EffectDescriptor;
}

/**
 * A durable host adapter: the runtime operations that execute this
 * execution's effects, plus the durable loop hooks.
 *
 * The runtime operations (`sendEvent`, `scheduleTimer`, …) are installed on
 * the actor system of every snapshot the execution produces, including
 * children created during transitions and actors rehydrated from restored
 * snapshots. Operations initiated by live child actors (parent sends,
 * timers, terminations) route to them without any per-actor wiring; omitted
 * operations keep their default local behavior.
 *
 * Events addressed to this execution's root actor do not reach `sendEvent`
 * during `executeEffects`: the execution captures them and resolves them
 * from that call for the durable loop to process before suspending. While
 * the loop is parked, a root-addressed event reaches `sendEvent` like any
 * other target, so the host enqueues it in its own mailbox.
 */
export interface DurableExecutionAdapter<
  TLogic extends AnyActorLogic
> extends Partial<ActorSystemRuntime> {
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
   * Creates the runtime used by one effect, for hosts that key operations by
   * effect ID. Overrides the adapter's runtime operations
   * operation-by-operation; operations it omits keep their behavior. The
   * complete effect is provided for hosts that need serializable actor
   * source, input, event or target data beyond the runtime method arguments.
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
  /**
   * The logical address of this execution's root actor: the logic's own name,
   * or `x:0` for anonymous logic. Known before any transition runs, so hosts
   * can label mailboxes and wire messages without a snapshot.
   */
  readonly rootAddress: string;
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
  /**
   * Returns the actor reference behind a snapshot produced by this execution,
   * for addressing and inspection. `undefined` for snapshots this execution
   * has not seen (for example a freshly deserialized checkpoint that has not
   * been passed through `transition()` yet).
   */
  getActorRef(snapshot: SnapshotFrom<TLogic>): AnyActor | undefined;
  /**
   * Executes effects and resolves only when every runtime operation they
   * transitively initiated — including operations from live child actors
   * reacting to delivered events — has been accepted by the runtime; a
   * failed operation rejects it. Top-level operations queue sequentially in
   * initiation order, while an operation initiated while another is in
   * flight executes immediately instead of queueing behind it.
   *
   * Resolves with the events addressed to this execution's root actor that
   * were produced along the way, in order. Feed them back through
   * `transition()` (and execute their effects) before durably waiting for an
   * external event; `run()` does this automatically.
   */
  executeEffects(
    effects: readonly DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[]
  ): Promise<DurableRootEvent<EventFromLogic<TLogic>>[]>;
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
    return effects.map((effect, effectIndex) => {
      const tagged = {
        id: `${transitionIndex}:${effectIndex}`,
        transitionIndex,
        effectIndex,
        effect
      } as DurableEffect<(typeof effects)[number]>;
      // Journaling hosts read the descriptor; executing hosts never do, so
      // compute it (and its address walks) lazily, once.
      let descriptor: EffectDescriptor | undefined;
      Object.defineProperty(tagged, 'descriptor', {
        enumerable: true,
        get: () => (descriptor ??= getEffectDescriptor(effect))
      });
      return tagged;
    });
  };

  const rootAddress = getRootActorId(logic);

  // The adapter's runtime operations, picked off the flat adapter shape.
  const systemRuntime: Partial<ActorSystemRuntime> = {};
  for (const operation of [...RUNTIME_OPERATIONS, 'sendEvent'] as const) {
    const impl = adapter[operation];
    if (impl) {
      (systemRuntime as Record<string, unknown>)[operation] =
        impl.bind(adapter);
    }
  }
  const hasSystemRuntime = Object.keys(systemRuntime).length > 0;

  // One batch per `executeEffects` call. The wrapped runtime stays installed
  // on the actor system for the whole execution, so it also sees operations
  // initiated while the loop is parked in `waitForEvent()` (for example a
  // live child reacting to a host-originated delivery). Those belong to the
  // host's domain: they run untracked and uncaptured, so a parked-window
  // failure cannot be attributed to an unrelated later batch. Discarding a
  // failed batch discards its captures and failures with it.
  interface Batch {
    rootEvents: DurableRootEvent<AnyEventObject>[];
    failures: unknown[];
    pending: Set<Promise<void>>;
  }
  let currentBatch: Batch | undefined;

  // Every inter-actor edge is an async handoff to the runtime: top-level
  // operations queue sequentially (`operationTail`), while an operation
  // initiated inside a running one executes inline — queueing it behind the
  // tail would deadlock the parent operation that awaits it.
  let operationTail: Promise<unknown> = Promise.resolve();
  let runningOperation = false;

  const track = (batch: Batch, operation: Promise<void>): Promise<void> => {
    batch.pending.add(operation);
    void operation
      .catch((error) => {
        // Collect the failure so it reaches `executeEffects` even when the
        // operation leaves the pending set before settle() samples it.
        batch.failures.push(error);
      })
      .then(() => batch.pending.delete(operation));
    return operation;
  };

  const handOff = (
    batch: Batch,
    run: () => void | PromiseLike<void>
  ): PromiseLike<void> => {
    if (runningOperation) {
      return track(
        batch,
        Promise.resolve(run()).then(() => undefined)
      );
    }
    const operation = operationTail.then(async () => {
      runningOperation = true;
      try {
        await run();
      } finally {
        runningOperation = false;
      }
    });
    operationTail = operation.catch(() => {});
    return track(batch, operation);
  };

  // Hands an operation over according to where it was initiated: batched
  // during `executeEffects`, immediate while the loop is parked.
  const dispatch = (run: () => void | PromiseLike<void>) =>
    currentBatch ? handOff(currentBatch, run) : run();

  const drain = async (batch: Batch): Promise<void> => {
    while (batch.pending.size) {
      await Promise.allSettled([...batch.pending]);
    }
  };

  const settle = async (batch: Batch): Promise<void> => {
    await drain(batch);
    if (batch.failures.length) {
      throw batch.failures[0];
    }
  };

  function wrapRuntime(
    runtime: Partial<ActorSystemRuntime>,
    localDeliveryFallback: boolean,
    // When given, operations neither this runtime nor the adapter implements
    // keep the behavior they would have had without a per-effect runtime,
    // instead of crashing the effect that uses them.
    fallbackSystem?: AnyActorSystem
  ): Partial<ActorSystemRuntime> {
    const wrapped: Partial<ActorSystemRuntime> = {};
    for (const operation of RUNTIME_OPERATIONS) {
      const impl = (runtime[operation] ??
        fallbackSystem?.[operation]?.bind(fallbackSystem)) as
        | ((...args: unknown[]) => void | PromiseLike<void>)
        | undefined;
      if (impl) {
        (wrapped as Record<string, unknown>)[operation] = (
          ...args: unknown[]
        ) => dispatch(() => impl(...args));
      }
    }
    wrapped.sendEvent = (source, target, event) => {
      if (currentBatch && target.address === rootAddress) {
        // Only the execution's own effects produce captured root events; a
        // root-addressed send while the loop is parked is an ordinary host
        // delivery that belongs in the host's mailbox.
        currentBatch.rootEvents.push({ event, source });
        return;
      }
      const impl = runtime.sendEvent;
      if (impl) {
        return dispatch(() => impl(source, target, event));
      }
      if (localDeliveryFallback) {
        return dispatch(() => deliverEvent(source, target, event));
      }
      throw new TypeError(
        `The durable runtime does not support the sendEvent operation (target '${target.address}')`
      );
    };
    return wrapped;
  }

  const wrappedSystemRuntime = hasSystemRuntime
    ? wrapRuntime(systemRuntime, true)
    : undefined;

  let executionSystem: AnyActorSystem | undefined;

  function installSystemRuntime<TSnapshot>(snapshot: TSnapshot): TSnapshot {
    if (wrappedSystemRuntime) {
      const ref = getSnapshotActorRef(snapshot as Snapshot<unknown>)?.actor;
      if (ref) {
        ref.system.runtime = wrappedSystemRuntime;
        executionSystem ??= ref.system;
      }
      // Children restored outside this execution (rehydrated actors and
      // remote handles) may carry a system created before this install.
      const children = (
        snapshot as { children?: Record<string, AnyActor | undefined> }
      ).children;
      if (children) {
        for (const child of Object.values(children)) {
          // Only restored/rehydrated children can carry a foreign system;
          // everything else shares the root's.
          if (child && child.system !== ref?.system) {
            child.system.runtime = wrappedSystemRuntime;
          }
        }
      }
    }
    return snapshot;
  }

  const execution: DurableExecution<TLogic> = {
    rootAddress,
    get nextTransitionIndex() {
      return nextTransitionIndex;
    },
    initialTransition(...args) {
      const [snapshot, effects] = initialTransition(logic, ...args);
      return [installSystemRuntime(snapshot), tagEffects(effects)];
    },
    transition(snapshot, event) {
      const [nextSnapshot, effects] = transition(logic, snapshot, event);
      return [installSystemRuntime(nextSnapshot), tagEffects(effects)];
    },
    getActorRef(snapshot) {
      return getSnapshotActorRef(snapshot as Snapshot<unknown>)?.actor;
    },
    async executeEffects(effects) {
      const batch: Batch = {
        rootEvents: [],
        failures: [],
        pending: new Set()
      };
      currentBatch = batch;
      // `undefined` lets the effect's default parameter (the actor's system,
      // and through it the installed `systemRuntime`) apply; without any
      // runtime, the empty object makes unsupported operations throw instead
      // of silently running local behavior on a durable host.
      const fallbackRuntime = hasSystemRuntime ? undefined : {};
      try {
        for (const tagged of effects) {
          const { effect } = tagged;
          const metadata: DurableEffectMetadata = {
            id: tagged.id,
            transitionIndex: tagged.transitionIndex,
            effectIndex: tagged.effectIndex
          };
          const perEffectRuntime = adapter.runtime?.(metadata, effect);
          // A per-effect runtime overrides the system runtime
          // operation-by-operation; operations it omits keep the system
          // runtime's behavior.
          const runtime = perEffectRuntime
            ? wrapRuntime(
                { ...systemRuntime, ...perEffectRuntime },
                hasSystemRuntime,
                executionSystem
              )
            : fallbackRuntime;
          if (effect.kind === 'action') {
            // Custom actions have no default-parameter fallback to the actor's
            // system, so hand them the wrapped system runtime directly.
            await adapter.executeAction(
              effect,
              metadata,
              runtime ?? wrappedSystemRuntime ?? {}
            );
          } else {
            await effect.exec(runtime);
          }
        }
        await settle(batch);
        return batch.rootEvents as DurableRootEvent<EventFromLogic<TLogic>>[];
      } catch (error) {
        // Drain before discarding so batch-initiated operations are not still
        // running when the retrying host re-executes the effects. The failed
        // batch's captures and failures are discarded with it.
        await drain(batch);
        throw error;
      } finally {
        // Runs after `settle()`/`drain()`, so operations the batch initiated
        // are still treated as in-batch while they finish.
        currentBatch = undefined;
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
      const internalEvents = await execution.executeEffects(effects);

      while ((snapshot as Snapshot<OutputFrom<TLogic>>).status === 'active') {
        // Root-bound events produced while effects executed are processed
        // before durably waiting for an external event.
        const event =
          internalEvents.shift()?.event ?? (await execution.waitForEvent());
        [snapshot, effects] = execution.transition(snapshot, event);
        internalEvents.push(...(await execution.executeEffects(effects)));
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
