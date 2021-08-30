import { createMachine } from 'xstate';

const machine = createMachine({
  initial: 'idle',
  states: {
    idle: {}
  }
});
