import { EventObject, ActorRef, Expr, MachineContext } from '../types';
import { stop as stopActionType } from '../actionTypes';
import { isFunction } from '../utils';
import { createDynamicAction } from '../../actions/dynamicAction';
import type {
  BaseDynamicActionObject,
  DynamicStopActionObject,
  StopActionObject
} from '../types';

/**
 * Stops an actor.
 *
 * @param actorRef The actor to stop.
 */

export function stop<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  actorRef: string | Expr<TContext, TEvent, ActorRef<any> | string>
): BaseDynamicActionObject<
  TContext,
  TEvent,
  StopActionObject,
  DynamicStopActionObject<TContext, TEvent>['params']
> {
  const actor = actorRef;

  return createDynamicAction(
    stopActionType,
    {
      actor
    },
    ({ params, type }, context, _event, { state }) => {
      const resolved = isFunction(params.actor)
        ? params.actor(context, _event.data)
        : params.actor;
      const actorRef =
        typeof resolved === 'string' ? state.children[resolved] : resolved;

      return {
        type,
        params: { actor: actorRef }
      } as StopActionObject;
    }
  );
}
