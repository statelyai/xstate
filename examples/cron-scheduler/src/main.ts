import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const TICK_MS = 200;
const TOTAL_TICKS = 5;

interface Schedule {
  name: string;
  /** Run whenever `tick % everyTicks === 0`. */
  everyTicks: number;
  /** How long one run takes, in ticks. */
  durationMs: number;
}

/** One run of a scheduled task. */
const task = createAsyncLogic({
  run: async ({ input }: { input: { name: string; durationMs: number } }) => {
    await new Promise((resolve) => setTimeout(resolve, input.durationMs));
    return { name: input.name };
  }
});

const schedules: Schedule[] = [
  { name: 'heartbeat', everyTicks: 1, durationMs: 50 },
  // Runs longer than its interval, so the overlap policy has to skip a run.
  { name: 'nightly-report', everyTicks: 2, durationMs: 900 },
  { name: 'cleanup', everyTicks: 3, durationMs: 40 }
];

const schedulerMachine = setup({
  schemas: {
    context: types<{
      schedules: Schedule[];
      tick: number;
      /** Names of schedules whose previous run has not finished. */
      running: string[];
      due: Schedule[];
      skipped: string[];
      completed: string[];
    }>(),
    events: {
      runFinished: types<{ name: string }>(),
      pause: types<{}>(),
      resume: types<{}>()
    }
  },
  delays: { tick: TICK_MS }
}).createMachine({
  context: {
    schedules,
    tick: 0,
    running: [],
    due: [],
    skipped: [],
    completed: []
  },
  initial: 'waiting',
  states: {
    waiting: {
      after: {
        tick: ({ context }, enq) => {
          const tick = context.tick + 1;
          if (tick > TOTAL_TICKS) {
            return context.running.length === 0
              ? { target: 'stopped' }
              : { target: 'draining', context: { tick } };
          }
          enq(log, `tick ${tick}`);
          // Overlap policy: a schedule that is still running is skipped.
          const candidates = context.schedules.filter(
            (schedule) => tick % schedule.everyTicks === 0
          );
          const due = candidates.filter(
            (schedule) => !context.running.includes(schedule.name)
          );
          const skipped = candidates
            .filter((schedule) => context.running.includes(schedule.name))
            .map((schedule) => `${schedule.name}@${tick}`);
          for (const name of skipped) {
            enq(log, `  skipped ${name}: previous run still active`);
          }
          return {
            target: 'firing',
            context: {
              tick,
              due,
              skipped: [...context.skipped, ...skipped]
            }
          };
        }
      },
      on: {
        pause: { target: 'paused' },
        runFinished: ({ context, event }, enq) => {
          enq(log, `  finished ${event.name}`);
          return {
            context: {
              running: context.running.filter((name) => name !== event.name),
              completed: [...context.completed, event.name]
            }
          };
        }
      }
    },
    // Spawning happens in an entry action, which is where `enq.subscribeTo`
    // can route each run's completion back to the scheduler.
    firing: {
      entry: ({ context }, enq) => {
        for (const schedule of context.due) {
          enq(log, `  starting ${schedule.name}`);
          const child = enq.spawn(task, {
            id: `${schedule.name}-${context.tick}`,
            input: { name: schedule.name, durationMs: schedule.durationMs }
          });
          enq.subscribeTo(child, {
            done: (output) => ({
              type: 'runFinished' as const,
              name: output.name
            })
          });
        }
      },
      always: ({ context }) => ({
        target: 'waiting',
        context: {
          running: [...context.running, ...context.due.map((s) => s.name)],
          due: []
        }
      })
    },
    paused: {
      entry: (_, enq) => enq(log, 'paused'),
      on: {
        resume: ({}, enq) => {
          enq(log, 'resumed');
          return { target: 'waiting' };
        },
        runFinished: ({ context, event }) => ({
          context: {
            running: context.running.filter((name) => name !== event.name),
            completed: [...context.completed, event.name]
          }
        })
      }
    },
    // No more ticks; wait for in-flight runs before finishing.
    draining: {
      on: {
        runFinished: ({ context, event }, enq) => {
          enq(log, `  finished ${event.name}`);
          const running = context.running.filter((n) => n !== event.name);
          const completed = [...context.completed, event.name];
          return running.length === 0
            ? { target: 'stopped', context: { running, completed } }
            : { context: { running, completed } };
        }
      }
    },
    stopped: {
      type: 'final',
      output: ({ context }) => ({
        ticks: TOTAL_TICKS,
        completed: context.completed,
        skipped: context.skipped
      })
    }
  }
});

const actor = createActor(schedulerMachine, { inspect: inspector?.inspect });

actor.subscribe((snapshot) =>
  log(
    `scheduler: ${JSON.stringify(snapshot.value)} running=[${snapshot.context.running.join(',')}]`
  )
);

actor.start();

// Pause in the middle of the run, then resume a tick later.
setTimeout(() => actor.send({ type: 'pause' }), TICK_MS * 2.5);
setTimeout(() => actor.send({ type: 'resume' }), TICK_MS * 3.5);

log(`summary: ${JSON.stringify(await toPromise(actor), null, 2)}`);

inspector?.destroy();
