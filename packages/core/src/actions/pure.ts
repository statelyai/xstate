import {
  EventObject,
  SingleOrArray,
  MachineContext,
  AnyActorContext,
  BaseActionObject,
  AnyState,
  UnifiedArg
} from '../types.ts';
import { toArray } from '../utils.ts';
import { BuiltinAction } from './_shared.ts';

class PureResolver<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> extends BuiltinAction<TContext, TExpressionEvent, TEvent> {
  static get: ({
    context,
    event
  }: {
    context: MachineContext;
    event: EventObject;
  }) => SingleOrArray<BaseActionObject | string> | undefined;

  static resolve(
    _: AnyActorContext,
    state: AnyState,
    args: UnifiedArg<any, any>
  ) {
    const { get } = this;

    return [
      state,
      undefined,
      toArray(get({ context: state.context, event: args.event }))
    ];
  }
}

export function pure<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
>(
  getActions: ({
    context,
    event
  }: {
    context: TContext;
    event: TExpressionEvent;
  }) => SingleOrArray<BaseActionObject | string> | undefined
) {
  return class Pure extends PureResolver<TContext, TExpressionEvent, TEvent> {
    static get = getActions as any;
  };
}
