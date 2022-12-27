import type {
  BaseActionObject,
  BaseDynamicActionObject,
  BuiltInActionObject,
  EventObject,
  MachineContext
} from '../src/types';

export function createDynamicAction<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject,
  TDynamicParams extends Record<string, any>
>(
  action: BuiltInActionObject & { params: TDynamicParams },
  resolve: BaseDynamicActionObject<
    TContext,
    TEvent,
    TAction,
    TDynamicParams
  >['resolve']
): BaseDynamicActionObject<TContext, TEvent, TAction, TDynamicParams> {
  return {
    type: action.type,
    params: action.params,
    resolve
  };
}

export function isDynamicAction(
  action: any
): action is BaseDynamicActionObject<any, any, any, any> {
  return typeof action === 'object' && action !== null && 'resolve' in action;
}
