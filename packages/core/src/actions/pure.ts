import isDevelopment from '#is-development';
import {
  Action,
  ActionArgs,
  AnyActorContext,
  AnyState,
  EventObject,
  MachineContext,
  SingleOrArray
} from '../types.ts';
import { toArray } from '../utils.ts';

function resolve(
  _: AnyActorContext,
  state: AnyState,
  args: ActionArgs<any, any>,
  {
    get
  }: {
    get: ({
      context,
      event
    }: {
      context: MachineContext;
      event: EventObject;
    }) => SingleOrArray<Action<any, any, any>> | undefined;
  }
) {
  return [
    state,
    undefined,
    toArray(get({ context: state.context, event: args.event }))
  ];
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
  }) => SingleOrArray<Action<TContext, TExpressionEvent> | string> | undefined
) {
  function pure(_: ActionArgs<TContext, TExpressionEvent>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  pure.type = 'xstate.pure';
  pure.get = getActions;
  pure.resolve = resolve;

  return pure;
}
