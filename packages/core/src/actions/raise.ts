import { Event, EventObject, SpecialTargets } from '../types';
import * as actionTypes from '../actionTypes';
import { isString, toSCXMLEvent } from '../utils';
import { send } from './send';

/**
 * Raises an event. This places the event in the internal event queue, so that
 * the event is immediately consumed by the machine in the current step.
 *
 * @param eventType The event to raise.
 */

export function raise<TEvent extends EventObject>(event: Event<TEvent>) {
  if (!isString(event)) {
    return send(event, { to: SpecialTargets.Internal });
  }

  return {
    type: actionTypes.raise,
    params: {
      event,
      _event: toSCXMLEvent(event)
    }
  };
}
