import { createMachine } from 'xstate';

export const machine = createMachine(
  {
    after: {
      DELAY_NAME: {
        actions: () => {
          console.log('Yay');
        }
      }
    }
  },
  {
    delays: {
      DELAY_NAME: 200
    }
  }
);
