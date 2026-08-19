import {
  getEffectDescriptor,
  type EffectDescriptor
} from '../effectDescriptor.ts';
import { deliverEvent } from '../runtimeHelpers.ts';
import { getSnapshotActorRef } from '../snapshotActorRef.ts';
import { getActorIdPrefix, type ActorSystemRuntime } from '../system.ts';
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

const RUNTIME_OPERATIONS = [
  'spawnActor',
  'startActor',
  'stopActor',
  'terminateActor',
  'emitEvent',
  'scheduleTimer',
  'cancelTimer',
  'cancelAllTimers'
] as const satisfies readonly (keyof ActorSystemRuntime)[];

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
  /**
   * Runtime operations installed on the actor system of every snapshot this
   * execution produces, including children created during transitions and
   * actors rehydrated from restored snapshots. Operations initiated by live
   * child actors (parent sends, timers, terminations) route here without any
   * per-actor wiring; omitted operations keep their default local behavior.
   *
   * Events addressed to this execution's root actor never reach `sendEvent`:
   * the execution captures them and resolves them from `executeEffects` for
   * the durable loop to process before suspending.
   */
  systemRuntime?: Partial<ActorSystemRuntime>;
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
    return effects.map((effect, effectIndex) => ({
      id: `${transitionIndex}:${effectIndex}`,
      transitionIndex,
      effectIndex,
      effect,
      descriptor: getEffectDescriptor(effect)
    }));
  };

  const rootPrefix = getActorIdPrefix(logic);
  const rootAddress = rootPrefix === 'x' ? 'x:0' : rootPrefix;

  // Every inter-actor edge is an async handoff to the runtime. Operations are
  // handed over strictly sequentially (`operationTail`) and tracked
  // (`pendingOperations`) so `executeEffects` resolves only when the
  // transitive closure of initiated operations has been accepted. Events
  // addressed to the root are captured for the durable loop instead of being
  // delivered to the (inert) root actor.
  const pendingOperations = new Set<Promise<void>>();
  let operationTail: Promise<unknown> = Promise.resolve();
  const capturedRootEvents: DurableRootEvent<AnyEventObject>[] = [];

  let runningOperation = false;
  const operationFailures: unknown[] = [];

  const track = (operation: Promise<void>): Promise<void> => {
    pendingOperations.add(operation);
    operation.then(
      () => pendingOperations.delete(operation),
      (error) => {
        // Collect the failure so it reaches `executeEffects` even when the
        // operation leaves the pending set before settle() samples it.
        operationFailures.push(error);
        pendingOperations.delete(operation);
      }
    );
    return operation;
  };

  const handOff = (run: () => void | PromiseLike<void>): PromiseLike<void> => {
    if (runningOperation) {
      // An operation initiated while another operation is running (for
      // example a host `sendEvent` that awaits a nested timer) executes
      // inline: queueing it behind the tail would deadlock the parent
      // operation that awaits it.
      return track(Promise.resolve(run()).then(() => undefined));
    }
    const operation = operationTail.then(async () => {
      runningOperation = true;
      try {
        await run();
      } finally {
        runningOperation = false;
      }
    });
    operationTail = operation.then(
      () => undefined,
      () => undefined
    );
    return track(operation);
  };

  const settle = async (): Promise<void> => {
    while (pendingOperations.size) {
      await Promise.allSettled([...pendingOperations]);
    }
    if (operationFailures.length) {
      const failures = operationFailures.splice(0);
      throw failures[0];
    }
  };

  function wrapRuntime(
    runtime: Partial<ActorSystemRuntime>,
    options: { localDeliveryFallback: boolean }
  ): Partial<ActorSystemRuntime> {
    const wrapped: Partial<ActorSystemRuntime> = {};
    for (const operation of RUNTIME_OPERATIONS) {
      const impl = runtime[operation] as
        | ((...args: unknown[]) => void | PromiseLike<void>)
        | undefined;
      if (impl) {
        (wrapped as Record<string, unknown>)[operation] = (
          ...args: unknown[]
        ) => handOff(() => impl(...args));
      }
    }
    wrapped.sendEvent = (source, target, event) => {
      if (target.address === rootAddress) {
        capturedRootEvents.push({ event, source });
        return;
      }
      const impl = runtime.sendEvent;
      if (impl) {
        return handOff(() => impl(source, target, event));
      }
      if (options.localDeliveryFallback) {
        return handOff(() => deliverEvent(source, target, event));
      }
      throw new TypeError(
        `The durable runtime does not support the sendEvent operation (target '${target.address}')`
      );
    };
    return wrapped;
  }

  const wrappedSystemRuntime = adapter.systemRuntime
    ? wrapRuntime(adapter.systemRuntime, { localDeliveryFallback: true })
    : undefined;

  function installSystemRuntime<TSnapshot>(snapshot: TSnapshot): TSnapshot {
    if (wrappedSystemRuntime) {
      const ref = getSnapshotActorRef(snapshot as Snapshot<unknown>)?.actor;
      if (ref) {
        ref.system.runtime = wrappedSystemRuntime;
      }
      // Children restored outside this execution (rehydrated actors and
      // remote handles) may carry a system created before this install.
      const children = (
        snapshot as { children?: Record<string, AnyActor | undefined> }
      ).children;
      if (children) {
        for (const child of Object.values(children)) {
          if (child) {
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
      try {
        for (const {
          effect,
          descriptor: _descriptor,
          ...metadata
        } of effects) {
          // With a `systemRuntime`, an absent per-effect runtime stays
          // `undefined` so the effect's default parameter (the actor's system,
          // and through it the installed `systemRuntime`) applies. Without
          // either, the empty runtime makes unsupported operations throw
          // instead of silently running local behavior on a durable host.
          const perEffectRuntime = adapter.runtime?.(metadata, effect);
          // A per-effect runtime overrides the system runtime
          // operation-by-operation; operations it omits keep the system
          // runtime's behavior.
          const runtime = perEffectRuntime
            ? wrapRuntime(
                { ...adapter.systemRuntime, ...perEffectRuntime },
                { localDeliveryFallback: !!adapter.systemRuntime }
              )
            : adapter.systemRuntime
              ? undefined
              : {};
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
        await settle();
      } catch (error) {
        // A failed batch must not leak its captured root events or its
        // recorded operation failures into a later call: a retrying host
        // re-executes the effects and re-captures them. Drain the operations
        // still in flight first, so their rejections land in
        // `operationFailures` before it is cleared.
        while (pendingOperations.size) {
          await Promise.allSettled([...pendingOperations]);
        }
        capturedRootEvents.length = 0;
        operationFailures.length = 0;
        throw error;
      }
      return capturedRootEvents.splice(0) as DurableRootEvent<
        EventFromLogic<TLogic>
      >[];
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
