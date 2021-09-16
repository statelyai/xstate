import type {
  EventObject,
  Assigner,
  PropertyAssigner,
  MachineContext,
  AssignActionObject,
  DynamicAssignAction,
  RaiseActionObject
} from '../types';
import * as actionTypes from '../actionTypes';
import { DynamicAction } from '../../actions/DynamicAction';
import { updateContext } from '../updateContext';
import { toSCXMLEvent } from '../utils';

/**
 * Updates the current context of the machine.
 *
 * @param assignment An object that represents the partial context to update.
 */
export function assign<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject
>(
  assignment: Assigner<TContext, TEvent> | PropertyAssigner<TContext, TEvent>
): DynamicAssignAction<TContext, TEvent> {
  return new DynamicAction<
    TContext,
    TEvent,
    AssignActionObject<TContext> | RaiseActionObject<TEvent>
  >(
    actionTypes.assign,
    {
      assignment
    },
    (action, context, _event, { state }) => {
      const [nextContext, nextActions] = updateContext(
        context,
        _event,
        [action],
        state
      );

      return {
        type: action.type,
        params: {
          context: nextContext,
          actions: nextActions
        }
      } as AssignActionObject<TContext>;
    }
  );
}
