import type {
  StateMachine,
  InterpreterOptions,
  Observer,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineOptions,
  InterpreterFrom
} from 'xstate';
import { State, interpret } from 'xstate';
import type { UseMachineOptions, MaybeLazy } from './types';
import { onCleanup, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';

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
  TMachine extends StateMachine<any, any, any, any, any, any, any>
>(
  getMachine: MaybeLazy<TMachine>,
  ...[options = {}, observerOrListener]: RestParams<TMachine>
): InterpreterFrom<TMachine> {
  const machine = typeof getMachine === 'function' ? getMachine() : getMachine;

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

  const [service] = createStore(
    interpret(machineWithConfig, {
      deferEvents: true,
      ...interpreterOptions
    }).start(
      rehydratedState ? (State.create(rehydratedState) as any) : undefined
    )
  );

  let sub;
  onMount(() => {
    if (observerOrListener) {
      sub = service.subscribe(toObserver(observerOrListener));
    }
  });

  onCleanup(() => {
    service.stop();
    sub?.unsubscribe();
  });

  return (service as unknown) as InterpreterFrom<TMachine>;
}
