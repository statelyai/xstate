import { Machine, Node, State } from '../src/index';

export function testMultiTransition(
  machine: Machine,
  fromState: string,
  actionTypes: string
) {
  const resultState = actionTypes
    .split(/,\s?/)
    .reduce((state: State | string, actionType) => {
      const nextState = machine.transition(state, actionType);
      return nextState;
    }, fromState);

  return resultState as State;
}
