import { createDynamicAction } from '../../actions/dynamicAction.ts';
import { cloneState } from '../State.ts';
import * as actionTypes from '../actionTypes.ts';
import { createSpawner } from '../spawn.ts';
import type {
  AnyActorRef,
  AssignActionObject,
  AssignArgs,
  Assigner,
  DynamicAssignAction,
  EventObject,
  LowInfer,
  MachineContext,
  PropertyAssigner
} from '../types.ts';
import { isFunction } from '../utils.ts';

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
    | Assigner<LowInfer<TContext>, TExpressionEvent>
    | PropertyAssigner<LowInfer<TContext>, TExpressionEvent>
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
      if (!state.context) {
        throw new Error(
          'Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.'
        );
      }

      const spawnedChildren: Record<string, AnyActorRef> = {};

      const args: AssignArgs<TContext, TExpressionEvent> = {
        context: state.context,
        event,
        action,
        spawn: createSpawner(actorContext, state, event, spawnedChildren),
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
          context: updatedContext,
          children: Object.keys(spawnedChildren).length
            ? {
                ...state.children,
                ...spawnedChildren
              }
            : state.children
        }),
        {
          type: actionTypes.assign,
          params: {
            context: updatedContext
          }
        } as AssignActionObject<TContext>
      ];
    }
  );
}
