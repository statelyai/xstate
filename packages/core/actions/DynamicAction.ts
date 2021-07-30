import { SCXML } from '../dist/xstate.cjs';
import { MachineNode } from '../src';
import {
  BaseActionObject,
  BaseDynamicActionObject,
  EventObject,
  MachineContext
} from '../src/types';

export class DynamicAction<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject
> implements BaseDynamicActionObject<TContext, TEvent, TAction> {
  constructor(
    public type: `xstate.${string}`,
    public params: Record<string, any>
  ) {}
  public resolve(
    context: TContext,
    _event: SCXML.Event<TEvent>,
    extra: { machine: MachineNode<TContext, TEvent> }
  ): TAction {
    return null as any;
  }
}
