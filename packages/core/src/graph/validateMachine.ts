import { AnyStateMachine, AnyStateNode } from '../index.ts';

const validateState = (_state: AnyStateNode) => {
  // TODO
};

export const validateMachine = (machine: AnyStateMachine) => {
  validateState(machine.root);
};
