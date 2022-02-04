import { useState } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import {
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineOptions,
  interpret,
  InterpreterFrom,
  InterpreterOptions,
  MachineImplementations,
  Observer
} from 'xstate';
import { MachineContext } from '../../core/src';
import { MaybeLazy } from './types';
import useConstant from './useConstant';
import { UseMachineOptions } from './useMachine';
import { useReactEffectActions } from './useReactEffectActions';

// copied from core/src/utils.ts
// it avoids a breaking change between this package and XState which is its peer dep
function toObserver<T>(
  nextHandler: Observer<T> | ((value: T) => void),
  errorHandler?: (error: any) => void,
  completionHandler?: () => void
): Observer<T> {
  if (typeof nextHandler === 'object') {
    return nextHandler;
  }

  const noop = () => void 0;

  return {
    next: nextHandler,
    error: errorHandler || noop,
    complete: completionHandler || noop
  };
}

type RestParams<
  TMachine extends StateMachine<any, any, any, any, any, any, any>
> = AreAllImplementationsAssumedToBeProvided<
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
        | Observer<
            State<
              TMachine['__TContext'],
              TMachine['__TEvent'],
              any,
              TMachine['__TTypestate'],
              TMachine['__TResolvedTypesMeta']
            >
          >
        | ((
            value: State<
              TMachine['__TContext'],
              TMachine['__TEvent'],
              any,
              TMachine['__TTypestate'],
              TMachine['__TResolvedTypesMeta']
            >
          ) => void)
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
        | Observer<
            State<
              TMachine['__TContext'],
              TMachine['__TEvent'],
              any,
              TMachine['__TTypestate'],
              TMachine['__TResolvedTypesMeta']
            >
          >
        | ((
            value: State<
              TMachine['__TContext'],
              TMachine['__TEvent'],
              any,
              TMachine['__TTypestate'],
              TMachine['__TResolvedTypesMeta']
            >
          ) => void)
    ];

export function useInterpret<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  getMachine: MaybeLazy<StateMachine<TContext, TEvent>>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineImplementations<TContext, TEvent>> = {},
  observerOrListener?:
    | Observer<State<TContext, TEvent>>
    | ((value: State<TContext, TEvent>) => void)
): Interpreter<TContext, TEvent> {
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
    actors,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  // it's not defined in `TypegenMachineOptions` so we can't just unpack this property here freely
  const { activities } = options as any;

  const service = useConstant(() => {
    const machineConfig = {
      context,
      guards,
      actions,
      actors,
      delays
    };
    const machineWithConfig = machine.provide(machineConfig);

    return interpret(machineWithConfig as any, {
      deferEvents: true,
      ...interpreterOptions
    });
  });

  useIsomorphicLayoutEffect(() => {
    let sub;
    if (observerOrListener) {
      sub = service.subscribe(toObserver(observerOrListener) as any);
    }

    return () => {
      sub?.unsubscribe();
    };
  }, [observerOrListener]);

  useIsomorphicLayoutEffect(() => {
    service.start(
      rehydratedState ? (State.create(rehydratedState) as any) : undefined
    );

    return () => {
      service.stop();
    };
  }, []);

  // Make sure options are kept updated when they change.
  // This mutation assignment is safe because the service instance is only used
  // in one place -- this hook's caller.
  useIsomorphicLayoutEffect(() => {
    Object.assign(service.machine.options.actions, actions);
    Object.assign(service.machine.options.guards, guards);
    Object.assign(service.machine.options.actors, actors);
    Object.assign(service.machine.options.delays, delays);
  }, [actions, guards, actors, delays]);

  useReactEffectActions(service);

  return service as any;
}
