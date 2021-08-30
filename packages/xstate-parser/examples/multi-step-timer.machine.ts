import { createMachine } from 'xstate';

export type MultiStepTimerMachineContext = {};

export type MultiStepTimerMachineEvent = {
  type: 'BEGIN';
};

const multiStepTimerMachine = createMachine<
  MultiStepTimerMachineContext,
  MultiStepTimerMachineEvent
>({
  id: 'multiStepTimer',
  initial: 'idle',
  states: {
    idle: {
      on: {
        BEGIN: {
          target: 'firstStep'
        }
      }
    },
    firstStep: {
      after: {
        3000: { target: 'secondStep' }
      }
    },
    secondStep: {
      after: {
        3000: { target: 'thirdStep' }
      }
    },
    thirdStep: {
      after: {
        3000: { target: 'idle' }
      }
    }
  }
});

export default multiStepTimerMachine;
