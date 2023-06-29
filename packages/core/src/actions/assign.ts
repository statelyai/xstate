import type {
  EventObject,
  Assigner,
  PropertyAssigner,
  MachineContext,
  AssignActionObject,
  DynamicAssignAction,
  AssignArgs,
  InvokeActionObject,
  LowInfer
} from '../types.ts';
import * as actionTypes from '../actionTypes.ts';
import { createDynamicAction } from '../../actions/dynamicAction.ts';
import { isFunction } from '../utils.ts';
import { createSpawner } from '../spawn.ts';
import { cloneState } from '../State.ts';

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
    (event, { state, action, actorContext }) => {
      const capturedActions: InvokeActionObject[] = [];

      if (!state.context) {
        throw new Error(
          'Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.'
        );
      }

      const args: AssignArgs<TContext, TExpressionEvent, TEvent> = {
        context: state.context,
        event,
        action,
        spawn: createSpawner(
          actorContext?.self,
          state.machine,
          state.context,
          event,
          capturedActions
        ),
        self: actorContext?.self ?? ({} as any),
        system: actorContext?.system
      };

      let partialUpdate: Partial<TContext> = {};
      if (isFunction(assignment)) {
        partialUpdate = assignment(args);
      } else {
        for (const key of Object.keys(assignment)) {
          const propAssignment = assignment[key];
          partialUpdate[key as keyof TContext] = isFunction(propAssignment)
            ? propAssignment(args)
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
