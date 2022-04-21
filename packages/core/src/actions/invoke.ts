import {
  EventObject,
  InvokeDefinition,
  BehaviorCreator,
  MachineContext
} from '../types';
import { invoke as invokeActionType } from '../actionTypes';
import { isActorRef } from '../actors';
import { ObservableActorRef } from '../ObservableActorRef';
import { createDynamicAction } from '../../actions/dynamicAction';
import {
  BaseDynamicActionObject,
  DynamicInvokeActionObject,
  InvokeActionObject
} from '..';
import { actionTypes } from '../actions';
import { mapContext } from '../utils';

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
    ({ params }, context, _event, { machine }) => {
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

      const behaviorCreator: BehaviorCreator<TContext, TEvent> | undefined =
        machine.options.actors[src.type];

      if (!behaviorCreator) {
        return {
          type,
          params
        } as InvokeActionObject;
      }

      const behavior = behaviorCreator(context, _event.data, {
        id,
        data: data && mapContext(data, context, _event),
        src,
        _event,
        meta
      });

      return {
        type,
        params: {
          ...params,
          id: params.id,
          src: params.src,
          ref: new ObservableActorRef(behavior, id),
          meta
        }
      } as InvokeActionObject;
    }
  );
}
