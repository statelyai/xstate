import { createDynamicAction } from '../../actions/dynamicAction.ts';
import { cloneState } from '../State.ts';
import { stop as stopActionType } from '../actionTypes.ts';
import { ActorStatus } from '../interpreter.ts';
import {
  ActorRef,
  AnyActorContext,
  BaseDynamicActionObject,
  DynamicStopActionObject,
  EventObject,
  Expr,
  MachineContext,
  StopActionObject
} from '../types.ts';
import { isFunction } from '../utils.ts';

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
    (event, { state }) => {
      const actorRefOrString = isFunction(actor)
        ? actor({ context: state.context, event })
        : actor;
      const actorRef =
        typeof actorRefOrString === 'string'
          ? state.children[actorRefOrString]
          : actorRefOrString;

      let children = state.children;
      if (actorRef) {
        children = { ...children };
        delete children[actorRef.id];
      }

      return [
        cloneState(state, {
          children
        }),
        {
          type: 'xstate.stop',
          params: { actor: actorRef },
          execute: (actorCtx: AnyActorContext) => {
            if (!actorRef) {
              return;
            }
            if (actorRef.status !== ActorStatus.Running) {
              actorCtx.stopChild(actorRef);
              return;
            }
            actorCtx.defer(() => {
              actorCtx.stopChild(actorRef);
            });
          }
        } as StopActionObject
      ];
    }
  );
}
