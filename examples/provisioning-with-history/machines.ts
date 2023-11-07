import { createMachine } from 'xstate';

export const UpDownMaschine = createMachine({
  id: 'UpDownMaschine',
  initial: 'Init',
  states: {
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
      initial: 'Clone collection',
      states: {
        'Clone collection': {
          invoke: {
            src: 'cloneCollection',
            id: 'cloneCollection',
            onDone: [
              {
                target: 'Recreate indexes'
              }
            ]
          }
        },
        'Recreate indexes': {
          invoke: {
            src: 'recreateIndexes',
            id: 'recreateIndexes',
            onDone: [
              {
                target: 'Create new List'
              }
            ]
          }
        },
        'Create new List': {
          invoke: {
            src: 'createNewList',
            id: 'createNewList',
            onDone: [
              {
                target: 'Update sample data'
              }
            ]
          }
        },
        'Update sample data': {
          invoke: {
            src: 'updateSampleDate',
            id: 'updateSampleDate',
            onDone: [
              {
                target: 'copy views'
              }
            ]
          }
        },
        'copy views': {
          invoke: {
            src: 'copyViews',
            id: 'copyViews',
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
      initial: 'Delete collection',
      states: {
        'Delete collection': {
          invoke: {
            src: 'deleteCollection',
            id: 'deleteCollection',
            onDone: [
              {
                target: 'Delete List'
              }
            ]
          }
        },
        'Delete List': {
          invoke: {
            src: 'deleteList',
            id: 'deleteList',
            onDone: [
              {
                target: 'Delete Views'
              }
            ]
          }
        },
        'Delete Views': {
          invoke: {
            src: 'deleteViews',
            id: 'deleteViews',
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

export const RunServiceMachine = createMachine(
  {
    id: 'Run Service',
    initial: 'running',
    types: { events: {} as { type: 'Retry' } },
    states: {
      done: {
        entry: ['logDone'],
        type: 'final'
      },
      error: {
        // todo: Retry count and 5, 10, 30 sec delay
        entry: ['logError'],
        after: {
          WaitBeforeRetry: { target: 'running' }
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
      }
    }
  },
  {
    delays: {
      WaitBeforeRetry: 5000
    },
    actions: {
      logDone: ({ self }) => console.log('---rs:  done', self.id),
      logError: ({ self }) => console.log('---rs: error', self.id),
      logRunning: ({ self }) => console.log('---rs: init', self.id)
    }
  }
);
