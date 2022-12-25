import { Event, EventObject, RaiseActionObject } from '../types';
import * as actionTypes from '../actionTypes';
import { toSCXMLEvent } from '../utils';
import { createDynamicAction } from '../../actions/dynamicAction';
import { BaseDynamicActionObject } from '..';

/**
 * Raises an event. This places the event in the internal event queue, so that
 * the event is immediately consumed by the machine in the current step.
 *
 * @param eventType The event to raise.
 */

export function raise<TEvent extends EventObject>(
  event: Event<TEvent>
): BaseDynamicActionObject<
  any,
  TEvent,
  RaiseActionObject<TEvent>,
  RaiseActionObject<TEvent>['params']
> {
  return createDynamicAction(
    actionTypes.raise,
    { _event: toSCXMLEvent(event) },
    ({ params }, _event, { state }) => {
      return [
        state,
        {
          type: actionTypes.raise,
          params: {
            _event: params._event
          }
        }
      ];
    }
  );
}
