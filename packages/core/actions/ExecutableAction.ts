import type { State } from '../src/State';
import {
  ActionFunction,
  BaseActionObject,
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

export class ExecutableAction<
  TContext extends object,
  TEvent extends EventObject
> implements ResolvedActionObject<TContext, TEvent> {
  public type: string;
  public params: Record<string, any>;
  public context: TContext | undefined = undefined;
  constructor(
    public actionObject: BaseActionObject,
    private _exec?: ActionFunction<TContext, TEvent>
  ) {
    this.type = actionObject.type;
    this.params = actionObject.params ?? {};
  }
  public execute(state: State<TContext, TEvent, any>) {
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
  public setExec(exec: ActionFunction<TContext, TEvent>) {
    this._exec = exec;
  }
}
