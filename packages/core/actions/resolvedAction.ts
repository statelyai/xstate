import type { State } from '../src/State';
import {
  ActionFunction,
  ActionObject,
  EventObject,
  MachineContext
} from '../src/types';

export interface ResolvedActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  type: string;
  params: Record<string, any>;
  /**
   * The intermediate context
   */
  context: TContext | undefined;
  execute: (state: State<TContext, TEvent>) => any;
}

export class ResolvedAction<TContext extends object, TEvent extends EventObject>
  implements ResolvedActionObject<TContext, TEvent> {
  public type: string;
  public params: Record<string, any>;
  public context: TContext | undefined = undefined;
  constructor(
    public actionObject: ActionObject<TContext, TEvent>,
    private _exec?: ActionFunction<TContext, TEvent>
  ) {
    this.type = actionObject.type;
    this.params = actionObject;
  }
  public execute(state: State<TContext, TEvent>) {
    const context = this.context ?? state.context;

    return this._exec?.(context, state.event, {
      action: this.actionObject,
      _event: state._event,
      state
    });
  }
  public setContext(context: TContext) {
    this.context = context;
  }
}
