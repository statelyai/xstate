import { AnyStateMachine, AnyStateNode } from '../index.ts';

const validateState = (state: AnyStateNode) => {
  // TODO
};

export const validateMachine = (machine: AnyStateMachine) => {
  validateState(machine.root);
};
