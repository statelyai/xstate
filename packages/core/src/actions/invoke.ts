import { EventObject, InvokeDefinition, MachineContext } from '../types';
import { invoke as invokeActionType } from '../actionTypes';
import { isActorRef } from '../actors';
import { createDynamicAction } from '../../actions/dynamicAction';
import {
  BaseDynamicActionObject,
  DynamicInvokeActionObject,
  InvokeActionObject
} from '..';
import { actionTypes } from '../actions';
import { mapContext } from '../utils';
import { interpret } from '../interpreter';

export function invoke<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  invokeDef: InvokeDefinition<TContext, TEvent>
): BaseDynamicActionObject<
  TContext,
  TEvent,
  InvokeActionObject,
  DynamicInvokeActionObject<TContext, TEvent>['params']
> {
  return createDynamicAction(
    invokeActionType,
    invokeDef,
    ({ params }, _event, { machine, state }) => {
      const type = actionTypes.invoke;
      const { id, data, src, meta } = params;
      if (isActorRef(src)) {
        return {
          type,
          params: {
            ...params,
            ref: src
          }
        } as InvokeActionObject;
      }

      const behaviorImpl = machine.options.actors[src.type];

      if (!behaviorImpl) {
        return {
          type,
          params
        } as InvokeActionObject;
      }

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

      return {
        type,
        params: {
          ...params,
          ref: interpret(behavior, { id })
        }
      } as InvokeActionObject;
    }
  );
}
