import { XSTATE_INIT } from './constants.ts';
import {
  DoneInvokeEventObject,
  DoneStateEventObject,
  ErrorPlatformEvent
} from './types.ts';
import * as constantPrefixes from './constantPrefixes.ts';

/**
 * Returns an event type that represents an implicit event that
 * is sent after the specified `delay`.
 *
 * @param delayRef The delay in milliseconds
 * @param id The state node ID where this event is handled
 */
export function after(delayRef: number | string, id?: string) {
  const idSuffix = id ? `#${id}` : '';
  return `${constantPrefixes.after}(${delayRef})${idSuffix}`;
}

export function doneStateEventType<T extends string = string>(id: T) {
  return `${constantPrefixes.doneState}.${id}` as const;
}

/**
 * Returns an event that represents that a final state node
 * has been reached in the parent state node.
 *
 * @param id The final state node's parent state node `id`
 * @param output The data to pass into the event
 */
export function doneState(id: string, output?: unknown): DoneStateEventObject {
  return {
    type: doneStateEventType(id),
    output
  };
}

export function doneInvokeEventType<T extends string = string>(invokeId: T) {
  return `${constantPrefixes.doneInvoke}.${invokeId}` as const;
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
export function doneInvoke(
  invokeId: string,
  output?: unknown
): DoneInvokeEventObject {
  return {
    type: doneInvokeEventType(invokeId),
    output
  };
}

export function errorEventType<T extends string = string>(id: T) {
  return `${constantPrefixes.errorPlatform}.${id}` as const;
}

export function error(id: string, data?: unknown): ErrorPlatformEvent {
  return { type: errorEventType(id), data };
}

export function createInitEvent(input: unknown) {
  return { type: XSTATE_INIT, input } as const;
}
