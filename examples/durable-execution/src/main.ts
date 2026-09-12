import { createAsyncLogic, setup, types } from 'xstate';
import { createJournal, runOnHost, type Journal } from './host.ts';

const log = (message: string) => console.log(message);

/** Side effects the host journals. The counters prove they do not re-run. */
const sideEffects = { charges: 0, receipts: 0 };

const chargeCard = createAsyncLogic({
  run: async ({ input }: { input: { orderId: string; amount: number } }) => {
    sideEffects.charges++;
    return { chargeId: `ch_${input.orderId}_${input.amount}` };
  }
});

// A custom action enqueued as a named function with serializable arguments:
// its descriptor carries `(type, args)`, so a host can dispatch it on a worker.
const emailReceipt = (chargeId: string) => {
  sideEffects.receipts++;
  log(`  effect: emailing receipt for ${chargeId}`);
};

const orderMachine = setup({
  schemas: {
    context: types<{
      orderId: string;
      amount: number;
      chargeId: string | null;
    }>(),
    events: { pay: types<{ amount: number }>() },
    output: types<{ orderId: string; chargeId: string }>()
  },
  actors: { chargeCard },
  // A timer the host owns: `scheduleTimer` is called on the adapter.
  delays: { packing: 5_000 }
}).createMachine({
  id: 'order',
  context: { orderId: 'A-1001', amount: 4200, chargeId: null },
  initial: 'awaitingPayment',
  states: {
    awaitingPayment: {
      on: {
        pay: ({ event }) => ({
          target: 'charging',
          context: { amount: event.amount }
        })
      }
    },
    charging: {
      invoke: {
        src: 'chargeCard',
        input: ({ context }) => ({
          orderId: context.orderId,
          amount: context.amount
        }),
        onDone: ({ event }, enq) => {
          enq(emailReceipt, event.output.chargeId);
          return {
            target: 'packing',
            context: { chargeId: event.output.chargeId }
          };
        }
      }
    },
    packing: {
      after: { packing: { target: 'shipped' } }
    },
    shipped: {
      type: 'final',
      output: ({ context }) => ({
        orderId: context.orderId,
        chargeId: context.chargeId!
      })
    }
  }
});

type RunOptions = Partial<Parameters<typeof runOnHost>[0]>;

const run = (label: string, journal: Journal, extra: RunOptions) => {
  log(`\n${label}`);
  return runOnHost({
    logic: orderMachine,
    executionId: 'order-A-1001',
    events: [],
    journal,
    log,
    ...extra
  });
};

const emptyJournal = () => ({
  entries: journal.entries,
  keys: [],
  executed: []
});

const pay = [{ type: 'pay', amount: 4200 }] as const;

// 1. The first attempt crashes mid-workflow. Whatever the host journaled up
//    to that point is durable, and so is the checkpoint.
const journal = createJournal();
const first = await run(
  'run 1 — first attempt, crashes mid-workflow',
  journal,
  {
    events: pay,
    crashAfterTransitions: 3
  }
);
log(`  status: ${first.status}`);
log(`  journal keys: ${journal.keys.join(', ') || '(none)'}`);
log(`  side effects: ${JSON.stringify(sideEffects)}`);

// 2. Replay from the beginning with the same journal and execution id: the
//    same keys come back in the same order, and nothing journaled re-runs.
const replayJournal = emptyJournal();
const replay = await run(
  'run 2 — replay against the same journal',
  replayJournal,
  {
    events: pay
  }
);
log(
  `  keys replay in the same order: ${journal.keys.every(
    (key, i) => key === replayJournal.keys[i]
  )}`
);
log(`  re-executed: ${replayJournal.executed.join(', ') || '(none)'}`);
log(`  output: ${JSON.stringify(replay.output)}`);
log(`  side effects: ${JSON.stringify(sideEffects)}`);

// 3. Or resume from the checkpoint instead of replaying: restore the
//    persisted snapshot and continue at the persisted transition index.
const resumed = await run(
  'run 3 — resume from the crash checkpoint',
  emptyJournal(),
  { resume: first.checkpoint }
);
log(`  resumed at transition index ${first.checkpoint.transitionIndex}`);
log(`  output: ${JSON.stringify(resumed.output)}`);
log(`  side effects: ${JSON.stringify(sideEffects)}`);
