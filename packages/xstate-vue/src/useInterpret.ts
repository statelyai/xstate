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
  TODO,
  toObserver
} from 'xstate';
import { MaybeLazy } from './types.ts';

type RestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [
        options: InterpreterOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TODO,
            TODO,
            TMachine['__TResolvedTypesMeta'],
            true
          >,
        observerOrListener?:
          | Observer<StateFrom<TMachine>>
          | ((value: StateFrom<TMachine>) => void)
      ]
    : [
        options?: InterpreterOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TODO,
            TODO,
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

  const { guards, actions, actors, delays, ...interpreterOptions } = options;

  const machineConfig = {
    guards,
    actions,
    actors,
    delays
  };

  const machineWithConfig = machine.provide(machineConfig as any);

  const service = interpret(machineWithConfig, interpreterOptions).start();

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
