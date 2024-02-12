import { fromPromise, createActor, setup } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#parallel-execution-example
export const workflow = setup({
  actors: {
    shortDelay: fromPromise(async () => {
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          console.log('Resolved shortDelay');
          resolve();
        }, 1000)
      );
    }),
    longDelay: fromPromise(async () => {
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          console.log('Resolved longDelay');
          resolve();
        }, 3000)
      );
    })
  }
}).createMachine({
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
                onDone: 'done'
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
                onDone: 'done'
              }
            },
            done: {
              type: 'final'
            }
          }
        }
      },
      onDone: 'Success'
    },
    Success: {
      type: 'final'
    }
  }
});

const actor = createActor(workflow);

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();
