import { AnyStateMachine } from 'xstate';

export const validateMachine = (machine: AnyStateMachine) => {
  const states = machine.stateIds.map((stateId) =>
    machine.getStateNodeById(stateId)
  );

  states.forEach((state) => {
    if (state.invoke.length > 0) {
      throw new Error('Invocations on test machines are not supported');
    }
    if (state.after.length > 0) {
      throw new Error('After events on test machines are not supported');
    }
    const actions = [...state.onEntry, ...state.onExit];

    state.transitions.forEach((transition) => {
      actions.push(...transition.actions);
    });

    actions.forEach((action) => {
      if (
        action.type.startsWith('xstate.') &&
        typeof (action as any).delay === 'number'
      ) {
        throw new Error('Delayed actions on test machines are not supported');
      }
    });
  });
};
