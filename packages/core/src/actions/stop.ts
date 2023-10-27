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
  ParameterizedObject
} from '../types.ts';

type ResolvableActorRef<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject
> =
  | string
  | ActorRef<any, any>
  | ((
      args: ActionArgs<TContext, TExpressionEvent, TEvent>,
      params: TParams
    ) => ActorRef<any, any> | string);

function resolveStop(
  _: AnyActorContext,
  state: AnyState,
  args: ActionArgs<any, any, any>,
  actionParams: ParameterizedObject['params'] | undefined,
  { actorRef }: { actorRef: ResolvableActorRef<any, any, any, any> }
) {
  const actorRefOrString =
    typeof actorRef === 'function' ? actorRef(args, actionParams) : actorRef;
  const resolvedActorRef: ActorRef<any, any> | undefined =
    typeof actorRefOrString === 'string'
      ? state.children[actorRefOrString]
      : actorRefOrString;

  let children = state.children;
  if (resolvedActorRef) {
    children = { ...children };
    delete children[resolvedActorRef.id];
  }
  return [
    cloneState(state, {
      children
    }),
    resolvedActorRef
  ];
}
function executeStop(
  actorContext: AnyActorContext,
  actorRef: ActorRef<any, any> | undefined
) {
  if (!actorRef) {
    return;
  }
  // this allows us to prevent an actor from being started if it gets stopped within the same macrostep
  // this can happen, for example, when the invoking state is being exited immediately by an always transition
  if (actorRef.status !== ActorStatus.Running) {
    actorContext.stopChild(actorRef);
    return;
  }
  // stopping a child enqueues a stop event in the child actor's mailbox
  // we need for all of the already enqueued events to be processed before we stop the child
  // the parent itself might want to send some events to a child (for example from exit actions on the invoking state)
  // and we don't want to ignore those events
  actorContext.defer(() => {
    actorContext.stopChild(actorRef);
  });
}

export interface StopAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject
> {
  (args: ActionArgs<TContext, TExpressionEvent, TEvent>, params: TParams): void;
}

/**
 * Stops an actor.
 *
 * @param actorRef The actor to stop.
 */
export function stop<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject
>(
  actorRef: ResolvableActorRef<TContext, TExpressionEvent, TParams, TEvent>
): StopAction<TContext, TExpressionEvent, TParams, TEvent> {
  function stop(
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: TParams
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
