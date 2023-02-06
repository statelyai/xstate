import { useEffect, useState } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import {
  AnyInterpreter,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  interpret,
  InterpreterFrom,
  InterpreterOptions,
  InterpreterStatus,
  MachineImplementations,
  Observer,
  StateFrom,
  toObserver
} from 'xstate';
import { MaybeLazy } from './types.js';
import useConstant from './useConstant.js';

export function useIdleInterpreter(
  getMachine: MaybeLazy<AnyStateMachine>,
  options: Partial<InterpreterOptions> &
    Partial<MachineImplementations<any, never>>
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

  const { actors, guards, actions, delays, ...interpreterOptions } = options;

  const service = useConstant(() => {
    const machineConfig = {
      guards,
      actions,
      actors,
      delays
    };
    const machineWithConfig = machine.provide(machineConfig as any);

    return interpret(machineWithConfig as AnyStateMachine, interpreterOptions);
  });

  // Make sure options are kept updated when they change.
  // This mutation assignment is safe because the service instance is only used
  // in one place -- this hook's caller.
  useIsomorphicLayoutEffect(() => {
    Object.assign(
      (service.behavior as AnyStateMachine).options.actions,
      actions
    );
    Object.assign((service.behavior as AnyStateMachine).options.guards, guards);
    Object.assign((service.behavior as AnyStateMachine).options.actors, actors);
    Object.assign((service.behavior as AnyStateMachine).options.delays, delays);
  }, [actions, guards, actors, delays]);

  return service as any;
}

type RestParams<
  TMachine extends AnyStateMachine
> = AreAllImplementationsAssumedToBeProvided<
  TMachine['__TResolvedTypesMeta']
> extends false
  ? [
      options: InterpreterOptions &
        InternalMachineImplementations<
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
        InternalMachineImplementations<
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
    service.start();

    return () => {
      service.stop();
      service.status = InterpreterStatus.NotStarted;
    };
  }, []);

  return service as any;
}
