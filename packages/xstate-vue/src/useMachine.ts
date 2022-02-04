import { shallowRef, Ref } from 'vue';
import {
  EventObject,
  StateMachine,
  State,
  Interpreter,
  InterpreterOptions,
  MachineImplementations,
  MachineContext
} from 'xstate';

import { UseMachineOptions, MaybeLazy } from './types';

import { useInterpret } from './useInterpret';

export function useMachine<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  getMachine: MaybeLazy<StateMachine<TContext, TEvent>>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineImplementations<TContext, TEvent>> = {}
): {
  state: Ref<State<TContext, TEvent>>;
  send: Interpreter<TContext, TEvent>['send'];
  service: Interpreter<TContext, TEvent>;
} {
  const service = useInterpret<TContext, TEvent>(getMachine, options, listener);

  const { initialState } = service.machine;
  const state = shallowRef(
    (options.state ? State.create(options.state) : initialState) as State<
      TContext,
      TEvent
    >
  );

  function listener(nextState: State<TContext, TEvent>) {
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

  return { state, send: service.send, service };
}
