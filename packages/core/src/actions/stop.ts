import { EventObject, ActorRef, Expr, MachineContext } from '../types';
import { stop as stopActionType } from '../actionTypes';
import { isFunction } from '../utils';
import { createDynamicAction } from '../../actions/dynamicAction';
import {
  BaseDynamicActionObject,
  DynamicStopActionObject,
  StopActionObject
} from '..';

/**
 * Stops an actor.
 *
 * @param actorRef The actor to stop.
 */

export function stop<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  actorRef:
    | string
    | ActorRef<any>
    | Expr<TContext, TEvent, ActorRef<any> | string>
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
          execute2: (actorCtx) => {
            if (actorRef) {
              actorCtx.defer?.(() => {
                actorRef.stop?.();
              });
            }
          }
        } as StopActionObject
      ];
    }
  );
}
