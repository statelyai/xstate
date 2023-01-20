import { EventObject, RaiseActionObject } from '../types.js';
import * as actionTypes from '../actionTypes.js';
import { toSCXMLEvent } from '../utils.js';
import { createDynamicAction } from '../../actions/dynamicAction.js';
import { BaseDynamicActionObject } from '../index.js';

/**
 * Raises an event. This places the event in the internal event queue, so that
 * the event is immediately consumed by the machine in the current step.
 *
 * @param eventType The event to raise.
 */

export function raise<TEvent extends EventObject>(
  event: TEvent
): BaseDynamicActionObject<
  any,
  TEvent,
  RaiseActionObject<TEvent>,
  RaiseActionObject<TEvent>['params']
> {
  return createDynamicAction(
    { type: actionTypes.raise, params: { _event: toSCXMLEvent(event) } },
    (_event, { state }) => {
      return [
        state,
        {
          type: actionTypes.raise,
          params: {
            _event: toSCXMLEvent(event)
          }
        }
      ];
    }
  );
}
