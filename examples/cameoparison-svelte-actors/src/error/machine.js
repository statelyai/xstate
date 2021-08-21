import { createMachine, sendParent } from 'xstate';

export const errorMachine = createMachine({
  id: 'errorActor',

  on: {
    RETRY: {
      actions: sendParent('RETRY')
    }
  }
});
