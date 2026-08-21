import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const notifyApprover = createAsyncLogic({
  run: async ({ input }: { input: { request: string; reminder: number } }) => {
    const kind =
      input.reminder === 0 ? 'request' : `reminder #${input.reminder}`;
    log(`emailing approver: ${kind} for ${input.request}`);
    await wait(100);
    return { sentAt: Date.now() };
  }
});

const recordDecision = createAsyncLogic({
  run: async ({ input }: { input: { request: string; decision: string } }) => {
    log(`writing "${input.decision}" for ${input.request} to the audit log`);
    await wait(100);
    return { decision: input.decision };
  }
});

const MAX_REMINDERS = 2;

const machine = setup({
  schemas: {
    context: types<{
      request: string;
      reminders: number;
      decision: string | null;
    }>(),
    events: { approve: types<{}>(), reject: types<{ reason: string }>() },
    input: types<{ request: string }>()
  },
  delays: { reminderInterval: 700 },
  actors: { notifyApprover, recordDecision }
}).createMachine({
  context: ({ input }) => ({
    request: input.request,
    reminders: 0,
    decision: null
  }),
  initial: 'notifying',
  states: {
    notifying: {
      invoke: {
        src: 'notifyApprover',
        input: ({ context }) => ({
          request: context.request,
          reminder: context.reminders
        }),
        onDone: { target: 'awaitingDecision' }
      }
    },
    // The workflow parks here indefinitely: a human, not a promise, decides
    // what happens next. A delayed transition nudges them, and gives up after
    // MAX_REMINDERS.
    awaitingDecision: {
      on: {
        approve: (_, enq) => {
          enq(log, 'approver approved');
          return { target: 'recording', context: { decision: 'approved' } };
        },
        reject: ({ event }, enq) => {
          enq(log, `approver rejected: ${event.reason}`);
          return {
            target: 'recording',
            context: { decision: `rejected: ${event.reason}` }
          };
        }
      },
      after: {
        reminderInterval: ({ context }) =>
          context.reminders < MAX_REMINDERS
            ? {
                target: 'notifying',
                context: { reminders: context.reminders + 1 }
              }
            : { target: 'expired' }
      }
    },
    recording: {
      invoke: {
        src: 'recordDecision',
        input: ({ context }) => ({
          request: context.request,
          decision: context.decision!
        }),
        onDone: { target: 'settled' }
      }
    },
    settled: {
      type: 'final',
      output: ({ context }) => ({
        outcome: context.decision,
        reminders: context.reminders
      })
    },
    expired: {
      type: 'final',
      output: ({ context }) => ({
        outcome: 'expired',
        reminders: context.reminders
      })
    }
  }
});

const actor = createActor(machine, {
  input: { request: 'PR-118 budget increase' },
  inspect: inspector?.inspect
});

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

// The approver responds after the first reminder has already gone out.
void wait(1200).then(() => actor.send({ type: 'approve' }));

log(`settled: ${JSON.stringify(await toPromise(actor))}`);

inspector?.destroy();
