import { StateMachine } from '..';
import { FSTFrom } from './index';

export function machineToFST<TMachine extends StateMachine<any, any, any>>(
  machine: TMachine,
  nextEvents?: FSTFrom<TMachine>['nextEvents']
): FSTFrom<TMachine> {
  return {
    transition: ((state, input) => {
      const nextState = machine.transition(state, input);
      return [nextState, []];
    }) as FSTFrom<TMachine>['transition'],
    initialState: machine.initialState,
    events: [] as FSTFrom<TMachine>['events'],
    nextEvents
  } as FSTFrom<TMachine>;
}
