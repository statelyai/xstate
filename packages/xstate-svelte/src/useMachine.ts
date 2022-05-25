import { readable } from 'svelte/store';
import {
  EventObject,
  interpret,
  InterpreterOptions,
  MachineImplementationsSimplified,
  StateConfig,
  StateMachine
} from 'xstate';

interface UseMachineOptions<
  TContext extends object,
  TEvent extends EventObject
> {
  /**
   * If provided, will be merged with machine's `context`.
   */
  context: Partial<TContext>;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state: StateConfig<TContext, TEvent>;
}

export function useMachine<TContext extends object, TEvent extends EventObject>(
  machine: StateMachine<TContext, TEvent>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineImplementationsSimplified<TContext, TEvent>> = {}
) {
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

  const resolvedMachine = machine.provide(machineConfig as any);

  const service = interpret(resolvedMachine, interpreterOptions).start(
    rehydratedState ? (machine.createState(rehydratedState) as any) : undefined
  );

  const state = readable(service.getSnapshot(), (set) => {
    service.subscribe((state) => {
      if (state.changed) {
        set(state);
      }
    });

    return () => {
      service.stop();
    };
  });

  return { state, send: service.send, service };
}
