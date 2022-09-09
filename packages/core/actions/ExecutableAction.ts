import type { State } from '../src/State';
import { TypegenDisabled } from '../src/typegenTypes';
import {
  ActionFunction,
  BaseActionObject,
  EventObject,
  MachineContext
} from '../src/types';

export interface ResolvedActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TResolvedTypesMeta = TypegenDisabled
> {
  type: string;
  params: Record<string, any>;
  /**
   * The intermediate context
   */
  context: TContext | undefined;
  execute: (state: State<TContext, TEvent, TResolvedTypesMeta>) => any;
}

// TODO: refactor out of class
export class ExecutableAction<
  TContext extends object,
  TEvent extends EventObject,
  TResolvedTypesMeta = TypegenDisabled
> implements ResolvedActionObject<TContext, TEvent, TResolvedTypesMeta> {
  public type: string;
  public params: Record<string, any>;
  public context: TContext | undefined = undefined;
  constructor(
    public actionObject: BaseActionObject,
    private _exec: ActionFunction<TContext, TEvent>
  ) {
    this.type = actionObject.type;
    this.params = actionObject.params ?? {};
  }
  public execute(state: State<TContext, TEvent, TResolvedTypesMeta>) {
    const context = this.context ?? state.context;

    return this._exec(context, state.event, {
      action: this.actionObject,
      _event: state._event,
      state
    });
  }
  public setContext(context: TContext) {
    this.context = context;
  }
}

export function isExecutableAction(
  action: BaseActionObject | ResolvedActionObject<any, any, any>
): action is ExecutableAction<any, any, any> {
  return 'execute' in action && typeof action.execute === 'function';
}
