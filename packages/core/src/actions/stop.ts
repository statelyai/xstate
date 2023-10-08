import isDevelopment from '#is-development';
import { cloneState } from '../State.ts';
import { ActorStatus } from '../interpreter.ts';
import {
  ActionArgs,
  ActorRef,
  AnyActorContext,
  AnyState,
  EventObject,
  MachineContext,
  ParameterizedObject,
  SingleOrArray
} from '../types.ts';
import { toArray } from '../utils.ts';

type ResolvableActorRef<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
> =
  | SingleOrArray<string | ActorRef<any, any>>
  | ((
      args: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
    ) => SingleOrArray<ActorRef<any, any> | string>);

function resolveStop(
  _: AnyActorContext,
  state: AnyState,
  args: ActionArgs<any, any, any, any>,
  { actorRefs }: { actorRefs: ResolvableActorRef<any, any, any, any> }
) {
  const actorRefsOrStrings =
    typeof actorRefs === 'function'
      ? toArray(actorRefs(args))
      : toArray(actorRefs);
  const resolvedActorRefs: Array<ActorRef<any, any> | undefined> =
    actorRefsOrStrings.map((actorRefOrString) => {
      return typeof actorRefOrString === 'string'
        ? state.children[actorRefOrString]
        : actorRefOrString;
    });

  let children = state.children;
  for (const resolvedActorRef of resolvedActorRefs) {
    if (resolvedActorRef) {
      children = { ...children };
      delete children[resolvedActorRef.id];
    }
  }

  return [
    cloneState(state, {
      children
    }),
    resolvedActorRefs
  ];
}
function executeStop(
  actorContext: AnyActorContext,
  actorRef: ActorRef<any, any> | undefined
) {
  if (!actorRef) {
    return;
  }
  if (actorRef.status !== ActorStatus.Running) {
    actorContext.stopChild(actorRef);
    return;
  }
  // TODO: recheck why this one has to be deferred
  actorContext.defer(() => {
    actorContext.stopChild(actorRef);
  });
}

export interface StopAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
> {
  (_: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>): void;
}

/**
 * Stops an actor.
 *
 * @param actorRef The actor to stop.
 */
export function stop<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
>(
  actorRef: ResolvableActorRef<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TEvent
  >
): StopAction<TContext, TExpressionEvent, TExpressionAction, TEvent> {
  function stop(
    _: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  stop.type = 'xstate.stop';
  stop.actorRef = actorRef;

  stop.resolve = resolveStop;
  stop.execute = executeStop;

  return stop;
}
