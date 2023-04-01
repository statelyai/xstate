import type {
  EventObject,
  Assigner,
  PropertyAssigner,
  MachineContext,
  AssignActionObject,
  DynamicAssignAction,
  AssignMeta,
  InvokeActionObject,
  LowInfer
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
  TExpressionEvent extends EventObject = EventObject,
  TEvent extends EventObject = TExpressionEvent
>(
  assignment:
    | Assigner<LowInfer<TContext>, TExpressionEvent, TEvent>
    | PropertyAssigner<LowInfer<TContext>, TExpressionEvent, TEvent>
): DynamicAssignAction<TContext, TExpressionEvent, TEvent> {
  return createDynamicAction<
    TContext,
    TExpressionEvent,
    TEvent,
    AssignActionObject<TContext>,
    {
      assignment: typeof assignment;
    }
  >(
    {
      type: actionTypes.assign,
      params: {
        assignment
      }
    },
    (_event, { state, action, actorContext }) => {
      const capturedActions: InvokeActionObject[] = [];

      if (!state.context) {
        throw new Error(
          'Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.'
        );
      }

      const meta: AssignMeta<TContext, TExpressionEvent, TEvent> = {
        state: state as any,
        action,
        _event,
        spawn: createSpawner(
          actorContext?.self,
          state.machine,
          state.context,
          _event,
          capturedActions
        ),
        self: actorContext?.self ?? ({} as any),
        system: actorContext?.system
      };

      let partialUpdate: Partial<TContext> = {};
      if (isFunction(assignment)) {
        partialUpdate = assignment({
          context: state.context,
          event: _event.data,
          meta
        });
      } else {
        for (const key of Object.keys(assignment)) {
          const propAssignment = assignment[key];
          partialUpdate[key as keyof TContext] = isFunction(propAssignment)
            ? propAssignment({
                context: state.context,
                event: _event.data,
                meta
              })
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
