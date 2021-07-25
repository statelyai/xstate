import { ActionFunction, ActionObject, EventObject, State } from '../src';

export interface ResolvedActionObject<
  TContext extends object,
  TEvent extends EventObject
> {
  type: string;
  params: Record<string, any>;
  context: TContext;
  execute: (state: State<TContext, TEvent>) => any;
}

export class ResolvedAction<TContext extends object, TEvent extends EventObject>
  implements ResolvedActionObject<TContext, TEvent> {
  public type: string;
  public params: Record<string, any>;
  constructor(
    public actionObject: ActionObject<TContext, TEvent>,
    public context: TContext,
    private _exec?: ActionFunction<TContext, TEvent>
  ) {
    this.type = actionObject.type;
    this.params = actionObject;
  }
  public execute(state: State<TContext, TEvent>) {
    return this._exec?.(this.context, state.event, {
      action: this.actionObject,
      _event: state._event,
      state
    });
  }
}
