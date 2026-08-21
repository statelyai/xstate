import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

/** Fake job API: the job reports `succeeded` on the third poll. */
const statuses: JobStatus[] = ['pending', 'running', 'succeeded'];
let polls = 0;

const submitJob = createAsyncLogic({
  run: async ({ input }: { input: { name: string } }) => {
    log(`submitting job "${input.name}"`);
    return { jobId: 'job-42' };
  }
});

const getJobStatus = createAsyncLogic({
  run: async ({ input }: { input: { jobId: string } }) => {
    const status = statuses[Math.min(polls++, statuses.length - 1)];
    log(`poll #${polls} of ${input.jobId} -> ${status}`);
    return { status };
  }
});

const machine = setup({
  schemas: {
    context: types<{
      name: string;
      jobId: string | null;
      status: JobStatus;
      polls: number;
    }>(),
    input: types<{ name: string }>()
  },
  delays: { pollInterval: 500 },
  actors: { getJobStatus, submitJob }
}).createMachine({
  context: ({ input }) => ({
    name: input.name,
    jobId: null,
    status: 'pending',
    polls: 0
  }),
  initial: 'submitting',
  states: {
    submitting: {
      invoke: {
        src: 'submitJob',
        input: ({ context }) => ({ name: context.name }),
        onDone: ({ event }) => ({
          target: 'polling',
          context: { jobId: event.output.jobId }
        })
      }
    },
    // Wait, then check again. The loop lives in the machine, not in a `while`.
    polling: {
      after: { pollInterval: { target: 'checking' } }
    },
    checking: {
      invoke: {
        src: 'getJobStatus',
        input: ({ context }) => ({ jobId: context.jobId! }),
        onDone: ({ context, event }) => {
          const status = event.output.status;
          const next = { status, polls: context.polls + 1 };
          if (status === 'succeeded') {
            return { target: 'succeeded', context: next };
          }
          if (status === 'failed') {
            return { target: 'failed', context: next };
          }
          return { target: 'polling' as const, context: next };
        }
      }
    },
    succeeded: {
      type: 'final',
      output: ({ context }) => ({ jobId: context.jobId, polls: context.polls })
    },
    failed: {
      type: 'final',
      output: ({ context }) => ({ jobId: context.jobId, polls: context.polls })
    }
  }
});

const actor = createActor(machine, {
  input: { name: 'nightly-report' },
  inspect: inspector?.inspect
});

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

log(`done: ${JSON.stringify(await toPromise(actor))}`);

inspector?.destroy();
