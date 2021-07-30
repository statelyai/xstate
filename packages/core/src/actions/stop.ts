import {
  EventObject,
  ActionTypes,
  ActorRef,
  Expr,
  MachineContext
} from '../types';
import { stop as stopActionType } from '../actionTypes';
import { isFunction } from '../utils';
import { DynamicAction } from '../../actions/DynamicAction';

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

  const stopAction = new DynamicAction(stopActionType, {
    actor
  });

  stopAction.resolve = function (context, _event) {
    const actorRefOrString = isFunction(this.params.actor)
      ? this.params.actor(context, _event.data)
      : this.params.actor;

    const actionObject = {
      type: this.type,
      params: { actor: actorRefOrString }
    };

    return actionObject;
  };

  return stopAction;
}
