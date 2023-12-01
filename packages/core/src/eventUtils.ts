import { XSTATE_INIT } from './constants.ts';
import { DoneActorEvent, DoneStateEvent, ErrorActorEvent } from './types.ts';

/**
 * Returns an event that represents an implicit event that
 * is sent after the specified `delay`.
 *
 * @param delayRef The delay in milliseconds
 * @param id The state node ID where this event is handled
 */
export function createAfterEvent(delayRef: number | string, id: string) {
  return { type: `xstate.after.${delayRef}.${id}` } as const;
}

/**
 * Returns an event that represents that a final state node
 * has been reached in the parent state node.
 *
 * @param id The final state node's parent state node `id`
 * @param output The data to pass into the event
 */
export function createDoneStateEvent(
  id: string,
  output?: unknown
): DoneStateEvent {
  return {
    type: `xstate.done.state.${id}`,
    output
  };
}

/**
 * Returns an event that represents that an invoked service has terminated.
 *
 * An invoked service is terminated when it has reached a top-level final state node,
 * but not when it is canceled.
 *
 * @param invokeId The invoked service ID
 * @param output The data to pass into the event
 */
export function createDoneActorEvent(
  invokeId: string,
  output?: unknown
): DoneActorEvent {
  return {
    type: `xstate.done.actor.${invokeId}`,
    output
  };
}

export function createErrorActorEvent(
  id: string,
  error?: unknown
): ErrorActorEvent {
  return { type: `xstate.error.actor.${id}`, error };
}

export function createInitEvent(input: unknown) {
  return { type: XSTATE_INIT, input } as const;
}
