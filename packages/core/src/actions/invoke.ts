import { EventObject, InvokeDefinition, MachineContext } from '../types.js';
import { invoke as invokeActionType } from '../actionTypes.js';
import { isActorRef } from '../actors/index.js';
import { createDynamicAction } from '../../actions/dynamicAction.js';
import {
  AnyInterpreter,
  BaseDynamicActionObject,
  DynamicInvokeActionObject,
  InvokeActionObject,
  InvokeSourceDefinition
} from '../index.js';
import { actionTypes, error } from '../actions.js';
import { mapContext, warn } from '../utils.js';
import { ActorStatus, interpret } from '../interpreter.js';
import { cloneState } from '../State.js';
import { IS_PRODUCTION } from '../environment.js';

export function invoke<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
>(
  invokeDef: InvokeDefinition<TContext, TEvent>
): BaseDynamicActionObject<
  TContext,
  TExpressionEvent,
  TEvent,
  InvokeActionObject,
  DynamicInvokeActionObject<TContext, TEvent>['params']
> {
  return createDynamicAction(
    { type: invokeActionType, params: invokeDef },
    (_event, { state, actorContext }) => {
      const type = actionTypes.invoke;
      const { id, data, src, meta, input } = invokeDef;

      let resolvedInvokeAction: InvokeActionObject;
      if (isActorRef(src)) {
        resolvedInvokeAction = {
          type,
          params: {
            ...invokeDef,
            ref: src
          }
        } as InvokeActionObject;
      } else {
        const behaviorImpl = state.machine.options.actors[src.type];

        if (!behaviorImpl) {
          resolvedInvokeAction = {
            type,
            params: invokeDef
          } as InvokeActionObject;
        } else {
          const behavior =
            typeof behaviorImpl === 'function'
              ? behaviorImpl(state.context, _event.data, {
                  id,
                  data: data && mapContext(data, state.context, _event as any),
                  src,
                  _event,
                  meta,
                  input
                })
              : behaviorImpl;

          const ref = interpret(behavior, {
            id,
            src,
            parent: actorContext?.self,
            input
          });

          resolvedInvokeAction = {
            type,
            params: {
              ...invokeDef,
              ref
            }
          } as InvokeActionObject;
        }
      }

      const actorRef = resolvedInvokeAction.params.ref!;
      const invokedState = cloneState(state, {
        children: {
          ...state.children,
          [id]: actorRef
        }
      });

      resolvedInvokeAction.execute = (actorCtx) => {
        const interpreter = actorCtx.self as AnyInterpreter;
        const { id, autoForward, ref } = resolvedInvokeAction.params;
        if (!ref) {
          if (!IS_PRODUCTION) {
            warn(
              false,
              `Actor type '${
                (resolvedInvokeAction.params.src as InvokeSourceDefinition).type
              }' not found in machine '${actorCtx.id}'.`
            );
          }
          return;
        }
        actorCtx.defer(() => {
          if (actorRef.status === ActorStatus.Stopped) {
            return;
          }
          try {
            if (autoForward) {
              interpreter._forwardTo.add(actorRef);
            }

            actorRef.start?.();
          } catch (err) {
            interpreter.send(error(id, err));
            return;
          }
        });
      };

      return [invokedState, resolvedInvokeAction];
    }
  );
}
