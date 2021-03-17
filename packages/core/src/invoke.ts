import {
  EventObject,
  InvokeCallback,
  Subscribable,
  BehaviorCreator,
  SCXML,
  InvokeMeta,
  InvokeActionObject
} from './types';
import { State } from './State';

import { isFunction, mapContext, warn } from './utils';
import { AnyEventObject } from './types';
import { MachineNode } from './MachineNode';
import {
  createMachineBehavior,
  createDeferredBehavior,
  Behavior,
  createObservableBehavior,
  createPromiseBehavior
} from './behavior';
import { isActorRef } from './Actor';
import { ObservableActorRef } from './ObservableActorRef';
import { IS_PRODUCTION } from './environment';
import { SpawnedActorRef } from '.';

export const DEFAULT_SPAWN_OPTIONS = { sync: false };

export function invokeMachine<
  TContext,
  TEvent extends EventObject,
  TMachine extends MachineNode<any, any, any>
>(
  machine:
    | TMachine
    | ((ctx: TContext, event: TEvent, meta: InvokeMeta) => TMachine),
  options: { sync?: boolean } = {}
): BehaviorCreator<TContext, TEvent> {
  return (ctx, event, { data, src, _event }) => {
    const resolvedContext = data ? mapContext(data, ctx, _event) : undefined;
    const machineOrDeferredMachine = isFunction(machine)
      ? () => {
          const resolvedMachine = machine(ctx, event, {
            data: resolvedContext,
            src
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

export function invokePromise<T>(
  getPromise: (
    ctx: any,
    event: AnyEventObject,
    meta: InvokeMeta
  ) => PromiseLike<T>
): BehaviorCreator<any, AnyEventObject> {
  return (ctx, e, { data, src, _event }) => {
    const resolvedData = data ? mapContext(data, ctx, _event) : undefined;

    const lazyPromise = () => getPromise(ctx, e, { data: resolvedData, src });
    return createPromiseBehavior(lazyPromise);
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
  return (ctx, event): Behavior<SCXML.Event<TE>, undefined> => {
    const lazyCallback = () => callbackCreator(ctx, event);
    return createDeferredBehavior<SCXML.Event<TE>>(lazyCallback);
  };
}

export function invokeObservable<T extends EventObject = AnyEventObject>(
  source: (ctx: any, event: any) => Subscribable<T>
): BehaviorCreator<any, any> {
  return (ctx, e): Behavior<never, T | undefined> => {
    const resolvedSource = isFunction(source) ? source(ctx, e) : source;
    return createObservableBehavior(() => resolvedSource);
  };
}

export function createActorRefFromInvokeAction<
  TContext,
  TEvent extends EventObject
>(
  state: State<TContext, TEvent, any, any>,
  invokeAction: InvokeActionObject,
  machine: MachineNode<TContext, TEvent>
): SpawnedActorRef<any> | undefined {
  const { id, data, src } = invokeAction;
  const { _event, context } = state;

  let actorRef: SpawnedActorRef<any>;

  if (isActorRef(src)) {
    actorRef = src as SpawnedActorRef<any>;
  } else {
    const behaviorCreator: BehaviorCreator<TContext, TEvent> | undefined =
      machine.options.actors[src.type];

    if (!behaviorCreator) {
      if (!IS_PRODUCTION) {
        warn(
          false,
          `Actor type '${src.type}' not found in machine '${machine.id}'.`
        );
      }
      return;
    }

    const behavior = behaviorCreator(context, _event.data, {
      id,
      data,
      src,
      _event
    });

    actorRef = new ObservableActorRef(behavior, id);
    invokeAction.src = actorRef;
  }

  return actorRef;
}
