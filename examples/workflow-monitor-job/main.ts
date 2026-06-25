import { createMachine, createAsyncLogic, createActor } from 'xstate';
import { z } from 'zod';
interface Job {
  name: string;
}
// https://github.com/serverlessworkflow/specification/tree/main/examples#monitor-job-example
export const workflow = createMachine({
  types: {
    context: {} as {
      job: Job;
      jobuid: string | undefined;
      jobStatus: 'SUCCEEDED' | 'FAILED' | undefined;
    },
    input: {} as {
      job: Job;
    }
  },
  actorSources: {
    submitJob: createAsyncLogic({
      schemas: {
        input: z.custom<{
          name: string;
        }>()
      },
      run: async ({ input }) => {
        console.log('Starting submitJob', input);
        return { jobuid: '123' };
      }
    }),
    checkJobStatus: createAsyncLogic({
      schemas: {
        input: z.custom<{
          name: string;
        }>()
      },
      run: async ({ input }) => {
        console.log('Starting checkJobStatus', input);
        return { jobStatus: 'SUCCEEDED' as const };
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
        onDone: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'WaitForCompletion',
            context: {
              ...context,
              jobuid: (({ event }) => event.output.jobuid)({
                context: context,
                event: event
              })
            }
          };
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
        onDone: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'DetermineCompletion',
            context: {
              ...context,
              jobStatus: (({ event }) => event.output.jobStatus)({
                context: context,
                event: event
              })
            }
          };
        }
      }
    },
    DetermineCompletion: {
      always: [
        ({ context, event, guards, actions }, enq) => {
          if (
            !(({ context }) => context.jobStatus === 'SUCCEEDED')({
              context,
              event
            })
          ) {
            return;
          }
          return { target: 'JobSucceeded' };
        },
        ({ context, event, guards, actions }, enq) => {
          if (
            !(({ context }) => context.jobStatus === 'FAILED')({
              context,
              event
            })
          ) {
            return;
          }
          return { target: 'JobFailed' };
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
});
const actor = createActor(workflow, {
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
