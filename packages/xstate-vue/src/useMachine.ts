import { shallowRef, onMounted, Ref } from 'vue';
import {
  EventObject,
  StateMachine,
  State,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  Typestate
} from 'xstate';

import { UseMachineOptions } from './types';

import { useInterpret } from './useInterpret';

export function useMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  machine: StateMachine<TContext, any, TEvent, TTypestate>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = {}
): {
  state: Ref<State<TContext, TEvent, any, TTypestate>>;
  send: Interpreter<TContext, any, TEvent, TTypestate>['send'];
  service: Interpreter<TContext, any, TEvent, TTypestate>;
} {
  const service = useInterpret(machine, options, listener);

  const state = shallowRef(service.state);

  function listener(nextState: State<TContext, TEvent, any, TTypestate>) {
    // Only change the current state if:
    // - the incoming state is the "live" initial state (since it might have new actors)
    // - OR the incoming state actually changed.
    //
    // The "live" initial state will have .changed === undefined.
    const initialStateChanged =
      nextState.changed === undefined && Object.keys(nextState.children).length;

    if (nextState.changed || initialStateChanged) {
      state.value = nextState;
    }
  }

  onMounted(() => {
    state.value = service.state;
  });

  return { state, send: service.send, service };
}
