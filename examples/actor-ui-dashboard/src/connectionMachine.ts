import { createAsyncLogic, setup, types } from 'xstate';

const MAX_ATTEMPTS = 4;

/**
 * A plain predicate rather than a `guards` source: the retry decision is made
 * from an `invoke.onError` handler, whose event is not part of the declared
 * event union that a named guard's args are typed against.
 */
const canRetry = (attempt: number) => attempt < MAX_ATTEMPTS;

/** A flaky transport: every third dial fails. */
let dials = 0;
const connect = createAsyncLogic({
  run: async () => {
    dials++;
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (dials % 3 === 0) {
      throw new Error(`ECONNREFUSED (dial ${dials})`);
    }
    return { sessionId: `sess-${dials}` };
  }
});

/**
 * A trimmed copy of the `connection-manager` example: reconnect with
 * exponential backoff. Also headless.
 */
export const connectionMachine = setup({
  schemas: {
    context: types<{
      attempt: number;
      sessionId: string | null;
      lastError: string | null;
    }>(),
    events: {
      connect: types<{}>(),
      disconnect: types<{}>()
    }
  },
  actors: { connect },
  delays: {
    backoff: ({ context }) => 300 * 2 ** (context.attempt - 1)
  }
}).createMachine({
  context: { attempt: 0, sessionId: null, lastError: null },
  initial: 'idle',
  states: {
    idle: {
      on: { connect: { target: 'connecting' } }
    },
    connecting: {
      invoke: {
        src: ({ actors }) => actors.connect,
        onDone: ({ event }) => ({
          target: 'connected',
          context: {
            attempt: 0,
            sessionId: event.output.sessionId,
            lastError: null
          }
        }),
        onError: ({ context, event }) => {
          const lastError = (event.error as Error).message;
          const attempt = context.attempt + 1;
          return canRetry(attempt)
            ? { target: 'backingOff', context: { attempt, lastError } }
            : { target: 'gaveUp', context: { attempt, lastError } };
        }
      }
    },
    backingOff: {
      after: { backoff: { target: 'connecting' } }
    },
    connected: {
      on: {
        disconnect: { target: 'idle', context: { sessionId: null } }
      }
    },
    gaveUp: {
      on: { connect: { target: 'connecting', context: { attempt: 0 } } }
    }
  }
});
