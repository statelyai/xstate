import { createMachine } from 'xstate';

export const UpDownMaschine = createMachine({
  id: 'UpDownMaschine',
  initial: 'Init',
  on: {
    NOT_DONE: {
      target: '.NotDone'
    }
  },
  states: {
    NotDone: {
      type: 'final'
    },
    Init: {
      on: {
        UP: {
          target: 'Up'
        },
        DOWN: {
          target: 'Down'
        }
      }
    },
    Up: {
      initial: 'Step1 system1',
      states: {
        'Step1 system1': {
          invoke: {
            src: 'up-step1-system1',
            id: 'up-step1-system1',
            onDone: [
              {
                target: 'Step2 system1'
              }
            ]
          }
        },
        'Step2 system1': {
          invoke: {
            src: 'up-step2-system1',
            id: 'up-step2-system1',
            onDone: [
              {
                target: 'Step3 system2'
              }
            ]
          }
        },
        'Step3 system2': {
          invoke: {
            src: 'up-step3-system2',
            id: 'up-step3-system2',
            onDone: [
              {
                target: 'Step4 System1'
              }
            ]
          }
        },
        'Step4 System1': {
          invoke: {
            src: 'up-step4-system1',
            id: 'up-step4-system1',
            onDone: [
              {
                target: 'Step5 system3'
              }
            ]
          }
        },
        'Step5 system3': {
          invoke: {
            src: 'up-step5-system3',
            id: 'up-step5-system3',
            onDone: [
              {
                target: 'Done'
              }
            ]
          }
        },
        Done: {
          type: 'final'
        }
      }
    },
    Down: {
      initial: 'Step1 system1',
      states: {
        'Step1 system1': {
          invoke: {
            src: 'down-step1-system1',
            id: 'down-step1-system1',
            onDone: [
              {
                target: 'Step2 system2'
              }
            ]
          }
        },
        'Step2 system2': {
          invoke: {
            src: 'down-step2-system2',
            id: 'down-step2-system2',
            onDone: [
              {
                target: 'Step3 system3'
              }
            ]
          }
        },
        'Step3 system3': {
          invoke: {
            src: 'down-step3-system3',
            id: 'down-step3-system3',
            onDone: [
              {
                target: 'Done'
              }
            ]
          }
        },
        Done: {
          type: 'final'
        }
      }
    }
  }
});
