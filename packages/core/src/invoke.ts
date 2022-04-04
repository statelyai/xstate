import {
  EventObject,
  BehaviorCreator,
  InvokeMeta,
  MachineContext
} from './types';

import { isFunction, mapContext } from './utils';
import { createMachineBehavior } from './behaviors';
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
