import {
  EventObject,
  InvokeCallback,
  Subscribable,
  BehaviorCreator,
  SCXML,
  InvokeMeta
} from '.';

import { isFunction, mapContext } from './utils';
import { AnyEventObject } from './types';
import { MachineNode } from './MachineNode';
import {
  createMachineBehavior,
  createCallbackBehavior,
  Behavior,
  createObservableBehavior,
  createPromiseBehavior
} from './behavior';

export const DEFAULT_SPAWN_OPTIONS = { sync: false };

export function invokeMachine<
  TContext,
  TEvent extends EventObject,
  TMachine extends MachineNode<any, any, any>
>(
  machine: TMachine | ((ctx: TContext, event: TEvent) => TMachine),
  options: { sync?: boolean } = {}
): BehaviorCreator<TContext, TEvent> {
  return (ctx, event, { parent, data, _event }) => {
    let resolvedMachine = isFunction(machine) ? machine(ctx, event) : machine;
    if (data) {
      resolvedMachine = resolvedMachine.withContext(
        mapContext(data, ctx, _event)
      ) as TMachine;
    }
    return createMachineBehavior(resolvedMachine, parent, options);
  };
}

export function invokePromise<T>(
  promise:
    | PromiseLike<T>
    | ((ctx: any, event: AnyEventObject, meta: InvokeMeta) => PromiseLike<T>)
): BehaviorCreator<any, AnyEventObject> {
  return (ctx, e, { parent, data }) => {
    const resolvedPromise = isFunction(promise)
      ? promise(ctx, e, { data })
      : promise;
    return createPromiseBehavior(resolvedPromise, parent);
  };
}

export function invokeActivity<TC, TE extends EventObject>(
  activityCreator: (ctx: TC, event: TE) => any
): BehaviorCreator<TC, TE> {
  const callbackCreator = (ctx: TC, event: TE) => () => {
    return activityCreator(ctx, event);
  };

  return invokeCallback<TC, TE>(callbackCreator);
}

export function invokeCallback<TC, TE extends EventObject = AnyEventObject>(
  callbackCreator: (ctx: TC, e: TE) => InvokeCallback
): BehaviorCreator<TC, TE> {
  return (ctx, event, { parent }): Behavior<SCXML.Event<TE>, undefined> => {
    const callback = callbackCreator(ctx, event);
    return createCallbackBehavior<SCXML.Event<TE>>(callback, parent);
  };
}

export function invokeObservable<T extends EventObject = AnyEventObject>(
  source: Subscribable<T> | ((ctx: any, event: any) => Subscribable<T>)
): BehaviorCreator<any, any> {
  return (ctx, e, { parent }): Behavior<never, T | undefined> => {
    const resolvedSource = isFunction(source) ? source(ctx, e) : source;
    return createObservableBehavior(resolvedSource, parent);
  };
}
