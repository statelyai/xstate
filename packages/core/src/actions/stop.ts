import { EventObject, ActorRef, Expr, MachineContext } from '../types';
import { stop as stopActionType } from '../actionTypes';
import { isFunction } from '../utils';
import { DynamicAction } from '../../actions/DynamicAction';
import { StopActionObject } from '..';

/**
 * Stops an actor.
 *
 * @param actorRef The activity to stop.
 */

export function stop<
  TContext extends MachineContext,
  TEvent extends EventObject
>(actorRef: string | Expr<TContext, TEvent, ActorRef<any>>) {
  const actor = isFunction(actorRef) ? actorRef : actorRef;

  const stopAction = new DynamicAction<TContext, TEvent, StopActionObject>(
    stopActionType,
    {
      actor
    },
    (action, context, _event) => {
      const actorRefOrString = isFunction(action.params.actor)
        ? action.params.actor(context, _event.data)
        : action.params.actor;

      return {
        type: action.type,
        params: { actor: actorRefOrString }
      } as StopActionObject;
    }
  );

  return stopAction;
}
