import { Event, EventObject, RaiseActionObject } from '../types';
import * as actionTypes from '../actionTypes';
import { toSCXMLEvent } from '../utils';
import { DynamicAction } from '../../actions/DynamicAction';

/**
 * Raises an event. This places the event in the internal event queue, so that
 * the event is immediately consumed by the machine in the current step.
 *
 * @param eventType The event to raise.
 */

export function raise<TEvent extends EventObject>(
  event: Event<TEvent>
): DynamicAction<
  any,
  TEvent,
  RaiseActionObject<TEvent>,
  RaiseActionObject<TEvent>['params']
> {
  return new DynamicAction(
    actionTypes.raise,
    { _event: toSCXMLEvent(event) },
    (action) => {
      return {
        type: actionTypes.raise,
        params: {
          _event: action.params._event
        }
      };
    }
  );
}
