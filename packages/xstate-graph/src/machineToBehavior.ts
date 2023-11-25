import { AnyStateMachine, StateFrom, EventFrom } from 'xstate';
import { SimpleBehavior } from './types';

export function machineToBehavior<TMachine extends AnyStateMachine>(
  machine: TMachine
): SimpleBehavior<StateFrom<TMachine>, EventFrom<TMachine>> {
  return {
    transition: (state, event) =>
      machine.transition(state, event) as StateFrom<TMachine>,
    initialState: machine.initialState as StateFrom<TMachine>
  };
}
