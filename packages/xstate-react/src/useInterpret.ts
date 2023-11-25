import { useEffect, useState } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import {
  AnyInterpreter,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineOptions,
  interpret,
  InterpreterFrom,
  InterpreterOptions,
  InterpreterStatus,
  MachineOptions,
  Observer,
  State,
  StateFrom,
  toObserver
} from 'xstate';
import { MaybeLazy } from './types';
import useConstant from './useConstant';
import { UseMachineOptions } from './useMachine';

export function useIdleInterpreter(
  getMachine: MaybeLazy<AnyStateMachine>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<unknown, never>> &
    Partial<MachineOptions<unknown, never>>
): AnyInterpreter {
  const machine = useConstant(() => {
    return typeof getMachine === 'function' ? getMachine() : getMachine;
  });

  if (
    process.env.NODE_ENV !== 'production' &&
    typeof getMachine !== 'function'
  ) {
    const [initialMachine] = useState(machine);

    if (getMachine !== initialMachine) {
      console.warn(
        'Machine given to `useMachine` has changed between renders. This is not supported and might lead to unexpected results.\n' +
          'Please make sure that you pass the same Machine as argument each time.'
      );
    }
  }

  const {
    context,
    guards,
    actions,
    activities,
    services,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const service = useConstant(() => {
    const machineConfig = {
      context,
      guards,
      actions,
      activities,
      services,
      delays
    };
    const machineWithConfig = machine.withConfig(machineConfig as any, () => ({
      ...machine.context,
      ...context
    }));

    return interpret(machineWithConfig, interpreterOptions);
  });

  // Make sure options are kept updated when they change.
  // This mutation assignment is safe because the service instance is only used
  // in one place -- this hook's caller.
  useIsomorphicLayoutEffect(() => {
    Object.assign(service.machine.options.actions!, actions);
    Object.assign(service.machine.options.guards!, guards);
    Object.assign(service.machine.options.activities!, activities);
    Object.assign(service.machine.options.services!, services);
    Object.assign(service.machine.options.delays!, delays);
  }, [actions, guards, activities, services, delays]);

  return service as any;
}

type RestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [
        options: InterpreterOptions &
          UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
          InternalMachineOptions<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta'],
            true
          >,
        observerOrListener?:
          | Observer<StateFrom<TMachine>>
          | ((value: StateFrom<TMachine>) => void)
      ]
    : [
        options?: InterpreterOptions &
          UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
          InternalMachineOptions<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta']
          >,
        observerOrListener?:
          | Observer<StateFrom<TMachine>>
          | ((value: StateFrom<TMachine>) => void)
      ];

export function useInterpret<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>,
  ...[options = {}, observerOrListener]: RestParams<TMachine>
): InterpreterFrom<TMachine> {
  const service = useIdleInterpreter(getMachine, options as any);

  useEffect(() => {
    if (!observerOrListener) {
      return;
    }

    let sub = service.subscribe(toObserver(observerOrListener));

    return () => {
      sub.unsubscribe();
    };
  }, [observerOrListener]);

  useEffect(() => {
    const rehydratedState = options.state;
    service.start(
      rehydratedState ? (State.create(rehydratedState) as any) : undefined
    );

    return () => {
      service.stop();
      service.status = InterpreterStatus.NotStarted;
    };
  }, []);

  return service as any;
}
