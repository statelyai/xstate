import { createDynamicAction } from '../../actions/dynamicAction';
import { stop as stopActionType } from '../actionTypes';
import { ActorStatus } from '../interpreter';
import {
  ActorContext,
  ActorRef,
  BaseDynamicActionObject,
  DynamicStopActionObject,
  EventObject,
  Expr,
  MachineContext,
  StopActionObject
} from '../types';
import { isFunction } from '../utils';

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
          execute: (actorCtx: ActorContext<any, any>) => {
            if (!actorRef) {
              return;
            }
            if (actorRef.status !== ActorStatus.Running) {
              actorRef.stop?.();
              return;
            }
            actorCtx.defer(() => {
              actorRef.stop?.();
            });
          }
        } as StopActionObject
      ];
    }
  );
}
