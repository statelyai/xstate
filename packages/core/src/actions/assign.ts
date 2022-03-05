import type {
  EventObject,
  Assigner,
  PropertyAssigner,
  MachineContext,
  AssignActionObject,
  DynamicAssignAction,
  AssignMeta,
  InvokeActionObject
} from '../types';
import * as actionTypes from '../actionTypes';
import { createDynamicAction } from '../../actions/dynamicAction';
import { isFunction } from '../utils';
import { createSpawner } from '../spawn';

/**
 * Updates the current context of the machine.
 *
 * @param assignment An object that represents the partial context to update.
 */
export function assign<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject,
  TAssignment extends
    | Assigner<TContext, TEvent>
    | PropertyAssigner<TContext, TEvent> =
    | Assigner<TContext, TEvent>
    | PropertyAssigner<TContext, TEvent>
>(assignment: TAssignment): DynamicAssignAction<TContext, TEvent> {
  return createDynamicAction<
    TContext,
    TEvent,
    AssignActionObject<TContext>,
    {
      assignment: TAssignment;
    }
  >(
    actionTypes.assign,
    {
      assignment
    },
    (_, context, _event, { machine, state, action }) => {
      const capturedActions: InvokeActionObject[] = [];

      if (!context) {
        throw new Error(
          'Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.'
        );
      }

      const meta: AssignMeta<TContext, TEvent> = {
        state,
        action,
        _event,
        spawn: createSpawner(machine, context, _event, capturedActions)
      };

      let partialUpdate: Partial<TContext> = {};
      if (isFunction(assignment)) {
        partialUpdate = assignment(context, _event.data, meta);
      } else {
        for (const key of Object.keys(assignment)) {
          const propAssignment = assignment[key];
          partialUpdate[key as keyof TContext] = isFunction(propAssignment)
            ? propAssignment(context, _event.data, meta)
            : propAssignment;
        }
      }

      const updatedContext = Object.assign({}, context, partialUpdate);

      return {
        type: actionTypes.assign,
        params: {
          context: updatedContext,
          actions: capturedActions
        }
      } as AssignActionObject<TContext>;
    }
  );
}
