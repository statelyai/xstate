import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 100;
const HEARTBEAT_MS = 120;

/**
 * A scripted flaky transport. `session` counts how many times the client has
 * been connected, so the demo can make later sessions behave differently
 * without any network access.
 */
let dials = 0;
const connect = createAsyncLogic({
  run: async ({ input }: { input: { attempt: number } }) => {
    dials++;
    await new Promise((resolve) => setTimeout(resolve, 40));
    // Dial 1 connects. Dials 2 and 3 fail, dial 4 connects. After that the
    // transport is down for good.
    if (dials === 2 || dials === 3 || dials > 4) {
      throw new Error(`ECONNREFUSED (dial ${dials}, attempt ${input.attempt})`);
    }
    return { sessionId: `sess-${dials}` };
  }
});

let pings = 0;
/** Answers a few pings, then stops responding, which reads as a dropped link. */
const ping = createAsyncLogic({
  run: async ({ input }: { input: { sessionId: string } }) => {
    pings++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (pings % 3 === 0) {
      throw new Error(`pong timeout on ${input.sessionId}`);
    }
    return { rtt: 20 };
  }
});

const clientMachine = setup({
  schemas: {
    context: types<{
      attempt: number;
      sessionId: string | null;
      connects: number;
      drops: number;
      lastError: string | null;
    }>()
  },
  guards: {
    canRetry: ({ context }: { context: { attempt: number } }) =>
      context.attempt < MAX_ATTEMPTS
  },
  delays: {
    // Exponential backoff with full jitter, so reconnect storms spread out.
    backoff: ({ context }: { context: { attempt: number } }) =>
      Math.round(
        BASE_BACKOFF_MS * 2 ** (context.attempt - 1) * (0.5 + Math.random() / 2)
      ),
    heartbeat: HEARTBEAT_MS
  },
  actors: { connect, ping }
}).createMachine({
  context: {
    attempt: 0,
    sessionId: null,
    connects: 0,
    drops: 0,
    lastError: null
  },
  initial: 'connecting',
  states: {
    connecting: {
      entry: ({ context }, enq) =>
        enq(log, `connecting (attempt ${context.attempt + 1})`),
      invoke: {
        src: 'connect',
        input: ({ context }) => ({ attempt: context.attempt + 1 }),
        onDone: ({ context, event }, enq) => {
          enq(log, `connected as ${event.output.sessionId}`);
          return {
            target: 'connected',
            context: {
              attempt: 0,
              sessionId: event.output.sessionId,
              connects: context.connects + 1
            }
          };
        },
        onError: ({ context, event, guards }, enq) => {
          const lastError = (event.error as Error).message;
          const attempt = context.attempt + 1;
          enq(log, `  connect failed: ${lastError}`);
          return guards.canRetry({ context: { attempt } })
            ? { target: 'backingOff', context: { attempt, lastError } }
            : { target: 'gaveUp', context: { attempt, lastError } };
        }
      }
    },
    // Heartbeat: `after` fires a ping, and a missing pong drops the link.
    connected: {
      after: { heartbeat: { target: 'pinging' } }
    },
    pinging: {
      invoke: {
        src: 'ping',
        input: ({ context }) => ({ sessionId: context.sessionId! }),
        onDone: ({ context }, enq) => {
          enq(log, `  pong from ${context.sessionId}`);
          // `reenter: true` restarts the heartbeat timer for the next round.
          return { target: 'connected', reenter: true };
        },
        onError: ({ context, event }, enq) => {
          const lastError = (event.error as Error).message;
          enq(log, `  ${lastError} -> disconnected`);
          return {
            target: 'disconnected',
            context: {
              lastError,
              sessionId: null,
              drops: context.drops + 1
            }
          };
        }
      }
    },
    disconnected: {
      always: { target: 'connecting' }
    },
    backingOff: {
      entry: ({ context }, enq) =>
        enq(log, `  backing off before attempt ${context.attempt + 1}`),
      after: { backoff: { target: 'connecting' } }
    },
    gaveUp: {
      entry: ({ context }, enq) =>
        enq(log, `giving up after ${context.attempt} attempts`),
      type: 'final',
      output: ({ context }) => ({
        connects: context.connects,
        drops: context.drops,
        lastError: context.lastError
      })
    }
  }
});

const actor = createActor(clientMachine, { inspect: inspector?.inspect });

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

log(`result: ${JSON.stringify(await toPromise(actor), null, 2)}`);

inspector?.destroy();
