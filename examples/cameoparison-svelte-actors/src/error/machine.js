import { createMachine, sendParent } from 'xstate';

export const errorMachine = createMachine({
  id: 'errorActor',

  initial: 'idle',
  states: {
    idle: {
      on: {
        RETRY: {
          actions: sendParent('RETRY')
        }
      }
    }
  }
});
