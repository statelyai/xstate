import { onDestroy } from 'svelte';
import { Readable, readable } from 'svelte/store';
import {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  interpret,
  InterpreterFrom,
  InterpreterOptions,
  StateFrom,
  TODO
} from 'xstate';

type Prop<T, K> = K extends keyof T ? T[K] : never;

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
          >
      ]
    : [
        options?: InterpreterOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TODO,
            TODO,
            TMachine['__TResolvedTypesMeta']
          >
      ];

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = InterpreterFrom<TMachine>
> = {
  state: Readable<StateFrom<TMachine>>;
  send: Prop<TInterpreter, 'send'>;
  service: TInterpreter;
};

export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  const { guards, actions, actors, delays, ...interpreterOptions } = options;

  const machineConfig = {
    guards,
    actions,
    actors,
    delays
  };

  const resolvedMachine = machine.provide(machineConfig as any);

  const service = interpret(resolvedMachine, interpreterOptions).start();

  onDestroy(() => service.stop());

  const state = readable(service.getSnapshot(), (set) => {
    return service.subscribe((state) => {
      if (state.changed) {
        set(state);
      }
    }).unsubscribe;
  });

  return { state, send: service.send, service } as any;
}
