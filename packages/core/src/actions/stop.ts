import { EventObject, ActorRef, Expr, MachineContext } from '../types';
import { stop as stopActionType } from '../actionTypes';
import { isFunction } from '../utils';
import { DynamicAction } from '../../actions/DynamicAction';
import {
  BaseDynamicActionObject,
  DynamicStopActionObject,
  StopActionObject
} from '..';

/**
 * Stops an actor.
 *
 * @param actorRef The activity to stop.
 */

export function stop<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  actorRef: string | Expr<TContext, TEvent, ActorRef<any>>
): BaseDynamicActionObject<
  TContext,
  TEvent,
  StopActionObject,
  DynamicStopActionObject<TContext, TEvent>['params']
> {
  const actor = actorRef;

  return new DynamicAction(
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
}
