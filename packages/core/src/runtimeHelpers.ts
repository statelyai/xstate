import isDevelopment from '#is-development';
import { xstateError } from './xstateError.ts';
import {
  XSTATE_LOGIC_EFFECT_REJECT,
  XSTATE_LOGIC_EFFECT_RESOLVE,
  XSTATE_LOGIC_EFFECT_START
} from './constants.ts';
import {
  createMissingAddressError,
  getAddressId,
  isRemoteActorRef,
  isSerializedActorRef,
  resolveSerializedActorRef
} from './remoteActorRef.ts';
import type { ActorSystemRuntime } from './system.ts';
import type {
  EventObject,
  ActorTermination,
  AnyActor,
  AnyEventObject,
  DoneActorEvent,
  ErrorActorEvent,
  SnapshotEvent,
  Subscription
} from './types.ts';

const lifecycleDeliveries = new WeakMap<
  AnyEventObject,
  { source: AnyActor; target: AnyActor }
>();

/** @internal Marks an actor lifecycle notification for one delivery to its parent. */
export function relayChildLifecycleEvent(
  source: AnyActor,
  target: AnyActor,
  event: DoneActorEvent | ErrorActorEvent | SnapshotEvent
): void | PromiseLike<void> {
  // Keep origin off the event payload. Hosts can inspect or serialize the
  // payload, but application sends cannot mint a local delivery.
  lifecycleDeliveries.set(Object.freeze(event), { source, target });
  return source.system._relay(source, target, event);
}

/** @internal */
export function publishEmittedEvent(
  source: AnyActor,
  event: EventObject,
  runtime: Partial<ActorSystemRuntime>
): void | PromiseLike<void> {
  source.system._notifyEmitted(source, event);
  return runtime.emitEvent!(source, event);
}

type StepEffects = Record<
  string,
  | { status: 'active' }
  | { status: 'done'; output: unknown }
  | { status: 'error'; error: unknown }
>;

function getStepEffect(actor: AnyActor, key: string) {
  const effects = (actor.getSnapshot() as { effects?: StepEffects }).effects;
  return effects && Object.prototype.hasOwnProperty.call(effects, key)
    ? effects[key]
    : undefined;
}

// Live promises belong to an actor incarnation, unlike its persisted journal.
// A restored active record has no promise here and must be retried locally.
const pendingSteps = new WeakMap<AnyActor, Map<string, Promise<unknown>>>();

/**
 * Runs one keyed step of an async actor with the built-in journal: the
 * result is memoized in the actor's own snapshot (`effects[key]`), so a
 * restored actor skips completed steps when its logic function re-runs.
 * Custom runtimes that implement `runStep` use this for the default local
 * behavior, the same way `deliverEvent` exposes local delivery.
 *
 * @experimental
 */
export async function runStep<TStepOutput>(
  actor: AnyActor,
  key: string,
  exec: () => TStepOutput | PromiseLike<TStepOutput>,
  sendSelf: (event: AnyEventObject) => void = (event) =>
    void actor.system.sendEvent(actor, actor, event)
): Promise<TStepOutput> {
  const effect = getStepEffect(actor, key);
  if (effect?.status === 'done') {
    return effect.output as TStepOutput;
  }
  if (effect?.status === 'error') {
    throw effect.error;
  }
  const running = pendingSteps.get(actor)?.get(key);
  if (running) {
    return running as Promise<TStepOutput>;
  }
  if (actor.getSnapshot().status !== 'active') {
    throw new Error(
      isDevelopment
        ? `Actor terminated before step "${key}" completed`
        : xstateError(72, key)
    );
  }

  let resolve!: (value: TStepOutput | PromiseLike<TStepOutput>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<TStepOutput>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  let steps = pendingSteps.get(actor);
  if (!steps) {
    steps = new Map();
    pendingSteps.set(actor, steps);
  }
  steps.set(key, promise);
  // oxlint-disable-next-line prefer-const
  let subscription: Subscription | undefined;
  const cleanup = () => {
    subscription?.unsubscribe();
    steps.delete(key);
    if (!steps.size) {
      pendingSteps.delete(actor);
    }
  };
  void promise.then(cleanup, cleanup);
  subscription = actor.subscribe({
    error: reject,
    complete: () =>
      reject(
        new Error(
          isDevelopment
            ? `Actor terminated before step "${key}" completed`
            : xstateError(72, key)
        )
      )
  });
  void (async () => {
    try {
      sendSelf({ type: XSTATE_LOGIC_EFFECT_START, key });
      const output = await exec();
      if (actor.getSnapshot().status === 'active') {
        sendSelf({ type: XSTATE_LOGIC_EFFECT_RESOLVE, key, output });
        resolve(output);
      }
    } catch (error) {
      if (actor.getSnapshot().status === 'active') {
        sendSelf({ type: XSTATE_LOGIC_EFFECT_REJECT, key, error });
      }
      reject(error);
    }
  })().catch(reject);
  return promise;
}

/**
 * Delivers an event directly to a target actor, bypassing any installed host
 * runtime. Custom runtimes use this for the default local delivery behavior
 * inside their own `sendEvent` implementations.
 * Pass a co-located lifecycle notification through without cloning it.
 * For a remote lifecycle notification, supply the parent's current child
 * handle as `source` after the host verifies the notification's origin.
 *
 * @experimental
 */
export function deliverEvent(
  source: AnyActor | undefined,
  target: AnyActor,
  event: AnyEventObject
): void {
  if (isSerializedActorRef(target)) {
    const serialized = target;
    const system = source?.system;
    const live = system && resolveSerializedActorRef(system, serialized);
    if (!live) {
      const error = createMissingAddressError(serialized);
      if (!system) {
        throw error;
      }
      void system.deadLetter(source, undefined, event, 'missingTarget', {
        targetId: getAddressId(serialized['@actor']),
        error
      });
      return;
    }
    target = live;
  }
  if (rejectUndeliverableEvent(source, target, event, true)) {
    return;
  }
  const runtimeTarget = target as AnyActor & {
    _send(event: AnyEventObject, sourceRef?: AnyActor): void;
  };

  runtimeTarget._send(event, source);
}

/**
 * Returns the boundary error preventing this delivery, if any: an internal
 * event type cannot cross an actor boundary from an external sender.
 */
function getEventBoundaryError(
  source: AnyActor | undefined,
  target: AnyActor,
  event: AnyEventObject,
  directDelivery: boolean
): Error | undefined {
  switch (event.type) {
    case 'xstate.done.actor':
    case 'xstate.error.actor':
    case 'xstate.snapshot.actor': {
      const origin = lifecycleDeliveries.get(event);
      if (origin && origin.source === source && origin.target === target) {
        if (directDelivery) {
          lifecycleDeliveries.delete(event);
        }
        return undefined;
      }
      // Host adapters deliver decoded notifications directly from the
      // current remote child handle. Ordinary system sends have no such lane.
      if (
        directDelivery &&
        source &&
        isRemoteActorRef(source) &&
        source._parent === target &&
        source.id === event.actorId &&
        typeof event.sessionId === 'string' &&
        (source.sessionId === undefined ||
          source.sessionId === event.sessionId) &&
        target.getSnapshot().children?.[source.id] === source
      ) {
        return undefined;
      }
      return lifecycleOriginError(event.type, target.id);
    }
    case 'xstate.done.state':
    case 'xstate.error.execution':
      return lifecycleOriginError(event.type, target.id);
  }

  const runtimeTarget = target as AnyActor & {
    logic?: { isInternalEventType?: (eventType: string) => boolean };
  };

  if (
    source !== target &&
    runtimeTarget.logic?.isInternalEventType?.(event.type)
  ) {
    return new Error(
      isDevelopment
        ? `Internal event "${event.type}" cannot be sent to actor "${target.id}" from outside.`
        : xstateError(73, event.type, target.id)
    );
  }
  return undefined;
}

function lifecycleOriginError(eventType: string, targetId: string): Error {
  return new Error(
    isDevelopment
      ? `Lifecycle event "${eventType}" was not delivered to actor "${targetId}" because it did not originate from the runtime.`
      : xstateError(80, eventType, targetId)
  );
}

/**
 * Reports unauthorized internal or lifecycle events as dead letters.
 * Returns `true` when the event must not be delivered.
 */
export function rejectUndeliverableEvent(
  source: AnyActor | undefined,
  target: AnyActor,
  event: AnyEventObject,
  directDelivery = false
): boolean {
  const error = getEventBoundaryError(source, target, event, directDelivery);
  if (error) {
    void target.system.deadLetter(source, target, event, 'internalEvent', {
      error
    });
    return true;
  }
  return false;
}

/**
 * Publishes an actor's terminal result, notifying its parent and observers.
 * Custom runtimes use this for the default local behavior inside their own
 * `terminateActor` implementations.
 *
 * @experimental
 */
export function terminateActor(
  actor: AnyActor,
  termination: ActorTermination
): void {
  (
    actor as AnyActor & { _terminate(termination: ActorTermination): void }
  )._terminate(termination);
}

/**
 * Stops an actor without producing a completion result. Custom runtimes use
 * this for the default local behavior inside their own `stopActor`
 * implementations.
 *
 * @experimental
 */
export function stopActor(actor: AnyActor): void {
  (actor as AnyActor & { _stop(): void })._stop();
}
