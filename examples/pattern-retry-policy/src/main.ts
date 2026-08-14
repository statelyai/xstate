import { createActor, setup, toPromise, types } from 'xstate';
// Actor creators are imported from the `xstate/actors` subpath so that this
// example runs under `tsx` against the workspace build.
import { createAsyncLogic } from 'xstate/actors';

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const MAX_ATTEMPTS = 5;

/** Fails the first three times it is called, then succeeds. */
let calls = 0;
const storePatient = createAsyncLogic({
  run: async ({ input }: { input: { name: string } }) => {
    calls++;
    log(`storePatient: call ${calls} for ${input.name}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (calls < 4) {
      throw new Error('ServiceUnavailable');
    }
    return { recordId: `rec-${calls}` };
  }
});

const machine = setup({
  schemas: {
    context: types<{
      name: string;
      attempts: number;
      recordId: string | null;
      error: string | null;
    }>(),
    input: types<{ name: string }>()
  },
  actors: { storePatient },
  guards: {
    canRetry: ({ context }: { context: { attempts: number } }) =>
      context.attempts < MAX_ATTEMPTS
  },
  delays: {
    // Exponential backoff: 200ms, 400ms, 800ms, ...
    backoff: ({ context }: { context: { attempts: number } }) =>
      100 * 2 ** context.attempts
  }
}).createMachine({
  context: ({ input }) => ({
    name: input.name,
    attempts: 0,
    recordId: null,
    error: null
  }),
  initial: 'attempting',
  states: {
    attempting: {
      invoke: {
        src: ({ actors }) => actors.storePatient,
        input: ({ context }) => ({ name: context.name }),
        onDone: ({ event }) => ({
          target: 'stored',
          context: { recordId: event.output.recordId }
        }),
        onError: ({ context, event, guards }) => {
          const error = String((event.error as Error).message);
          const attempts = context.attempts + 1;
          return guards.canRetry({ context: { attempts } })
            ? { target: 'backingOff', context: { attempts, error } }
            : { target: 'gaveUp', context: { attempts, error } };
        }
      }
    },
    backingOff: {
      entry: ({ context }, enq) =>
        enq(
          log,
          `attempt ${context.attempts} failed (${context.error}); retrying in ${100 * 2 ** context.attempts}ms`
        ),
      after: { backoff: { target: 'attempting' } }
    },
    stored: {
      type: 'final',
      output: ({ context }) => ({ ok: true, recordId: context.recordId })
    },
    gaveUp: {
      type: 'final',
      output: ({ context }) => ({ ok: false, attempts: context.attempts })
    }
  }
});

const actor = createActor(machine, { input: { name: 'Ada Lovelace' } });

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

log(`result: ${JSON.stringify(await toPromise(actor))}`);
