import { cloneState } from '../State.ts';
import { ActorStatus } from '../interpreter.ts';
import {
  ActorRef,
  AnyActorContext,
  AnyState,
  EventObject,
  MachineContext,
  UnifiedArg
} from '../types.ts';
import { BuiltinAction } from './_shared.ts';

type ResolvableActorRef<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
> =
  | string
  | ActorRef<any>
  | ((args: UnifiedArg<TContext, TExpressionEvent>) => ActorRef<any> | string);

class StopResolver<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> extends BuiltinAction<TContext, TExpressionEvent, TEvent> {
  static actorRef: ResolvableActorRef<any, any>;
  static resolve(
    _: AnyActorContext,
    state: AnyState,
    args: UnifiedArg<any, any>
  ) {
    const { actorRef } = this;

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
  static execute(
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
}

/**
 * Stops an actor.
 *
 * @param actorRef The actor to stop.
 */

export function stop<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
>(actorRef: ResolvableActorRef<TContext, TExpressionEvent>) {
  return class Stop extends StopResolver<TContext, TExpressionEvent, TEvent> {
    static actorRef = actorRef;
  };
}
