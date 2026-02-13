import { assign, createMachine, sendParent } from 'xstate';

type Context = {
  errorCount: number;
  threshold: number;
};

type Events = { type: 'Retry' };

export const RunServiceMachine = createMachine(
  {
    id: 'Run Service',
    initial: 'running',
    types: {} as {
      context: Context;
      events: Events;
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
        entry: ['init'],
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
        entry: ['logNotDone', sendParent({ type: 'NOT_DONE' })],
        type: 'final'
      }
    }
  },
  {
    delays: {
      WaitBeforeRetry: 3000
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
