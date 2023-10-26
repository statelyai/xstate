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
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
> =
  | string
  | ActorRef<any, any>
  | ((
      args: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
    ) => ActorRef<any, any> | string);

function resolveStop(
  _: AnyActorContext,
  state: AnyState,
  args: ActionArgs<any, any, any, any>,
  { actorRef }: { actorRef: ResolvableActorRef<any, any, any, any> }
) {
  const actorRefOrString =
    typeof actorRef === 'function' ? actorRef(args) : actorRef;
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

  // we need to eagerly unregister it here so a new actor with the same systemId can be registered immediately
  // since we defer actual stopping of the actor but we don't defer actor creations (and we can't do that)
  // this could throw on `systemId` collision, for example, when dealing with reentering transitions
  actorContext.system._unregister(actorRef);

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
