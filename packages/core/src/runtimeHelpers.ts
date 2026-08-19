import type { ActorTermination, AnyActor, AnyEventObject } from './types.ts';

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
  const runtimeTarget = target as AnyActor & {
    logic?: { isInternalEventType?: (eventType: string) => boolean };
    _lastSourceRef?: AnyActor;
    _send(event: AnyEventObject): void;
  };
  // The same guard local delivery has always applied: internal events may
  // only originate from the actor itself, whichever runtime delivers them.
  if (
    source !== target &&
    runtimeTarget.logic?.isInternalEventType?.(event.type)
  ) {
    throw new Error(
      `Internal event "${event.type}" cannot be sent to actor "${target.id}" from outside.`
    );
  }
  runtimeTarget._lastSourceRef = source;
  runtimeTarget._send(event);
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
