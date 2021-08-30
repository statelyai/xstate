import { createMachine } from 'xstate';

export const machine = createMachine({
  initial: 'wow awesome',
  states: {
    'wow awesome': {}
  }
});
