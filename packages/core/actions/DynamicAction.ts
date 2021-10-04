import type {
  BaseActionObject,
  BaseDynamicActionObject,
  EventObject,
  MachineContext
} from '../src/types';

export class DynamicAction<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject,
  TDynamicParams extends Record<string, any>
> implements
    BaseDynamicActionObject<TContext, TEvent, TAction, TDynamicParams> {
  constructor(
    public type: `xstate.${string}`,
    public params: TDynamicParams,
    public resolve: BaseDynamicActionObject<
      TContext,
      TEvent,
      TAction,
      TDynamicParams
    >['resolve']
  ) {}
}
