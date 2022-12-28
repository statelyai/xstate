import { EventObject, MachineContext } from '../types';
import { invoke as invokeActionType } from '../actionTypes';
import { createDynamicAction } from '../../actions/dynamicAction';
import {
  AnyInterpreter,
  AnyState,
  BaseDynamicActionObject,
  DynamicInvokeActionObject,
  InvokeActionObject,
  InvokeSourceDefinition
} from '..';
import { actionTypes, error } from '../actions';
import { isBehavior, mapContext, warn } from '../utils';
import { interpret } from '../interpreter';
import { cloneState } from '../State';
import { IS_PRODUCTION } from '../environment';

export function invoke<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  invokeDef: DynamicInvokeActionObject<TContext, TEvent>['params']
): BaseDynamicActionObject<
  TContext,
  TEvent,
  InvokeActionObject,
  DynamicInvokeActionObject<TContext, TEvent>['params']
> {
  return createDynamicAction(
    { type: invokeActionType, params: invokeDef },
    (_event, { state }) => {
      const type = actionTypes.invoke;
      const { id, data, src, meta } = invokeDef;

      if (isBehavior(src)) {
        throw new Error('what??');
      }

      let resolvedInvokeAction: InvokeActionObject;

      const behaviorImpl = state.machine.options.actors[src.type];

      if (!behaviorImpl) {
        resolvedInvokeAction = {
          type,
          params: {
            ...invokeDef,
            src: null as any // TODO: fix
          }
        } as InvokeActionObject;
      } else {
        const behavior =
          typeof behaviorImpl === 'function'
            ? behaviorImpl(state.context, _event.data, {
                id,
                data: data && mapContext(data, state.context, _event),
                src,
                _event,
                meta
              })
            : behaviorImpl;

        resolvedInvokeAction = {
          type,
          params: {
            ...invokeDef,
            src: behavior,
            ref: interpret(behavior, { id })
          }
        } as InvokeActionObject;
      }

      const invokedState = cloneState(state, {
        children: {
          ...state.children,
          [id]: resolvedInvokeAction.params.ref!
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
                (src as InvokeSourceDefinition).type
              }' not found in machine '${actorCtx.id}'.`
            );
          }
          return;
        }
        ref._parent = interpreter; // TODO: fix
        actorCtx.defer?.((state: AnyState) => {
          try {
            const currentRef = state.children[id];
            if (!currentRef) {
              return;
            }
            if (autoForward) {
              interpreter._forwardTo.add(currentRef);
            }

            currentRef.start?.();
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
