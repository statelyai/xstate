import { assign, createMachine, fromCallback } from 'xstate';

export const timerMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBcCWBbMAnAsgQwGMALVAOzAAIAKdQk8gSgDpZkB7ABw8gGJW8syANoAGALqJQHNrFRo2pSSAAeiACwiAbEwCMI-QCZNBgOwBOTQA4zlkwBoQAT0SWRBpgf0iAzJctqTAFY1TTMAXzCHNExcOjJKGjjGFnYuXnQyAFdkMFEJJBBpWXlFAtUEAwMdD0CvcwM-Mx0TbwdnBADtPUNak2bAnR1vCKiMbHxieOpaSeTWTm4IPjACBQg8pSK5VAUlcsrqg1r9esbm1qdEbyOmY5Fmy0DjG00RkGjxpISZ+jBmLEypFIZCgfFSGwKWxKe3UIhMui8Rm8mk0gUsOksbUQfXcnn03kC3j6lisajeH1is2+X3+gOBpFBABUAJIAYQA0hCpDJtrsyog9E8mKj9BYDGpvN4tPZLghNCY1EwvD4jpodAdLOSxpTftMaUwAUCQTw8AAbADueEcsC5hR50P5HR8wrMRJMmjhWi0OixcqMTBMXmuDRMnmRWpiE11iSpDB4WDgYGE4k29p2pVA5XVvsCBgikRApDYEDgSgpUamMd+DFTxXTMIQAFo1JjZY2dLmmGYvHpNBp-B7XgXy189bGUgtILXeRmVIgPb6Cd4mJZJQSGk9-JUI58qWPqwa6SDpw7M9i9B4jiJc-1XCZW+1UZYPEHpWZA+L82EgA */
  types: {} as {
    events:
      | { type: 'start' }
      | { type: 'stop' }
      | { type: 'reset' }
      | { type: 'minute' }
      | { type: 'second' }
      | { type: 'TICK' };
  },
  context: {
    seconds: 0
  },
  initial: 'stopped',
  states: {
    stopped: {
      on: {
        start: {
          guard: ({ context }) => context.seconds > 0,
          target: 'running'
        },
        minute: {
          actions: assign({
            seconds: ({ context }) => context.seconds + 60
          })
        },
        second: {
          actions: assign({
            seconds: ({ context }) => context.seconds + 1
          })
        }
      }
    },
    running: {
      invoke: {
        src: fromCallback(({ sendBack }) => {
          const interval = setInterval(() => {
            sendBack({ type: 'TICK' });
          }, 1000);
          return () => clearInterval(interval);
        })
      },
      on: {
        stop: 'stopped',
        TICK: {
          actions: assign({
            seconds: ({ context }) => context.seconds - 1
          })
        }
      },
      always: {
        guard: ({ context }) => context.seconds === 0,
        target: 'stopped'
      }
    }
  },
  on: {
    reset: {
      guard: ({ context }) => context.seconds > 0,
      actions: assign({
        seconds: 0
      })
    }
  }
});
