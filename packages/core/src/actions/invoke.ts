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

export function invoke<
  TContext extends MachineContext,
  TEvent extends EventObject
>(invokeDef: InvokeDefinition<TContext, TEvent>) {
  const invokeAction = new DynamicAction<TContext, TEvent, any>(
    invokeActionType,
    {
      src: invokeDef.src,
      id: invokeDef.id,
      autoForward: invokeDef.autoForward,
      data: invokeDef.data
    }
  );
  invokeAction.resolve = function (context, _event, { machine }) {
    const { id, data, src } = this.params;
    if (isActorRef(src)) {
      return {
        type: this.type,
        params: {
          ...this.params,
          ref: src
        }
      };
    }

    const behaviorCreator: BehaviorCreator<TContext, TEvent> | undefined =
      machine.options.actors[src.type];

    if (!behaviorCreator) {
      return {
        type: this.type,
        params: this.params
      };
    }

    const behavior = behaviorCreator(context, _event.data, {
      id,
      data,
      src,
      _event
    });

    return {
      type: this.type,
      params: {
        ...this.params,
        ref: new ObservableActorRef(behavior, id)
      }
    };
  };
  return invokeAction;
}
