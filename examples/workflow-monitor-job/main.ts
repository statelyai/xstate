import { assign, createMachine, fromPromise, interpret } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#monitor-job-example
export const workflow = createMachine(
  {
    id: 'jobmonitoring',
    initial: 'SubmitJob',
    types: {} as {
      context: {
        job: {
          name: string;
        };
        jobuid: string | undefined;
        jobStatus: 'SUCCEEDED' | 'FAILED' | undefined;
      };
    },
    context: ({ input }) => ({
      job: input.job,
      jobuid: undefined,
      jobStatus: undefined
    }),
    states: {
      SubmitJob: {
        invoke: {
          src: 'submitJob',
          input: ({ context }) => ({
            name: context.job.name
          }),
          onDone: {
            target: 'WaitForCompletion',
            actions: assign({
              jobuid: ({ event }) => event.output.jobuid
            })
          }
        }
      },
      WaitForCompletion: {
        after: {
          5000: 'GetJobStatus'
        }
      },
      GetJobStatus: {
        invoke: {
          src: 'checkJobStatus',
          input: ({ context }) => ({
            name: context.jobuid
          }),
          onDone: {
            target: 'DetermineCompletion',
            actions: assign({
              jobStatus: ({ event }) => event.output.jobStatus
            })
          }
        }
      },
      DetermineCompletion: {
        always: [
          {
            guard: ({ context }) => context.jobStatus === 'SUCCEEDED',
            target: 'JobSucceeded'
          },
          {
            guard: ({ context }) => context.jobStatus === 'FAILED',
            target: 'JobFailed'
          },
          {
            target: 'WaitForCompletion'
          }
        ]
      },
      JobSucceeded: {
        invoke: {
          src: 'reportJobSucceeded',
          onDone: 'End'
        }
      },
      JobFailed: {
        invoke: {
          src: 'reportJobFailed',
          onDone: 'End'
        }
      },
      End: {
        type: 'final'
      }
    }
  },
  {
    actors: {
      submitJob: fromPromise(({ input }) => {
        console.log('Starting submitJob', input);
        return Promise.resolve({ jobuid: '123' });
      }),
      checkJobStatus: fromPromise(({ input }) => {
        console.log('Starting checkJobStatus', input);
        return Promise.resolve({ jobStatus: 'SUCCEEDED' });
      }),
      reportJobSucceeded: fromPromise(({ input }) => {
        console.log('Starting reportJobSucceeded', input);
        return Promise.resolve();
      }),
      reportJobFailed: fromPromise(({ input }) => {
        console.log('Starting reportJobFailed', input);
        return Promise.resolve();
      })
    }
  }
);

const actor = interpret(workflow, {
  input: {
    job: {
      name: 'job1'
    }
  }
});

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();
