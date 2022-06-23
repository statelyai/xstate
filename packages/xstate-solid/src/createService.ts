import type {
  AnyStateMachine,
  InterpreterOptions,
  Observer,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineOptions,
  InterpreterFrom
} from 'xstate';
import { State, interpret, toObserver } from 'xstate';
import type { UseMachineOptions } from './types';
import { onCleanup, onMount } from 'solid-js';

type RestParams<
  TMachine extends AnyStateMachine
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

export function createService<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}, observerOrListener]: RestParams<TMachine>
): InterpreterFrom<TMachine> {
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

  const service = interpret(machineWithConfig, interpreterOptions).start(
    rehydratedState ? (State.create(rehydratedState) as any) : undefined
  );

  onMount(() => {
    let sub;

    if (observerOrListener) {
      sub = service.subscribe(toObserver(observerOrListener));
    }

    onCleanup(() => {
      service.stop();
      sub?.unsubscribe();
    });
  });

  return service as InterpreterFrom<TMachine>;
}
