import { XSTATE_INIT } from './constants.ts';
import {
  DoneInvokeEventObject,
  DoneStateEventObject,
  ErrorPlatformEvent
} from './types.ts';

/**
 * Returns an event that represents an implicit event that
 * is sent after the specified `delay`.
 *
 * @param delayRef The delay in milliseconds
 * @param id The state node ID where this event is handled
 */
export function createAfterEvent(delayRef: number | string, id?: string) {
  const idSuffix = id ? `#${id}` : '';
  return { type: `xstate.after(${delayRef})${idSuffix}` } as const;
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
): DoneStateEventObject {
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
export function createDoneInvokeEvent(
  invokeId: string,
  output?: unknown
): DoneInvokeEventObject {
  return {
    type: `done.invoke.${invokeId}`,
    output
  };
}

export function createErrorPlatformEvent(
  id: string,
  data?: unknown
): ErrorPlatformEvent {
  return { type: `error.platform.${id}`, data };
}

export function createInitEvent(input: unknown) {
  return { type: XSTATE_INIT, input } as const;
}
