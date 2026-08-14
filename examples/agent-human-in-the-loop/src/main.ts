import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Proposal {
  tool: string;
  args: string;
}

/** A mock model that proposes one side-effecting tool call for the goal. */
const propose = createAsyncLogic({
  run: async ({ input }: { input: { goal: string } }): Promise<Proposal> => {
    await wait(150);
    return {
      tool: 'send_email',
      args: `to=finance@acme.test re="${input.goal}"`
    };
  }
});

/** The side effect the human is gating. Only runs after approval. */
const execute = createAsyncLogic({
  run: async ({ input }: { input: { proposal: Proposal } }) => {
    log(`executing ${input.proposal.tool}(${input.proposal.args})`);
    await wait(150);
    return { receipt: `ok-${Date.now() % 1000}` };
  }
});

const agent = setup({
  schemas: {
    context: types<{
      goal: string;
      proposal: Proposal | null;
      outcome: string | null;
    }>(),
    events: {
      approve: types<{}>(),
      reject: types<{ reason: string }>(),
      edit: types<{ args: string }>()
    },
    input: types<{ goal: string }>()
  },
  // The agent waits this long for a human before escalating.
  delays: { reviewWindow: 1500 }
}).createMachine({
  context: ({ input }) => ({ goal: input.goal, proposal: null, outcome: null }),
  initial: 'proposing',
  states: {
    proposing: {
      invoke: {
        src: propose,
        input: ({ context }) => ({ goal: context.goal }),
        onDone: ({ event }, enq) => {
          enq(log, `proposed ${event.output.tool}(${event.output.args})`);
          return {
            target: 'awaitingApproval',
            context: { proposal: event.output }
          };
        }
      }
    },
    // A long-lived state. Nothing here is pending on a promise: the machine
    // sits until a human sends an event, or the review window elapses.
    awaitingApproval: {
      on: {
        approve: (_, enq) => {
          enq(log, 'human approved');
          return { target: 'executing' };
        },
        reject: ({ event }, enq) => {
          enq(log, `human rejected: ${event.reason}`);
          return {
            target: 'abandoned',
            context: { outcome: `rejected: ${event.reason}` }
          };
        },
        // An edit keeps the machine in awaitingApproval; the human is still
        // the one who has to say yes to the revised proposal.
        edit: ({ context, event }, enq) => {
          enq(log, `human edited args to ${event.args}`);
          return {
            context: { proposal: { ...context.proposal!, args: event.args } }
          };
        }
      },
      after: {
        reviewWindow: (_, enq) => {
          enq(log, 'no response in the review window; escalating');
          return { target: 'escalated' };
        }
      }
    },
    executing: {
      invoke: {
        src: execute,
        input: ({ context }) => ({ proposal: context.proposal! }),
        onDone: ({ event }) => ({
          target: 'done',
          context: { outcome: `executed (${event.output.receipt})` }
        })
      }
    },
    done: {
      type: 'final',
      output: ({ context }) => ({
        outcome: context.outcome,
        proposal: context.proposal
      })
    },
    abandoned: {
      type: 'final',
      output: ({ context }) => ({
        outcome: context.outcome,
        proposal: context.proposal
      })
    },
    escalated: {
      type: 'final',
      output: ({ context }) => ({
        outcome: 'escalated to a second approver',
        proposal: context.proposal
      })
    }
  }
});

/** Runs the agent once and plays a scripted human response. */
async function run(
  label: string,
  goal: string,
  human: (actor: ReturnType<typeof createActor<typeof agent>>) => void
) {
  log(`--- ${label} ---`);
  const actor = createActor(agent, {
    input: { goal },
    inspect: inspector?.inspect
  });
  actor.subscribe((snapshot) =>
    log(`state: ${JSON.stringify(snapshot.value)}`)
  );
  actor.start();
  human(actor);
  log(`${label} result: ${JSON.stringify(await toPromise(actor))}`);
}

await run('approval', 'Q3 invoice reminder', (actor) => {
  void wait(400).then(() =>
    actor.send({ type: 'edit', args: 'to=ap@acme.test' })
  );
  void wait(700).then(() => actor.send({ type: 'approve' }));
});

await run('rejection', 'Delete stale accounts', (actor) => {
  void wait(500).then(() =>
    actor.send({ type: 'reject', reason: 'needs a dry run first' })
  );
});

await run('timeout', 'Rotate production keys', () => {
  // Nobody answers, so the review window expires and the agent escalates.
});

inspector?.destroy();
