import { AnyStateMachine, AnyStateNode } from 'xstate';

function getStates(state: AnyStateNode) {
  return [state].concat(
    Object.keys(state.states).flatMap((stateKey) => {
      return getStates(state.states[stateKey]);
    })
  );
}

export const validateMachine = (machine: AnyStateMachine) => {
  const states = getStates(machine.root);

  states.forEach((state) => {
    if (state.invoke.length > 0) {
      throw new Error('Invocations on test machines are not supported');
    }
    if (state.after.length > 0) {
      throw new Error('After events on test machines are not supported');
    }
    const actions = [...state.entry, ...state.exit];

    state.transitions.forEach((transition) => {
      actions.push(...transition.actions);
    });

    actions.forEach((action) => {
      if (
        action.type.startsWith('xstate.') &&
        typeof (action as any).params.delay === 'number'
      ) {
        throw new Error('Delayed actions on test machines are not supported');
      }
    });
  });
};
