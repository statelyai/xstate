import isDevelopment from '#is-development';
import { cloneMachineSnapshot } from '../State.ts';
import { executingCustomAction } from '../createActor.ts';
import { Spawner, createSpawner } from '../spawn.ts';
import type {
  ActionArgs,
  AnyActorScope,
  AnyActorRef,
  AnyEventObject,
  AnyMachineSnapshot,
  Assigner,
  EventObject,
  LowInfer,
  MachineContext,
  ParameterizedObject,
  PropertyAssigner,
  ProvidedActor,
  ActionFunction
} from '../types.ts';

export interface AssignArgs<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> extends ActionArgs<TContext, TExpressionEvent, TEvent> {
  spawn: Spawner<TActor>;
}

function resolveAssign(
  actorScope: AnyActorScope,
  snapshot: AnyMachineSnapshot,
  actionArgs: ActionArgs<any, any, any>,
  actionParams: ParameterizedObject['params'] | undefined,
  {
    assignment
  }: {
    assignment:
      | Assigner<any, any, any, any, any>
      | PropertyAssigner<any, any, any, any, any>;
  }
) {
  if (!snapshot.context) {
    throw new Error(
      'Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.'
    );
  }
  const spawnedChildren: Record<string, AnyActorRef> = {};

  const assignArgs: AssignArgs<any, any, any, any> = {
    context: snapshot.context,
    event: actionArgs.event,
    spawn: createSpawner(
      actorScope,
      snapshot,
      actionArgs.event,
      spawnedChildren
    ),
    self: actorScope.self,
    system: actorScope.system
  };
  let partialUpdate: Record<string, unknown> = {};
  if (typeof assignment === 'function') {
    partialUpdate = assignment(assignArgs, actionParams);
  } else {
    for (const key of Object.keys(assignment)) {
      const propAssignment = assignment[key];
      partialUpdate[key] =
        typeof propAssignment === 'function'
          ? propAssignment(assignArgs, actionParams)
          : propAssignment;
    }
  }

  const updatedContext = Object.assign({}, snapshot.context, partialUpdate);

  return [
    cloneMachineSnapshot(snapshot, {
      context: updatedContext,
      children: Object.keys(spawnedChildren).length
        ? {
            ...snapshot.children,
            ...spawnedChildren
          }
        : snapshot.children
    })
  ];
}

export interface AssignAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> {
  (args: ActionArgs<TContext, TExpressionEvent, TEvent>, params: TParams): void;
  _out_TActor?: TActor;
}

/**
 * Updates the current context of the machine.
 *
 * @example
 *
 * ```ts
 * import { createMachine, assign } from 'xstate';
 *
 * const countMachine = createMachine({
 *   context: {
 *     count: 0,
 *     message: ''
 *   },
 *   on: {
 *     inc: {
 *       actions: assign({
 *         count: ({ context }) => context.count + 1
 *       })
 *     },
 *     updateMessage: {
 *       actions: assign(({ context, event }) => {
 *         return {
 *           message: event.message.trim()
 *         };
 *       })
 *     }
 *   }
 * });
 * ```
 *
 * @param assignment An object that represents the partial context to update, or
 *   a function that returns an object that represents the partial context to
 *   update.
 */
export function assign<
  TContext extends MachineContext,
  TExpressionEvent extends AnyEventObject, // TODO: consider using a stricter `EventObject` here
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
>(
  assignment:
    | Assigner<LowInfer<TContext>, TExpressionEvent, TParams, TEvent, TActor>
    | PropertyAssigner<
        LowInfer<TContext>,
        TExpressionEvent,
        TParams,
        TEvent,
        TActor
      >
): ActionFunction<
  TContext,
  TExpressionEvent,
  TEvent,
  TParams,
  TActor,
  never,
  never,
  never,
  never
> {
  if (isDevelopment && executingCustomAction) {
    console.warn(
      'Custom actions should not call `assign()` directly, as it is not imperative. See https://stately.ai/docs/actions#built-in-actions for more details.'
    );
  }

  function assign(
    _args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    _params: TParams
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  assign.type = 'xstate.assign';
  assign.assignment = assignment;

  assign.resolve = resolveAssign;

  assign.toJSON = () => ({
    ...assign
  });

  return assign;
}
