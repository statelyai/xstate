import { onBeforeUnmount, onMounted } from 'vue';
import {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  interpret,
  InterpreterFrom,
  InterpreterOptions,
  Observer,
  StateFrom,
  toObserver
} from 'xstate';
import { MaybeLazy, UseMachineOptions } from './types';

type RestParams<
  TMachine extends AnyStateMachine
> = AreAllImplementationsAssumedToBeProvided<
  TMachine['__TResolvedTypesMeta']
> extends false
  ? [
      options: InterpreterOptions &
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
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
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
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
  const machine = typeof getMachine === 'function' ? getMachine() : getMachine;

  const {
    context,
    guards,
    actions,
    actors,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const machineConfig = {
    context,
    guards,
    actions,
    actors,
    delays
  };

  const machineWithConfig = machine.provide({
    ...machineConfig,
    context
  } as any);

  const service = interpret(machineWithConfig, interpreterOptions).start(
    rehydratedState
      ? (machineWithConfig.createState(rehydratedState) as any)
      : undefined
  );

  let sub;
  onMounted(() => {
    if (observerOrListener) {
      sub = service.subscribe(toObserver(observerOrListener as any));
    }
  });

  onBeforeUnmount(() => {
    service.stop();
    sub?.unsubscribe();
  });

  return service as any;
}
