import {
  XSTATE_LOGIC_EFFECT_REJECT,
  XSTATE_LOGIC_EFFECT_RESOLVE,
  XSTATE_LOGIC_EFFECT_START
} from './constants.ts';
import type { ActorTermination, AnyActor, AnyEventObject } from './types.ts';

type StepEffects = Record<
  string,
  | { status: 'active' }
  | { status: 'done'; output: unknown }
  | { status: 'error'; error: unknown }
>;

function getStepEffect(actor: AnyActor, key: string) {
  return (actor.getSnapshot() as { effects?: StepEffects }).effects?.[key];
}

function waitForStep<TStepOutput>(
  actor: AnyActor,
  key: string
): Promise<TStepOutput> {
  return new Promise((resolve, reject) => {
    const subscription = actor.subscribe((snapshot) => {
      const effect = (snapshot as { effects?: StepEffects }).effects?.[key];
      if (effect?.status === 'done') {
        subscription.unsubscribe();
        resolve(effect.output as TStepOutput);
      } else if (effect?.status === 'error') {
        subscription.unsubscribe();
        reject(effect.error as Error);
      }
    });
  });
}

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
  if (effect?.status === 'active') {
    return waitForStep(actor, key);
  }

  sendSelf({ type: XSTATE_LOGIC_EFFECT_START, key });
  try {
    const output = await exec();
    sendSelf({ type: XSTATE_LOGIC_EFFECT_RESOLVE, key, output });
    return output;
  } catch (error) {
    sendSelf({ type: XSTATE_LOGIC_EFFECT_REJECT, key, error });
    throw error;
  }
}

/**
 * Delivers an event directly to a target actor, bypassing any installed host
 * runtime. Custom runtimes use this for the default local delivery behavior
 * inside their own `sendEvent` implementations.
 *
 * @experimental
 */
export function deliverEvent(
  source: AnyActor | undefined,
  target: AnyActor,
  event: AnyEventObject
): void {
  if (rejectUndeliverableEvent(source, target, event)) {
    return;
  }
  const runtimeTarget = target as AnyActor & {
    _lastSourceRef?: AnyActor;
    _send(event: AnyEventObject): void;
  };

  runtimeTarget._lastSourceRef = source;
  runtimeTarget._send(event);
}

/**
 * Returns the boundary error preventing this delivery, if any: an internal
 * event type cannot cross an actor boundary from an external sender.
 */
export function getEventBoundaryError(
  source: AnyActor | undefined,
  target: AnyActor,
  event: AnyEventObject
): Error | undefined {
  const runtimeTarget = target as AnyActor & {
    logic?: { isInternalEventType?: (eventType: string) => boolean };
  };

  if (
    source !== target &&
    runtimeTarget.logic?.isInternalEventType?.(event.type)
  ) {
    return new Error(
      `Internal event "${event.type}" cannot be sent to actor "${target.id}" from outside.`
    );
  }
  return undefined;
}

/**
 * Rejects an event that must not cross the delivery boundary — an internal
 * event type sent from outside its owning actor — by reporting it as a dead
 * letter. Returns `true` when the event was rejected and must not be
 * delivered. Host runtimes must call this before taking ownership of
 * delivery.
 */
export function rejectUndeliverableEvent(
  source: AnyActor | undefined,
  target: AnyActor,
  event: AnyEventObject
): boolean {
  const error = getEventBoundaryError(source, target, event);
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
