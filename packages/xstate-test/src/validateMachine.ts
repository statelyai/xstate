import { AnyStateMachine } from 'xstate';

export const validateMachine = (machine: AnyStateMachine) => {
  const states = machine.root.stateIds.map((stateId) =>
    machine.getStateNodeById(stateId)
  );

  states.forEach((state) => {
    if (state.invoke.length > 0) {
      throw new Error('Invocations on test machines are not supported');
    }
    if (state.after.length > 0) {
      throw new Error('After events on test machines are not supported');
    }
    // TODO: this doesn't account for always transitions
    [
      ...state.entry,
      ...state.exit,
      ...[...state.transitions.values()].flatMap((t) =>
        t.flatMap((t) => t.actions)
      )
    ].forEach((action) => {
      if (
        action.type.startsWith('xstate.') &&
        typeof (action as any).params.delay === 'number'
      ) {
        throw new Error('Delayed actions on test machines are not supported');
      }
    });
  });
};
