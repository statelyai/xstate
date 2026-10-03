import { getTimerStart, recordTimerStart } from '../timerClock.ts';
import {
  getEffectDescriptor,
  type EffectDescriptor
} from '../effectDescriptor.ts';
import { deliverEvent } from '../runtimeHelpers.ts';
import {
  attachSnapshotActorRef,
  createInertActorScope,
  setInertActorScopeSnapshot
} from '../inertActorScope.ts';
import { isRemoteActorRef } from '../remoteActorRef.ts';
import { createStartEffect, createTimerEffect } from '../transitionActions.ts';
import { getSnapshotActorRef } from '../snapshotActorRef.ts';
import {
  encodeAddressSegment,
  withExecutionIdentity,
  withSystemInspector,
  getRootActorId,
  RUNTIME_OPERATIONS,
  type ActorSystemRuntime
} from '../system.ts';
import type { InspectionEvent } from '../inspection.ts';
import { initialTransition, transition } from '../transition.ts';
import type {
  AnyActor,
  AnyActorLogic,
  AnyEventObject,
  CustomExecutableActionObject,
  EventFromLogic,
  ExecutableActionObjectFromLogic,
  ExecutableActionObject,
  InputFrom,
  LogicalTimer,
  OutputFrom,
  Snapshot,
  SnapshotFrom
} from '../types.ts';

/** @experimental */
export interface DurableEffectMetadata {
  /** Stable within one durable execution. */
  id: string;
  transitionIndex: number;
  effectIndex: number;
}

/** @experimental */
export interface DurableWaitMetadata {
  /** Stable within one durable execution. */
  id: string;
  transitionIndex: number;
}

/**
 * An event addressed to a durable execution's root actor, captured while
 * effects settled. `source` is the live reference of the sending actor when
 * one initiated the send.
 *
 * @experimental
 */
export interface DurableRootEvent<TEvent> {
  event: TEvent;
  source: AnyActor | undefined;
}

/** @experimental */
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
 * during `executeEffects`: the execution captures and retains them, and the
 * execution's `waitForEvent()` hands them out before deferring to this
 * adapter. While the loop is parked, a root-addressed event reaches
 * `enqueueRootEvent`, or the broader `sendEvent` override when implemented,
 * so the host can place it in its own mailbox.
 *
 * @experimental
 */
export interface DurableExecutionAdapter<
  TLogic extends AnyActorLogic
> extends Partial<ActorSystemRuntime> {
  /**
   * Absolute clock in milliseconds, defaulting to Date.now. Checkpoints and
   * resumed executions must use the same time origin. Replay hosts should
   * return the recorded scheduling time rather than the replay's wall clock.
   */
  now?(): number;
  /**
   * Accepts a timer synchronously, or fulfills its promise when registration
   * accepts the timer and its delay begins. For a new timer, that acceptance
   * time is read through now() and persisted. Retried/restored timers retain
   * their original deadline; hosts must honor it during registration.
   */
  scheduleTimer?: ActorSystemRuntime['scheduleTimer'];
  /**
   * Enqueues an event addressed to this execution's root while the durable
   * loop is parked in `waitForEvent()`. Use this when the host only owns the
   * root mailbox; implementing `sendEvent` instead takes ownership of delivery
   * for every target and must use `deliverEvent` for co-located actors.
   */
  enqueueRootEvent?(
    source: AnyActor | undefined,
    event: AnyEventObject
  ): void | PromiseLike<void>;
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
  /**
   * Waits durably for the next event addressed to this execution. Typed to
   * also accept plain event objects: an adapter written against
   * `AnyActorLogic` (a generic host library) cannot produce
   * `EventFromLogic<TLogic>`, and the events a host relays are runtime data
   * anyway — the execution narrows at its own boundary.
   */
  waitForEvent(
    metadata: DurableWaitMetadata
  ):
    | EventFromLogic<TLogic>
    | AnyEventObject
    | PromiseLike<EventFromLogic<TLogic> | AnyEventObject>;
  /** Index assigned to the first transition. Defaults to `0`. */
  transitionIndex?: number;
  /**
   * Pins this execution's actor identity. Session ids become
   * `<executionId>:<n>`, a deterministic function of actor-creation order, so
   * a replay re-creates the same session ids and journaled completion events
   * (which carry the producing incarnation's `sessionId`) still match the
   * children the replay re-creates. Without it, session ids embed a random
   * per-process system id and journaled internal events go stale across
   * replays. Uniqueness across executions is the host's responsibility.
   */
  executionId?: string;
}

/** @experimental */
export class DurableExecutionCancelledError extends Error {
  constructor() {
    super('Durable execution was stopped');
    this.name = 'DurableExecutionCancelledError';
  }
}

/** @experimental */
export class DurableExecutionResumeError extends Error {
  constructor() {
    super(
      'run() can only start a fresh durable execution; resume checkpoints with restore() and the explicit transition loop'
    );
    this.name = 'DurableExecutionResumeError';
  }
}

/**
 * The snapshot type a durable execution hands back: the logic's own snapshot,
 * intersected with the base `Snapshot` union so the `status`/`output`/`error`
 * discriminant stays visible even when `TLogic` is an unresolved type
 * parameter (a generic host library), where `SnapshotFrom` alone is opaque.
 *
 * @experimental
 */
export type DurableSnapshot<TLogic extends AnyActorLogic> =
  SnapshotFrom<TLogic> & Snapshot<OutputFrom<TLogic>>;

/** @experimental */
export interface DurableExecution<TLogic extends AnyActorLogic> {
  /**
   * The logical address of this execution's root actor: the logic's own name,
   * or `x:0` for anonymous logic. Known before any transition runs, so hosts
   * can label mailboxes and wire messages without a snapshot.
   */
  readonly rootAddress: string;
  /** The machine's id, for pinning a journal to the logic that produced it. */
  readonly machineId: string;
  /**
   * The machine's declared `version`. Persist it with the execution and
   * reject a worker whose machine version differs: a changed machine
   * reorders effect ids, and memoized results silently misalign.
   */
  readonly machineVersion: string | undefined;
  /** Index assigned to the next transition. Persist this with checkpoints. */
  readonly nextTransitionIndex: number;
  /**
   * Restores a checkpoint on a fresh execution. Returns effects that start
   * active embedded children and re-arm pending root timers; execute them
   * with `executeEffects` before waiting or processing the next event.
   * Does not send a machine event, replay entry actions, or advance the
   * transition index. Restoration effect IDs use `restore:<index>:<effect>`.
   */
  restore(
    persistedSnapshot: Snapshot<unknown>
  ): [
    snapshot: DurableSnapshot<TLogic>,
    effects: DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[]
  ];
  initialTransition(
    ...[input]: undefined extends InputFrom<TLogic>
      ? [input?: InputFrom<TLogic>]
      : [input: InputFrom<TLogic>]
  ): [
    snapshot: DurableSnapshot<TLogic>,
    effects: DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[]
  ];
  transition(
    snapshot: SnapshotFrom<TLogic>,
    event: EventFromLogic<TLogic>
  ): [
    snapshot: DurableSnapshot<TLogic>,
    effects: DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[]
  ];
  /**
   * Returns the actor reference behind a snapshot produced by this execution,
   * for addressing and inspection. `undefined` for snapshots this execution
   * has not seen (for example a freshly deserialized checkpoint that has not
   * been passed through `restore()` or `transition()` yet).
   *
   * With an `address`, returns the live actor at that logical address in the
   * snapshot's actor tree instead — the root itself, one of its transitive
   * children, or `undefined` when no live actor has that address (for
   * example a timer firing for an actor that already completed).
   */
  getActorRef(
    snapshot: SnapshotFrom<TLogic>,
    address?: string
  ): AnyActor | undefined;
  /**
   * Executes effects and resolves only when every runtime operation they
   * transitively initiated — including operations from live child actors
   * reacting to delivered events — has been accepted by the runtime; a
   * failed operation rejects it. Operations are handed to the runtime one at
   * a time, in initiation order.
   *
   * Events addressed to this execution's root actor that were produced along
   * the way are retained, in order, and handed out by `waitForEvent()`
   * before it defers to the adapter — so the drive loop is just
   * `transition(snapshot, await waitForEvent())` + `executeEffects`.
   */
  executeEffects(
    effects: readonly DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[]
  ): Promise<void>;
  /**
   * Resolves with the next event addressed to this execution's root actor:
   * an event a prior `executeEffects` batch captured (an invoked actor
   * completing, a child reporting up), or — once none are queued — whatever
   * the adapter's durable wait produces.
   */
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
export interface DurableExecutionOptions {
  /**
   * Observes the execution's inspection events — actor lifecycle, event
   * routing, transitions — across the whole live actor tree. The host-side
   * home for operation logs and instrumentation, so adapters stay pure
   * physics.
   */
  inspect?: (inspectionEvent: InspectionEvent) => void;
}

/** @experimental */
export function createDurable<TLogic extends AnyActorLogic>(
  logic: TLogic,
  adapter: DurableExecutionAdapter<TLogic>,
  options?: DurableExecutionOptions
): DurableExecution<TLogic> {
  let nextTransitionIndex = adapter.transitionIndex ?? 0;
  const startingTransitionIndex = nextTransitionIndex;
  let restored = false;
  const now = () => adapter.now?.() ?? Date.now();
  const observedRoots = new WeakSet<AnyActor>();
  let lastTransitionIndex =
    nextTransitionIndex === 0 ? undefined : nextTransitionIndex - 1;
  interface TimerDeadline {
    deadline: number;
    delay: number;
  }
  const restoredTimerDeadlines = new WeakMap<
    ExecutableActionObject,
    TimerDeadline
  >();

  if (!Number.isSafeInteger(nextTransitionIndex) || nextTransitionIndex < 0) {
    throw new RangeError('transitionIndex must be a non-negative safe integer');
  }

  const tagEffects = (
    effects: ExecutableActionObjectFromLogic<TLogic>[],
    restoring = false
  ): DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[] => {
    const transitionIndex = restoring
      ? nextTransitionIndex
      : nextTransitionIndex++;
    lastTransitionIndex = restoring
      ? (lastTransitionIndex ?? transitionIndex)
      : transitionIndex;
    return effects.map((effect, effectIndex) => {
      const tagged = {
        id: `${restoring ? 'restore:' : ''}${transitionIndex}:${effectIndex}`,
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

  // The root's address as the root actor reports it: root-event capture
  // compares against `target.address`, which percent-encodes each segment.
  const rootAddress = encodeAddressSegment(getRootActorId(logic));
  const machineId = (logic as { id?: string }).id ?? rootAddress;
  const machineVersion = (logic as { version?: string }).version;
  // One identity object for the whole execution: session numbering continues
  // across this execution's transitions, and a replay (a fresh createDurable
  // with the same executionId) re-numbers identically.
  const executionIdentity = adapter.executionId
    ? { systemId: adapter.executionId, nextSessionId: 0 }
    : undefined;

  // The adapter's runtime operations, picked off the flat adapter shape.
  const systemRuntime: Partial<ActorSystemRuntime> = {};
  for (const operation of [
    ...RUNTIME_OPERATIONS,
    'sendEvent',
    'runStep',
    'runLogic'
  ] as const) {
    const impl = adapter[operation];
    if (impl) {
      (systemRuntime as Record<string, unknown>)[operation] =
        impl.bind(adapter);
    }
  }
  const hasSystemRuntime =
    Object.keys(systemRuntime).length > 0 || !!adapter.enqueueRootEvent;

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

  // Root-addressed events captured by settled batches, waiting for the drive
  // loop to take them through `waitForEvent()`.
  const pendingRootEvents: DurableRootEvent<AnyEventObject>[] = [];

  // Every inter-actor edge is an async handoff to the runtime, and every
  // handoff queues behind the last one: hosts whose step or activity model
  // forbids concurrent entries depend on that, and so does deterministic
  // replay. An operation must therefore never await another operation of the
  // same execution through the actor system — it would wait behind itself.
  let operationTail: Promise<unknown> = Promise.resolve();

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
    const operation = operationTail.then(run).then(() => undefined);
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
    // When set, operations neither this runtime nor the adapter implements
    // keep the behavior they would have had without a per-effect runtime,
    // running against the operation's own actor's system (per-system timer
    // bookkeeping must land on that system, not the root's). Safe from
    // re-entrant dispatch: that system's installed runtime lacks these
    // operations by construction, so the call falls through to local
    // behavior.
    fallbackToActorSystem = false,
    timerDeadline?: TimerDeadline
  ): Partial<ActorSystemRuntime> {
    const wrapped: Partial<ActorSystemRuntime> = {};
    for (const operation of RUNTIME_OPERATIONS) {
      const impl = (runtime[operation] ??
        (fallbackToActorSystem
          ? (...args: unknown[]) => {
              const owner = (
                operation === 'spawnActor' ? args[1] : args[0]
              ) as AnyActor;
              return (
                owner.system[operation] as (
                  ...args: unknown[]
                ) => void | PromiseLike<void>
              )(...args);
            }
          : undefined)) as
        | ((...args: unknown[]) => void | PromiseLike<void>)
        | undefined;
      if (impl) {
        (wrapped as Record<string, unknown>)[operation] = (
          ...args: unknown[]
        ) =>
          dispatch(() => {
            // Runtime operations can queue behind asynchronous child startup.
            // Calculate the remaining time when dispatching to the adapter.
            if (operation === 'scheduleTimer' && timerDeadline) {
              args[2] = Math.min(
                timerDeadline.delay,
                Math.max(0, timerDeadline.deadline - now())
              );
            }
            if (operation === 'scheduleTimer') {
              const source = args[0] as AnyActor;
              const timer = source.getSnapshot()?.timers?.[
                args[1] as string
              ] as LogicalTimer | undefined;
              if (timer) {
                const previousStart = getTimerStart(timer);
                if (previousStart !== undefined && !timerDeadline) {
                  args[2] = Math.min(
                    timer.delay,
                    Math.max(0, previousStart + timer.delay - now())
                  );
                }
                const result = impl(...args);
                if (result) {
                  return Promise.resolve(result).then(() => {
                    recordTimerStart(timer, previousStart ?? now());
                  });
                }
                recordTimerStart(timer, previousStart ?? now());
                return;
              }
            }
            return impl(...args);
          });
      }
    }
    // A step is an orchestration frame: it may itself await runtime
    // operations of this execution, so it passes through undispatched —
    // queuing it on the operation tail would make it wait behind (and
    // deadlock with) the operations its own body initiates.
    if (runtime.runStep) {
      wrapped.runStep = runtime.runStep;
    }
    if (runtime.runLogic) {
      wrapped.runLogic = runtime.runLogic;
    }
    wrapped.sendEvent = (source, target, event) => {
      if (
        !currentBatch &&
        target.address === rootAddress &&
        !runtime.sendEvent &&
        adapter.enqueueRootEvent
      ) {
        return dispatch(() => adapter.enqueueRootEvent!(source, event));
      }
      if (
        !currentBatch &&
        target.address === rootAddress &&
        !runtime.sendEvent
      ) {
        // The root actor is inert; delivering locally would enqueue into a
        // mailbox that never runs, silently losing the event.
        throw new Error(
          `A root-addressed event ("${event.type}") was produced while the durable loop was parked, but the adapter has no enqueueRootEvent or sendEvent to receive it. Implement enqueueRootEvent to place root-addressed events in the host's mailbox.`
        );
      }
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

  // Depth-first walk of the live actor tree by logical address. Subtrees
  // whose address is not a prefix of the target are pruned.
  function findByAddress(
    actor: AnyActor,
    address: string
  ): AnyActor | undefined {
    if (actor.address === address) {
      return actor;
    }
    if (!address.startsWith(`${actor.address}/`)) {
      return undefined;
    }
    const children = (
      actor.getSnapshot() as { children?: Record<string, AnyActor | undefined> }
    ).children;
    for (const child of Object.values(children ?? {})) {
      const found = child && findByAddress(child, address);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  const inspect = options?.inspect;

  // Attaches the execution's inspector to a system that does not have it
  // yet. Systems constructed inside a transition get it at construction (the
  // ambient inspector); this covers systems materialized outside that window
  // — a snapshot's system first touched here, or a restored child's foreign
  // system. Observer presence doubles as the dedup check: this execution is
  // the only thing attaching observers to its systems.
  function wireInspection(system: AnyActor['system']): void {
    if (inspect && !system._hasInspectionObservers?.()) {
      system.inspect(inspect);
    }
  }

  function installSystemRuntime<TSnapshot>(
    snapshot: TSnapshot,
    recursive = false
  ): TSnapshot {
    if ((snapshot as Snapshot<unknown>).status === 'error') {
      const root = getSnapshotActorRef(snapshot as Snapshot<unknown>)?.actor;
      if (root && !observedRoots.has(root)) {
        // The host consumes error snapshots (run() rejects with their error).
        // Observe before termination effects execute, without materializing
        // otherwise lazy roots during successful pure transitions.
        root.subscribe({ error() {} });
        observedRoots.add(root);
      }
    }
    if (wrappedSystemRuntime || inspect) {
      const ref = getSnapshotActorRef(snapshot as Snapshot<unknown>)?.actor;
      const systems = new Set<AnyActor['system']>();
      const visit = (actor: AnyActor) => {
        if (!systems.has(actor.system)) {
          systems.add(actor.system);
          if (wrappedSystemRuntime) {
            actor.system.runtime = wrappedSystemRuntime;
          }
          wireInspection(actor.system);
        }
        if (recursive) {
          const children = (
            actor.getSnapshot() as {
              children?: Record<string, AnyActor | undefined>;
            }
          ).children;
          for (const child of Object.values(children ?? {})) {
            if (child) {
              visit(child);
            }
          }
        }
      };
      if (ref) {
        visit(ref);
      }
      if (!recursive || !ref) {
        const children = (
          snapshot as {
            children?: Record<string, AnyActor | undefined>;
          }
        ).children;
        for (const child of Object.values(children ?? {})) {
          if (child) {
            visit(child);
          }
        }
      }
    }
    return snapshot;
  }

  const execution: DurableExecution<TLogic> = {
    rootAddress,
    machineId,
    machineVersion,
    get nextTransitionIndex() {
      return nextTransitionIndex;
    },
    restore(persistedSnapshot) {
      if (
        restored ||
        nextTransitionIndex !== startingTransitionIndex ||
        currentBatch
      ) {
        throw new Error('restore() requires a fresh durable execution');
      }
      const { snapshot, scope } = withSystemInspector(inspect, () =>
        withExecutionIdentity(executionIdentity, () => {
          const scope = createInertActorScope(logic);
          const snapshot = logic.restoreSnapshot
            ? logic.restoreSnapshot(persistedSnapshot, scope)
            : persistedSnapshot;
          setInertActorScopeSnapshot(scope, snapshot, false);
          return {
            snapshot: installSystemRuntime(
              attachSnapshotActorRef(scope, snapshot),
              true
            ) as DurableSnapshot<TLogic>,
            scope
          };
        })
      );
      const effects: ExecutableActionObject[] = [];
      if ((snapshot as Snapshot<unknown>).status === 'active') {
        const { children, timers } = snapshot as {
          children?: Record<string, AnyActor | undefined>;
          timers?: Readonly<Record<string, LogicalTimer>>;
        };
        for (const child of Object.values(children ?? {})) {
          if (
            child &&
            !isRemoteActorRef(child) &&
            child.getSnapshot().status === 'active'
          ) {
            effects.push(createStartEffect(child));
          }
        }
        for (const timer of Object.values(timers ?? {})) {
          const effect = createTimerEffect(scope, timer, timer.delay);
          if (timer.startedAt !== undefined) {
            restoredTimerDeadlines.set(effect, {
              deadline: timer.startedAt + timer.delay,
              delay: timer.delay
            });
          }
          effects.push(effect);
        }
      }
      restored = true;
      return [
        snapshot,
        tagEffects(effects as ExecutableActionObjectFromLogic<TLogic>[], true)
      ];
    },
    initialTransition(...args) {
      if (restored) {
        throw new Error(
          'initialTransition() cannot initialize a restored execution'
        );
      }
      const [snapshot, effects] = withSystemInspector(inspect, () =>
        withExecutionIdentity(executionIdentity, () =>
          initialTransition(logic, ...args)
        )
      );
      return [installSystemRuntime(snapshot), tagEffects(effects)];
    },
    transition(snapshot, event) {
      const [nextSnapshot, effects] = withSystemInspector(inspect, () =>
        withExecutionIdentity(executionIdentity, () =>
          transition(logic, snapshot, event)
        )
      );
      return [installSystemRuntime(nextSnapshot), tagEffects(effects)];
    },
    getActorRef(snapshot, address) {
      const root = getSnapshotActorRef(snapshot as Snapshot<unknown>)?.actor;
      if (!root || address === undefined) {
        return root;
      }
      return findByAddress(root, address);
    },
    async executeEffects(effects) {
      if (currentBatch) {
        throw new Error(
          'executeEffects calls must not overlap: await the previous call before starting the next batch.'
        );
      }
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
          const timerDeadline = restoredTimerDeadlines.get(effect);
          // A per-effect runtime overrides the system runtime
          // operation-by-operation; operations it omits keep the system
          // runtime's behavior.
          const runtime =
            perEffectRuntime || timerDeadline
              ? wrapRuntime(
                  { ...systemRuntime, ...perEffectRuntime },
                  hasSystemRuntime,
                  !!perEffectRuntime || hasSystemRuntime,
                  timerDeadline
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
        pendingRootEvents.push(...batch.rootEvents);
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
        throw new Error(
          'Cannot wait for an event before the first transition or restore'
        );
      }
      // Root-bound events produced while effects executed are handed out
      // before durably waiting for an external event.
      const queued = pendingRootEvents.shift();
      if (queued) {
        return queued.event as EventFromLogic<TLogic>;
      }
      return adapter.waitForEvent({
        id:
          restored && nextTransitionIndex === 0
            ? 'event:restore:0'
            : `event:${lastTransitionIndex}`,
        transitionIndex: lastTransitionIndex
      }) as Promise<EventFromLogic<TLogic>>;
    },
    async run(...args) {
      if (
        restored ||
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
