import type {
  BaseActionObject,
  BaseDynamicActionObject,
  EventObject,
  MachineContext
} from '../src/types';

export function createDynamicAction<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject,
  TDynamicParams extends Record<string, any>
>(
  type: `xstate.${string}`,
  params: TDynamicParams,
  resolve: BaseDynamicActionObject<
    TContext,
    TEvent,
    TAction,
    TDynamicParams
  >['resolve']
): BaseDynamicActionObject<TContext, TEvent, TAction, TDynamicParams> {
  return {
    type,
    params,
    resolve
  };
}

export function isDynamicAction(
  action: any
): action is BaseDynamicActionObject<any, any, any, any> {
  return typeof action === 'object' && action !== null && 'resolve' in action;
}
