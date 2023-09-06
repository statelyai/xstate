import {
  ConstantPrefix,
  DoneEvent,
  ErrorPlatformEvent,
  DoneEventObject
} from './types.ts';
import * as constantPrefixes from './constantPrefixes.ts';
import { XSTATE_INIT } from './constants.ts';
export { sendTo, sendParent, forwardTo, escalate } from './actions/send.ts';

export { stop } from './actions/stop.ts';
export { log } from './actions/log.ts';
export { cancel } from './actions/cancel.ts';
export { assign } from './actions/assign.ts';
export { raise } from './actions/raise.ts';
export { choose } from './actions/choose.ts';
export { pure } from './actions/pure.ts';
export { constantPrefixes };

/**
 * Returns an event type that represents an implicit event that
 * is sent after the specified `delay`.
 *
 * @param delayRef The delay in milliseconds
 * @param id The state node ID where this event is handled
 */
export function after(delayRef: number | string, id?: string) {
  const idSuffix = id ? `#${id}` : '';
  return `${ConstantPrefix.After}(${delayRef})${idSuffix}`;
}

/**
 * Returns an event that represents that a final state node
 * has been reached in the parent state node.
 *
 * @param id The final state node's parent state node `id`
 * @param output The data to pass into the event
 */
export function done(id: string, output?: any): DoneEventObject {
  const type = `${ConstantPrefix.DoneState}.${id}`;
  const eventObject = {
    type,
    output
  };

  eventObject.toString = () => type;

  return eventObject as DoneEvent;
}

export function doneInvokeEventType<T extends string = string>(invokeId: T) {
  return `${ConstantPrefix.DoneInvoke}.${invokeId}` as const;
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
export function doneInvoke(invokeId: string, output?: any): DoneEvent {
  const type = doneInvokeEventType(invokeId);
  const eventObject = {
    type,
    output
  };

  eventObject.toString = () => type;

  return eventObject as DoneEvent;
}

export function errorEventType<T extends string = string>(id: T) {
  return `${ConstantPrefix.ErrorPlatform}.${id}` as const;
}

export function error(id: string, data?: any): ErrorPlatformEvent & string {
  const type = errorEventType(id);
  const eventObject = { type, data };

  eventObject.toString = () => type;

  return eventObject as ErrorPlatformEvent & string;
}

export function createInitEvent(input: unknown) {
  return { type: XSTATE_INIT, input } as const;
}
