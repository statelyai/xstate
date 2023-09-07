import { AnyStateMachine, AnyStateNode } from 'xstate';

const validateState = (state: AnyStateNode) => {
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
    // TODO: this doesn't check referenced actions, only the inline ones
    if (
      typeof action === 'function' &&
      'resolve' in action &&
      typeof (action as any).delay === 'number'
    ) {
      throw new Error('Delayed actions on test machines are not supported');
    }
  });

  for (const child of Object.values(state.states)) {
    validateState(child);
  }
};

export const validateMachine = (machine: AnyStateMachine) => {
  validateState(machine.root);
};
