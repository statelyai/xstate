import {
  createActor,
  setup,
  toPromise,
  types,
  createEventObservableLogic
} from 'xstate';
import { concat, interval, map, take, throwError } from 'rxjs';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

type Reading = { type: 'reading'; value: number };

/**
 * A websocket-like feed: one value every 300ms. The stream completes after
 * `count` values, or errors instead when `fail` is set, so both terminal paths
 * can be demonstrated.
 */
const sensorFeed = createEventObservableLogic({
  schemas: { input: types<{ count: number; fail: boolean }>() },
  run: ({ input }) => {
    const readings = interval(300).pipe(
      map((index): Reading => ({ type: 'reading', value: 20 + index })),
      take(input.count)
    );

    return input.fail
      ? concat(
          readings,
          throwError(() => new Error('feed dropped'))
        )
      : readings;
  }
});

const machine = setup({
  schemas: {
    context: types<{
      count: number;
      fail: boolean;
      readings: number[];
      error: string | null;
    }>(),
    events: {
      reading: types<{ value: number }>(),
      pause: types<{}>(),
      resume: types<{}>()
    },
    input: types<{ count: number; fail: boolean }>()
  },
  actors: { sensorFeed }
}).createMachine({
  id: 'monitor',
  context: ({ input }) => ({
    count: input.count,
    fail: input.fail,
    readings: [],
    error: null
  }),
  initial: 'streaming',
  states: {
    // Entering this state subscribes to the observable; leaving it
    // unsubscribes. The machine owns the subscription, not the stream.
    streaming: {
      invoke: {
        src: sensorFeed,
        input: ({ context }) => ({ count: context.count, fail: context.fail }),
        // The observable completing and erroring are ordinary actor outcomes.
        onDone: { target: 'completed' },
        onError: ({ event }) => ({
          target: 'failed',
          context: { error: (event.error as Error).message }
        })
      },
      on: {
        // An event observable sends its emitted event objects to this machine.
        reading: ({ context, event }) => ({
          context: { readings: [...context.readings, event.value] }
        }),
        pause: { target: 'paused' }
      }
    },
    paused: {
      // No invoke here, so nothing is subscribed while paused. `resume`
      // re-enters `streaming` and subscribes to a fresh observable.
      on: { resume: { target: 'streaming' } }
    },
    completed: {
      type: 'final',
      output: ({ context }) => ({ readings: context.readings, error: null })
    },
    failed: {
      type: 'final',
      output: ({ context }) => ({
        readings: context.readings,
        error: context.error
      })
    }
  }
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(
  label: string,
  input: { count: number; fail: boolean },
  interrupt = false
) {
  log(`--- ${label}`);

  const actor = createActor(machine, { input, inspect: inspector?.inspect });

  actor.subscribe((snapshot) =>
    log(
      `state: ${JSON.stringify(snapshot.value)} readings: ${snapshot.context.readings.join(', ')}`
    )
  );

  actor.start();

  if (interrupt) {
    // Unsubscribe mid-stream, wait past two would-be readings, resubscribe.
    await sleep(500);
    actor.send({ type: 'pause' });
    await sleep(700);
    actor.send({ type: 'resume' });
  }

  log(`done: ${JSON.stringify(await toPromise(actor))}`);
}

await run('stream completes', { count: 3, fail: false });
await run(
  'pause unsubscribes, resume restarts the stream',
  {
    count: 3,
    fail: false
  },
  true
);
await run('stream errors', { count: 2, fail: true });

inspector?.destroy();
