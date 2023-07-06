import { cloneState } from '../State.ts';
import { createSpawner } from '../spawn.ts';
import type {
  AnyActorContext,
  AnyActorRef,
  AnyState,
  AssignArgs,
  Assigner,
  EventObject,
  LowInfer,
  MachineContext,
  PropertyAssigner,
  UnifiedArg
} from '../types.ts';
import { BuiltinAction } from './_shared.ts';

class AssignResolver<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> extends BuiltinAction<TContext, TExpressionEvent, TEvent> {
  static assignment: Assigner<any, any> | PropertyAssigner<any, any>;
  static resolve(
    actorContext: AnyActorContext,
    state: AnyState,
    args: UnifiedArg<any, any>
  ) {
    if (!state.context) {
      throw new Error(
        'Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.'
      );
    }
    const { assignment } = this;
    const spawnedChildren: Record<string, AnyActorRef> = {};

    const assignArgs: AssignArgs<any, any> = {
      context: state.context,
      event: args.event,
      action: null as any, // TODO
      spawn: createSpawner(actorContext, state, args.event, spawnedChildren),
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
}

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
) {
  return class Assign extends AssignResolver<
    TContext,
    TExpressionEvent,
    TEvent
  > {
    static assignment = assignment;
  };
}
