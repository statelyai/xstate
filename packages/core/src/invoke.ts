import {
  EventObject,
  InvokeCallback,
  Subscribable,
  BehaviorCreator,
  SCXML,
  InvokeMeta,
  MachineContext,
  Behavior
} from './types';

import { isFunction, mapContext } from './utils';
import {
  createMachineBehavior,
  createDeferredBehavior,
  createObservableBehavior,
  createPromiseBehavior
} from './behaviors';
import { AnyStateMachine } from '.';

export const DEFAULT_SPAWN_OPTIONS = { sync: false };

export function invokeMachine<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TMachine extends AnyStateMachine
>(
  machine:
    | TMachine
    | ((ctx: TContext, event: TEvent, meta: InvokeMeta) => TMachine),
  options: { sync?: boolean } = {}
): BehaviorCreator<TContext, TEvent> {
  return (ctx, event, { data, src, _event, meta }) => {
    const resolvedContext = data ? mapContext(data, ctx, _event) : undefined;
    const machineOrDeferredMachine = isFunction(machine)
      ? () => {
          const resolvedMachine = machine(ctx, event, {
            data: resolvedContext,
            src,
            meta
          });
          return resolvedContext
            ? resolvedMachine.withContext(resolvedContext)
            : resolvedMachine;
        }
      : resolvedContext
      ? machine.withContext(resolvedContext)
      : machine;

    return createMachineBehavior(machineOrDeferredMachine, options);
  };
}

export function invokePromise<
  TContext extends MachineContext,
  TEvent extends EventObject,
  T
>(
  getPromise: (ctx: TContext, event: TEvent, meta: InvokeMeta) => PromiseLike<T>
): BehaviorCreator<TContext, TEvent> {
  return (ctx, e, { data, src, _event, meta }) => {
    const resolvedData = data ? mapContext(data, ctx, _event) : undefined;

    const lazyPromise = () =>
      getPromise(ctx, e, { data: resolvedData, src, meta });
    return createPromiseBehavior(lazyPromise);
  };
}

export function invokeActivity<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  activityCreator: (ctx: TContext, event: TEvent) => void
): BehaviorCreator<TContext, TEvent> {
  const callbackCreator = (ctx: TContext, event: TEvent) => () => {
    return activityCreator(ctx, event);
  };

  return invokeCallback<TContext, TEvent>(callbackCreator);
}

export function invokeCallback<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  callbackCreator: (
    ctx: TContext,
    e: TEvent
  ) => InvokeCallback<EventObject, TEvent>
): BehaviorCreator<TContext, TEvent> {
  return (ctx, event): Behavior<SCXML.Event<TEvent>, undefined> => {
    const lazyCallback = () => callbackCreator(ctx, event);
    return createDeferredBehavior<SCXML.Event<TEvent>>(lazyCallback);
  };
}

export function invokeObservable<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  source: (ctx: TContext, event: TEvent) => Subscribable<TEvent>
): BehaviorCreator<any, any> {
  return (ctx, e): Behavior<never, TEvent | undefined> => {
    const resolvedSource = isFunction(source) ? source(ctx, e) : source;
    return createObservableBehavior(() => resolvedSource);
  };
}
