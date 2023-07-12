import {
  assign,
  createMachine,
  fromPromise,
  sendParent
} from '../../packages/core/src/index.ts';

export async function delay(
  ms: number,
  errorProbability: number = 0
): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < errorProbability) {
        reject({ type: 'ServiceNotAvailable' });
      } else {
        resolve();
      }
    }, ms);
  });
}

export async function createActors(machine: any, errorProbability = 0.6) {
  const services: Record<string, any> = {
    fromPromise1: fromPromise(() => {
      return delay(10);
    }),
    fromPromise2: fromPromise(() => {
      // This service might fail
      return delay(10, errorProbability);
    }),
    fromPromise3: fromPromise(() => {
      return delay(10);
    })
  };

  const actors: Record<string, any> = {};
  Object.keys(services).forEach(
    (key) =>
      (actors[key] = machine.provide({
        actors: { upDownService: services[key] }
      }))
  );
  return actors;
}
export const parentMachine = createMachine({
  id: 'ParentMaschine',
  initial: 'Init',
  types: {} as {
    events: { type: 'UP' } | { type: 'NOT_DONE' };
  },
  states: {
    Init: {
      on: {
        UP: {
          target: 'Up'
        }
      }
    },
    Up: {
      initial: 'Step1',
      on: {
        NOT_DONE: {
          target: '.NotDone'
        }
      },
      states: {
        Step1: {
          invoke: {
            src: 'fromPromise1',
            id: 'step1',
            onDone: [
              {
                target: 'Step2'
              }
            ]
          }
        },
        Step2: {
          invoke: {
            src: 'fromPromise2',
            id: 'step2',
            onDone: [
              {
                target: 'Step3'
              }
            ]
          }
        },
        Step3: {
          invoke: {
            src: 'fromPromise3',
            id: 'step3',
            onDone: [
              {
                target: 'Done'
              }
            ]
          }
        },
        Done: {
          type: 'final'
        },
        NotDone: {
          type: 'final'
        }
      }
    }
  }
});

export const runServiceMachine = createMachine(
  {
    id: 'RunServiceMachine',
    initial: 'running',
    types: {} as {
      context: {
        errorCount: number;
        threshold: number;
      };
      events: { type: 'Retry' };
    },
    context: ({ input }) => {
      return {
        errorCount: 0,
        threshold: input?.threshold ? input.threshold : 3
      };
    },
    states: {
      done: {
        entry: ['logDone'],
        type: 'final'
      },
      error: {
        entry: ['logError', 'updateCounter'],
        after: {
          WaitBeforeRetry: [
            { guard: 'exceedsThreshold', target: 'notDone' },
            { target: 'running' }
          ]
        },
        on: {
          // Manual retry
          Retry: {
            target: 'running'
          }
        }
      },
      running: {
        entry: ['logRunning'],
        invoke: {
          src: 'upDownService',
          id: 'upDownService',
          onDone: [
            {
              target: 'done'
            }
          ],
          onError: [
            {
              target: 'error'
            }
          ]
        }
      },
      notDone: {
        type: 'final',
        entry: ['logNotDone', sendParent({ type: 'NOT_DONE' })]
      }
    }
  },
  {
    delays: {
      WaitBeforeRetry: 20
    },
    actions: {
      logNotDone: ({ self }) => console.log('---rs:  notDone', self.id),
      logDone: ({ self }) => console.log('---rs:  done', self.id),
      logError: ({ self }) => console.log('---rs: error', self.id),
      logRunning: ({ self }) => console.log('---rs: init', self.id),
      updateCounter: assign({
        errorCount: ({ context }) => context.errorCount + 1
      })
    },
    guards: {
      exceedsThreshold: ({ context }) => {
        return context.errorCount > 3;
      }
    }
  }
);
