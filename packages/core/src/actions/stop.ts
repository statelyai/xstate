import { createDynamicAction } from '../../actions/dynamicAction.js';
import { stop as stopActionType } from '../actionTypes.js';
import { ActorStatus } from '../interpreter.js';
import {
  ActorRef,
  AnyActorContext,
  BaseDynamicActionObject,
  DynamicStopActionObject,
  EventObject,
  Expr,
  MachineContext,
  StopActionObject
} from '../types.js';
import { isFunction } from '../utils.js';

/**
 * Stops an actor.
 *
 * @param actorRef The actor to stop.
 */

export function stop<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
>(
  actorRef:
    | string
    | ActorRef<any>
    | Expr<TContext, TExpressionEvent, ActorRef<any> | string>
): BaseDynamicActionObject<
  TContext,
  TExpressionEvent,
  TEvent,
  StopActionObject,
  DynamicStopActionObject<TContext, TExpressionEvent>['params']
> {
  const actor = actorRef;

  return createDynamicAction(
    {
      type: stopActionType,
      params: {
        actor
      }
    },
    (_event, { state }) => {
      const actorRefOrString = isFunction(actor)
        ? actor(state.context, _event.data)
        : actor;
      const actorRef =
        typeof actorRefOrString === 'string'
          ? state.children[actorRefOrString]
          : actorRefOrString;

      return [
        state,
        {
          type: 'xstate.stop',
          params: { actor: actorRef },
          execute: (actorCtx: AnyActorContext) => {
            if (!actorRef) {
              return;
            }
            if (actorRef.status !== ActorStatus.Running) {
              actorCtx.stop(actorRef);
              return;
            }
            actorCtx.defer(() => {
              actorCtx.stop(actorRef);
            });
          }
        } as StopActionObject
      ];
    }
  );
}
