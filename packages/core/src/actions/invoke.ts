import {
  EventObject,
  InvokeDefinition,
  BehaviorCreator,
  MachineContext
} from '../types';
import { invoke as invokeActionType } from '../actionTypes';
import { isActorRef } from '../actor';
import { ObservableActorRef } from '../ObservableActorRef';
import { DynamicAction } from '../../actions/DynamicAction';
import { InvokeActionObject } from '..';

export function invoke<
  TContext extends MachineContext,
  TEvent extends EventObject
>(invokeDef: InvokeDefinition<TContext, TEvent>) {
  const invokeAction = new DynamicAction<TContext, TEvent, InvokeActionObject>(
    invokeActionType,
    {
      src: invokeDef.src,
      id: invokeDef.id,
      autoForward: invokeDef.autoForward,
      data: invokeDef.data
    },
    (action, context, _event, { machine }) => {
      const { id, data, src } = action.params;
      if (isActorRef(src)) {
        return {
          type: action.type,
          params: {
            ...action.params,
            ref: src
          }
        } as InvokeActionObject;
      }

      const behaviorCreator: BehaviorCreator<TContext, TEvent> | undefined =
        machine.options.actors[src.type];

      if (!behaviorCreator) {
        return {
          type: action.type,
          params: action.params
        } as InvokeActionObject;
      }

      const behavior = behaviorCreator(context, _event.data, {
        id,
        data,
        src,
        _event
      });

      return {
        type: action.type,
        params: {
          ...action.params,
          id: action.params.id,
          src: action.params.src,
          ref: new ObservableActorRef(behavior, id)
        }
      } as InvokeActionObject;
    }
  );

  return invokeAction;
}
