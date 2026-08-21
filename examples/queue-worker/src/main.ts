import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const MAX_ATTEMPTS = 3;
const CONCURRENCY = 2;

interface Job {
  id: string;
  payload: string;
  /** How many times this job fails before it succeeds. */
  flakiness: number;
}

interface JobResult {
  id: string;
  status: 'done' | 'dead-letter';
  attempts: number;
}

const attemptsSeen = new Map<string, number>();

/** Flaky worker: the first `flakiness` calls for a job reject. */
const runJob = createAsyncLogic({
  run: async ({ input }: { input: { job: Job } }) => {
    const seen = (attemptsSeen.get(input.job.id) ?? 0) + 1;
    attemptsSeen.set(input.job.id, seen);
    await new Promise((resolve) => setTimeout(resolve, 60));
    if (seen <= input.job.flakiness) {
      throw new Error(`transient failure #${seen}`);
    }
    return { output: `${input.job.payload}!` };
  }
});

/** One actor per job: attempt, back off, retry, or dead-letter. */
const jobMachine = setup({
  schemas: {
    context: types<{ job: Job; attempts: number; error: string | null }>(),
    input: types<{ job: Job }>(),
    output: types<JobResult>()
  },
  actors: { runJob },
  guards: {
    canRetry: ({ context }: { context: { attempts: number } }) =>
      context.attempts < MAX_ATTEMPTS
  },
  delays: {
    backoff: ({ context }: { context: { attempts: number } }) =>
      50 * 2 ** context.attempts
  }
}).createMachine({
  context: ({ input }) => ({ job: input.job, attempts: 0, error: null }),
  initial: 'running',
  states: {
    running: {
      invoke: {
        src: 'runJob',
        input: ({ context }) => ({ job: context.job }),
        onDone: ({ context }, enq) => {
          enq(log, `  job ${context.job.id} succeeded`);
          return { target: 'done' };
        },
        onError: ({ context, event, guards }, enq) => {
          const error = (event.error as Error).message;
          const attempts = context.attempts + 1;
          enq(log, `  job ${context.job.id} attempt ${attempts}: ${error}`);
          return guards.canRetry({ context: { attempts } })
            ? { target: 'backingOff', context: { attempts, error } }
            : { target: 'deadLetter', context: { attempts, error } };
        }
      }
    },
    backingOff: {
      after: { backoff: { target: 'running' } }
    },
    done: {
      type: 'final',
      output: ({ context }) => ({
        id: context.job.id,
        status: 'done' as const,
        attempts: context.attempts + 1
      })
    },
    deadLetter: {
      entry: ({ context }, enq) =>
        enq(log, `  job ${context.job.id} moved to the dead-letter queue`),
      type: 'final',
      output: ({ context }) => ({
        id: context.job.id,
        status: 'dead-letter' as const,
        attempts: context.attempts
      })
    }
  }
});

/**
 * The pool pulls from the queue and keeps at most `CONCURRENCY` job actors
 * alive. Everything in `pending` is spawned by the `working` entry action;
 * re-entering `working` refills the pool as jobs settle.
 */
const poolMachine = setup({
  schemas: {
    context: types<{
      queue: Job[];
      pending: Job[];
      active: number;
      results: JobResult[];
    }>(),
    events: { jobSettled: types<{ result: JobResult }>() },
    input: types<{ jobs: Job[] }>()
  }
}).createMachine({
  context: ({ input }) => ({
    queue: input.jobs.slice(CONCURRENCY),
    pending: input.jobs.slice(0, CONCURRENCY),
    active: 0,
    results: []
  }),
  initial: 'working',
  states: {
    working: {
      entry: ({ context }, enq) => {
        for (const job of context.pending) {
          enq(log, `dispatching ${job.id}`);
          const child = enq.spawn(jobMachine, {
            id: `job-${job.id}`,
            input: { job }
          });
          enq.subscribeTo(child, {
            done: (result) => ({ type: 'jobSettled' as const, result })
          });
        }
        return {
          context: {
            active: context.active + context.pending.length,
            pending: []
          }
        };
      },
      on: {
        jobSettled: ({ context, event }) => {
          const results = [...context.results, event.result];
          const active = context.active - 1;
          const slots = CONCURRENCY - active;
          const pending = context.queue.slice(0, slots);
          const queue = context.queue.slice(pending.length);

          // Re-entering `working` re-runs the entry action, which spawns
          // whatever the refill put in `pending`.
          if (pending.length > 0) {
            return {
              target: 'working' as const,
              reenter: true,
              context: { results, active, pending, queue }
            };
          }
          return active === 0
            ? {
                target: 'drained' as const,
                context: { results, active, queue }
              }
            : { context: { results, active, queue } };
        }
      }
    },
    drained: {
      type: 'final',
      output: ({ context }) => ({
        processed: context.results.length,
        deadLettered: context.results.filter((r) => r.status === 'dead-letter')
          .length,
        results: context.results
      })
    }
  }
});

const jobs: Job[] = [
  { id: 'j1', payload: 'resize-avatar', flakiness: 0 },
  { id: 'j2', payload: 'send-receipt', flakiness: 0 },
  { id: 'j3', payload: 'reindex-search', flakiness: 2 },
  { id: 'j4', payload: 'export-csv', flakiness: 0 },
  { id: 'j5', payload: 'charge-card', flakiness: 5 },
  { id: 'j6', payload: 'warm-cache', flakiness: 0 },
  { id: 'j7', payload: 'sync-crm', flakiness: 0 },
  { id: 'j8', payload: 'purge-temp', flakiness: 0 }
];

const actor = createActor(poolMachine, {
  input: { jobs },
  inspect: inspector?.inspect
});

actor.subscribe((snapshot) =>
  log(
    `pool: ${JSON.stringify(snapshot.value)} active=${snapshot.context.active} settled=${snapshot.context.results.length}`
  )
);

actor.start();

log(`summary: ${JSON.stringify(await toPromise(actor), null, 2)}`);

inspector?.destroy();
