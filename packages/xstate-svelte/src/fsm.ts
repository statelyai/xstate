import { readable } from 'svelte/store';
import {
  createMachine,
  interpret,
  EventObject,
  StateMachine,
  Typestate
} from '@xstate/fsm';

export function useMachine<
  TContext extends object,
  TEvent extends EventObject = EventObject
>(
  stateMachine: StateMachine.Machine<TContext, TEvent, Typestate<TContext>>,
  options?: {
    actions?: StateMachine.ActionMap<TContext, TEvent>;
  }
) {
  const machine = createMachine(stateMachine.config, {
    actions: {
      ...(stateMachine as any)._options.actions,
      ...options?.actions
    }
  });

  const service = interpret(machine);

  const store = readable(machine.initialState, (set) => {
    service.subscribe((state) => {
      set(state);
    });

    service.start();

    return () => {
      service.stop();
    };
  });

  return {
    state: store,
    send: service.send
  };
}
