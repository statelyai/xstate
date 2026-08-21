import { createActor, setup, toPromise, types } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const CAPACITY = 3;
const REFILL_MS = 200;
const EXPECTED = 10;

/**
 * A token bucket as a machine: `after` refills, a guard decides whether an
 * `acquire` is granted immediately, and anything that is not granted waits in
 * a queue until a refill releases it.
 */
const limiterMachine = setup({
  schemas: {
    context: types<{
      tokens: number;
      waiting: string[];
      granted: string[];
    }>(),
    events: { acquire: types<{ id: string }>() }
  },
  guards: {
    hasToken: (tokens: number) => tokens > 0
  },
  delays: { refill: REFILL_MS }
}).createMachine({
  context: { tokens: CAPACITY, waiting: [], granted: [] },
  initial: 'open',
  states: {
    open: {
      // `reenter: true` restarts the `after` timer on every refill, so the
      // bucket keeps ticking instead of firing once.
      after: {
        refill: ({ context }, enq) => {
          if (context.tokens >= CAPACITY && context.waiting.length === 0) {
            return { target: 'open', reenter: true };
          }
          const [next, ...waiting] = context.waiting;
          if (next) {
            enq(log, `refill -> released ${next} (waiting ${waiting.length})`);
            return {
              target: 'open',
              reenter: true,
              context: { waiting, granted: [...context.granted, next] }
            };
          }
          const tokens = context.tokens + 1;
          enq(log, `refill -> tokens ${tokens}`);
          return { target: 'open', reenter: true, context: { tokens } };
        }
      },
      on: {
        acquire: ({ context, event, guards }, enq) => {
          if (guards.hasToken(context.tokens)) {
            enq(log, `granted ${event.id} (tokens left ${context.tokens - 1})`);
            return {
              context: {
                tokens: context.tokens - 1,
                granted: [...context.granted, event.id]
              }
            };
          }
          enq(
            log,
            `queued ${event.id} (waiting ${context.waiting.length + 1})`
          );
          return { context: { waiting: [...context.waiting, event.id] } };
        }
      },
      always: ({ context }) =>
        context.granted.length === EXPECTED ? { target: 'drained' } : undefined
    },
    drained: {
      type: 'final',
      output: ({ context }) => ({
        granted: context.granted,
        tokensLeft: context.tokens
      })
    }
  }
});

const actor = createActor(limiterMachine, { inspect: inspector?.inspect });

actor.subscribe((snapshot) =>
  log(
    `bucket: tokens=${snapshot.context.tokens} waiting=${snapshot.context.waiting.length} granted=${snapshot.context.granted.length}`
  )
);

actor.start();

// A burst of 10 requests against a bucket that holds 3.
for (let i = 1; i <= EXPECTED; i++) {
  actor.send({ type: 'acquire', id: `req-${i}` });
}

log(`result: ${JSON.stringify(await toPromise(actor), null, 2)}`);

inspector?.destroy();
