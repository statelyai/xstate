import { types, createMachine, createAsyncLogic } from 'xstate';
interface Job {
  name: string;
}
// https://github.com/serverlessworkflow/specification/tree/main/examples#monitor-job-example
export const workflow = createMachine({
  schemas: {
    context: types<{
      job: Job;
      jobuid: string | undefined;
      jobStatus: 'SUCCEEDED' | 'FAILED' | undefined;
    }>(),
    input: types<{
      job: Job;
    }>()
  },
  actors: {
    submitJob: createAsyncLogic({
      schemas: {
        input: types<{
          name: string;
        }>()
      },
      run: ({ input }) => {
        console.log('Starting submitJob', input);
        return Promise.resolve({ jobuid: '123' });
      }
    }),
    checkJobStatus: createAsyncLogic({
      schemas: {
        input: types<{
          name: string;
        }>()
      },
      run: ({ input }): Promise<{ jobStatus: 'SUCCEEDED' | 'FAILED' }> => {
        console.log('Starting checkJobStatus', input);
        return Promise.resolve({ jobStatus: 'SUCCEEDED' as const });
      }
    }),
    reportJobSucceeded: createAsyncLogic({
      run: ({ input }) => {
        console.log('Starting reportJobSucceeded', input);
        return Promise.resolve();
      }
    }),
    reportJobFailed: createAsyncLogic({
      run: ({ input }) => {
        console.log('Starting reportJobFailed', input);
        return Promise.resolve();
      }
    })
  },
  id: 'jobmonitoring',
  initial: 'SubmitJob',
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
        onDone: ({ context, event }) => {
          return {
            target: 'WaitForCompletion',
            context: {
              ...context,
              jobuid: event.output.jobuid
            }
          };
        }
      }
    },
    WaitForCompletion: {
      after: {
        5000: { target: 'GetJobStatus' }
      }
    },
    GetJobStatus: {
      invoke: {
        src: 'checkJobStatus',
        input: ({ context }) => ({
          name: context.jobuid
        }),
        onDone: ({ context, event }) => {
          return {
            target: 'DetermineCompletion',
            context: {
              ...context,
              jobStatus: event.output.jobStatus
            }
          };
        }
      }
    },
    DetermineCompletion: {
      always: ({ context }) => {
        if (context.jobStatus === 'SUCCEEDED') {
          return { target: 'JobSucceeded' };
        }
        if (context.jobStatus === 'FAILED') {
          return { target: 'JobFailed' };
        }
        return {
          target: 'WaitForCompletion'
        };
      }
    },
    JobSucceeded: {
      invoke: {
        src: 'reportJobSucceeded',
        onDone: { target: 'End' }
      }
    },
    JobFailed: {
      invoke: {
        src: 'reportJobFailed',
        onDone: { target: 'End' }
      }
    },
    End: {
      type: 'final'
    }
  }
});
