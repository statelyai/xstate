import { createMachine, createAsyncLogic } from 'xstate';
// https://github.com/serverlessworkflow/specification/tree/main/examples#parallel-execution-example
export const workflow = createMachine({
  actors: {
    shortDelay: createAsyncLogic({
      run: async () => {
        await new Promise<void>((resolve) =>
          setTimeout(() => {
            console.log('Resolved shortDelay');
            resolve();
          }, 1000)
        );
      }
    }),
    longDelay: createAsyncLogic({
      run: async () => {
        await new Promise<void>((resolve) =>
          setTimeout(() => {
            console.log('Resolved longDelay');
            resolve();
          }, 3000)
        );
      }
    })
  },
  id: 'parallel-execution',
  initial: 'ParallelExec',
  states: {
    ParallelExec: {
      type: 'parallel',
      states: {
        ShortDelayBranch: {
          initial: 'active',
          states: {
            active: {
              invoke: {
                src: 'shortDelay',
                onDone: { target: 'done' }
              }
            },
            done: {
              type: 'final'
            }
          }
        },
        LongDelayBranch: {
          initial: 'active',
          states: {
            active: {
              invoke: {
                src: 'longDelay',
                onDone: { target: 'done' }
              }
            },
            done: {
              type: 'final'
            }
          }
        }
      },
      onDone: { target: 'Success' }
    },
    Success: {
      type: 'final'
    }
  }
});
