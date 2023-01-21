import type {
  EventObject,
  Assigner,
  PropertyAssigner,
  MachineContext,
  AssignActionObject,
  DynamicAssignAction,
  AssignMeta,
  InvokeActionObject
} from '../types.js';
import * as actionTypes from '../actionTypes.js';
import { createDynamicAction } from '../../actions/dynamicAction.js';
import { isFunction } from '../utils.js';
import { createSpawner } from '../spawn.js';
import { cloneState } from '../State.js';

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
    {
      type: actionTypes.assign,
      params: {
        assignment
      }
    },
    (_event, { state, action }) => {
      const capturedActions: InvokeActionObject[] = [];

      if (!state.context) {
        throw new Error(
          'Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.'
        );
      }

      const meta: AssignMeta<TContext, TEvent> = {
        state,
        action,
        _event,
        spawn: createSpawner(
          state.machine,
          state.context,
          _event,
          capturedActions
        )
      };

      let partialUpdate: Partial<TContext> = {};
      if (isFunction(assignment)) {
        partialUpdate = assignment(state.context, _event.data, meta);
      } else {
        for (const key of Object.keys(assignment)) {
          const propAssignment = assignment[key];
          partialUpdate[key as keyof TContext] = isFunction(propAssignment)
            ? propAssignment(state.context, _event.data, meta)
            : propAssignment;
        }
      }

      const updatedContext = Object.assign({}, state.context, partialUpdate);

      return [
        cloneState(state, {
          context: updatedContext
        }),
        {
          type: actionTypes.assign,
          params: {
            context: updatedContext,
            actions: capturedActions
          }
        } as AssignActionObject<TContext>
      ];
    }
  );
}
