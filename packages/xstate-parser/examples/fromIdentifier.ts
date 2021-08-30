import { createMachine, MachineConfig } from 'xstate';

const config: MachineConfig<any, any, any> = {
  on: {
    NEXT: {
      target: '.next'
    }
  },
  states: {
    idle: {},
    next: {}
  }
};

export const machine = createMachine(config);
