import { readable } from 'svelte/store';
import {
  createMachine,
  interpret,
  EventObject,
  StateMachine,
  Typestate
} from '@xstate/fsm';

interface UseMachineOptions<
  TContext extends object,
  TEvent extends EventObject
> {
  /**
   * If provided, will replace machine's `actions`.
   */
  actions: StateMachine.ActionMap<TContext, TEvent>;
}

export function useMachine<
  TContext extends object,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
>(
  machine: StateMachine.Machine<TContext, TEvent, TTypestate>,
  options: Partial<UseMachineOptions<TContext, TEvent>> = {}
) {
  const resolvedMachine = createMachine(
    machine.config,
    options ? options : (machine as any)._options
  );

  const service = interpret(resolvedMachine).start();

  const state = readable(service.state, (set) => {
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
