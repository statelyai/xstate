import isDevelopment from '#is-development';
import {
  ActionArgs,
  AnyActorContext,
  AnyActorLogic,
  AnyActorRef,
  AnyState,
  EventObject,
  LogExpr,
  MachineContext,
  ParameterizedObject,
  ProvidedActor
} from '../types.ts';
import { SpawnOptions, Spawner, createSpawner } from '../spawn.ts';
import { cloneState } from '../State';

type ResolvableSpawnValue<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
> = string | LogExpr<TContext, TExpressionEvent, TExpressionAction, TEvent>;

function resolveSpawn(
  actorCtx: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any, any, any>,
  {
    src,
    options
  }: { src: string | AnyActorLogic; options?: SpawnOptions<any, any> }
) {
  // { value, label }: { value: unknown; label: string | undefined }
  const spawnedChildren: Record<string, AnyActorRef> = {};

  const spawner = createSpawner(
    actorCtx,
    state,
    actionArgs.event,
    spawnedChildren
  );

  spawner(src, options);

  return [
    cloneState(state, {
      children: Object.keys(spawnedChildren).length
        ? {
            ...state.children,
            ...spawnedChildren
          }
        : state.children
    })
  ];
}

export interface SpawnAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> {
  (_: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>): void;
  _out_TActor?: TActor;
}

/**
 *
 * @param expr The expression function to evaluate which will be logged.
 *  Takes in 2 arguments:
 *  - `ctx` - the current state context
 *  - `event` - the event that caused this action to be executed.
 * @param label The label to give to the logged expression.
 */
export function spawn<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
>(
  ...args: Parameters<Spawner<TActor>>
): SpawnAction<TContext, TExpressionEvent, TExpressionAction, TEvent, TActor> {
  function spawn(
    _: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  spawn.type = 'xstate.spawn';
  spawn.src = args[0];
  spawn.options = args[1];

  spawn.resolve = resolveSpawn;

  return spawn;
}
