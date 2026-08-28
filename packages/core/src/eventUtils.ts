import { XSTATE_INIT } from './constants.ts';
import {
  ActorTimeoutEvent,
  DoneActorEvent,
  DoneStateEvent,
  ErrorActorEvent,
  ErrorPlatformEvent
} from './types.ts';

/**
 * Returns an event that represents an implicit invoke-level timeout. Fired when
 * an invoked actor has not completed within its `timeout` duration.
 *
 * @param invokeId The invoked actor's ID
 */
export function createInvokeTimeoutEvent(
  invokeId: string,
  sessionId?: string
): ActorTimeoutEvent {
  return {
    type: 'xstate.timeout.actor',
    actorId: invokeId,
    sessionId
  };
}

export function createInvokeTimeoutEventId(invokeId: string) {
  return `xstate.timeout.actor.${invokeId}`;
}

/**
 * Returns an event that represents that a final state node has been reached in
 * the parent state node.
 *
 * @param id The final state node's parent state node `id`
 * @param output The data to pass into the event
 */
export function createDoneStateEvent(
  id: string,
  output?: unknown
): DoneStateEvent {
  return {
    type: 'xstate.done.state',
    stateId: id,
    output
  };
}

/**
 * Returns an event that represents that an invoked service has terminated.
 *
 * An invoked service is terminated when it has reached a top-level final state
 * node, but not when it is canceled.
 *
 * @param invokeId The invoked service ID
 * @param output The data to pass into the event
 * @param sessionId The unique session ID of the completed actor
 */
export function createDoneActorEvent(
  invokeId: string,
  output: unknown,
  sessionId: string
): DoneActorEvent {
  return {
    type: 'xstate.done.actor',
    output,
    actorId: invokeId,
    sessionId
  };
}

export function createErrorActorEvent(
  id: string,
  error: unknown,
  sessionId: string
): ErrorActorEvent {
  return {
    type: 'xstate.error.actor',
    error,
    actorId: id,
    sessionId
  };
}

export function createErrorPlatformEvent(
  kind: string,
  error?: unknown
): ErrorPlatformEvent {
  return { type: `xstate.error.${kind}`, error };
}

export function createInitEvent(input: unknown) {
  return { type: XSTATE_INIT, input } as const;
}
