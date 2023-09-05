import isDevelopment from '#is-development';
import { cloneState } from '../State.ts';
import { createSpawner } from '../spawn.ts';
import type {
  ActionArgs,
  AnyActorContext,
  AnyActorRef,
  AnyState,
  AssignArgs,
  Assigner,
  EventObject,
  LowInfer,
  MachineContext,
  ParameterizedObject,
  PropertyAssigner
} from '../types.ts';

function resolve(
  actorContext: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any, any>,
  {
    assignment
  }: {
    assignment: Assigner<any, any, any> | PropertyAssigner<any, any, any>;
  }
) {
  if (!state.context) {
    throw new Error(
      'Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.'
    );
  }
  const spawnedChildren: Record<string, AnyActorRef> = {};

  const assignArgs: AssignArgs<any, any, any> = {
    context: state.context,
    event: actionArgs.event,
    action: actionArgs.action,
    spawn: createSpawner(
      actorContext,
      state,
      actionArgs.event,
      spawnedChildren
    ),
    self: actorContext?.self,
    system: actorContext?.system
  };
  let partialUpdate: Record<string, unknown> = {};
  if (typeof assignment === 'function') {
    partialUpdate = assignment(assignArgs);
  } else {
    for (const key of Object.keys(assignment)) {
      const propAssignment = assignment[key];
      partialUpdate[key] =
        typeof propAssignment === 'function'
          ? propAssignment(assignArgs)
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
    })
  ];
}

/**
 * Updates the current context of the machine.
 *
 * @param assignment An object that represents the partial context to update.
 */
export function assign<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject = EventObject,
  TExpressionAction extends ParameterizedObject | undefined =
    | ParameterizedObject
    | undefined
>(
  assignment:
    | Assigner<LowInfer<TContext>, TExpressionEvent, TExpressionAction>
    | PropertyAssigner<LowInfer<TContext>, TExpressionEvent, TExpressionAction>
) {
  function assign(
    _: ActionArgs<TContext, TExpressionEvent, TExpressionAction>
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  assign.type = 'xstate.assign';
  assign.assignment = assignment;

  assign.resolve = resolve;

  return assign;
}
