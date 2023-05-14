import { EventObject, InvokeDefinition, MachineContext } from '../types.ts';
import { invoke as invokeActionType } from '../actionTypes.ts';
import { isActorRef } from '../actors/index.ts';
import { createDynamicAction } from '../../actions/dynamicAction.ts';
import {
  AnyInterpreter,
  BaseDynamicActionObject,
  DynamicInvokeActionObject,
  InvokeActionObject
} from '../index.ts';
import { actionTypes, error } from '../actions.ts';
import { resolveReferencedActor, warn } from '../utils.ts';
import { ActorStatus, interpret } from '../interpreter.ts';
import { cloneState } from '../State.ts';
import { IS_PRODUCTION } from '../environment.ts';

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
    (event, { state, actorContext }) => {
      const type = actionTypes.invoke;
      const { id, src } = invokeDef;

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
        const referenced = resolveReferencedActor(
          state.machine.options.actors[src]
        );

        if (!referenced) {
          resolvedInvokeAction = {
            type,
            params: invokeDef
          } as InvokeActionObject;
        } else {
          const input =
            'input' in invokeDef ? invokeDef.input : referenced.input;
          const ref = interpret(referenced.src, {
            id,
            src,
            parent: actorContext?.self,
            systemId: invokeDef.systemId,
            input:
              typeof input === 'function'
                ? input({
                    context: state.context,
                    event,
                    self: actorContext?.self
                  })
                : input
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
        const parent = actorCtx.self as AnyInterpreter;
        const { id, ref } = resolvedInvokeAction.params;
        if (!ref) {
          if (!IS_PRODUCTION) {
            warn(
              false,
              `Actor type '${resolvedInvokeAction.params.src}' not found in machine '${actorCtx.id}'.`
            );
          }
          return;
        }
        actorCtx.defer(() => {
          if (actorRef.status === ActorStatus.Stopped) {
            return;
          }
          try {
            actorRef.start?.();
          } catch (err) {
            parent.send(error(id, err));
            return;
          }
        });
      };

      return [invokedState, resolvedInvokeAction];
    }
  );
}
