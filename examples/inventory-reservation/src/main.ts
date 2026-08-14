import { ActorRefFrom, createActor, setup, toPromise, types } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const HOLD_MS = 300;

type HoldOutcome = { customer: string; status: 'committed' | 'expired' };

/**
 * One hold on one unit of stock. The TTL is a delayed transition; `extend`
 * re-enters `held` with `reenter: true`, which restarts that timer.
 */
const holdMachine = setup({
  schemas: {
    context: types<{ customer: string }>(),
    events: { commit: types<{}>(), extend: types<{}>() },
    input: types<{ customer: string }>(),
    output: types<HoldOutcome>()
  },
  delays: { ttl: HOLD_MS }
}).createMachine({
  context: ({ input }) => ({ customer: input.customer }),
  initial: 'held',
  states: {
    held: {
      entry: ({ context }, enq) =>
        enq(log, `  hold for ${context.customer} started (${HOLD_MS}ms)`),
      after: { ttl: { target: 'expired' } },
      on: {
        commit: { target: 'committed' },
        // Restarting the state restarts the `after` timer.
        extend: { target: 'held', reenter: true }
      }
    },
    committed: {
      type: 'final',
      output: ({ context }) => ({
        customer: context.customer,
        status: 'committed' as const
      })
    },
    expired: {
      type: 'final',
      output: ({ context }) => ({
        customer: context.customer,
        status: 'expired' as const
      })
    }
  }
});

type HoldRef = ActorRefFrom<typeof holdMachine>;

const inventoryMachine = setup({
  schemas: {
    context: types<{
      available: number;
      pending: string | null;
      holds: Record<string, HoldRef>;
      settled: HoldOutcome[];
    }>(),
    events: {
      reserve: types<{ customer: string }>(),
      commit: types<{ customer: string }>(),
      extend: types<{ customer: string }>(),
      holdSettled: types<{ outcome: HoldOutcome }>()
    },
    input: types<{ available: number }>()
  },
  guards: {
    // Overselling guard: a reservation is only granted against real stock.
    inStock: ({ context }: { context: { available: number } }) =>
      context.available > 0
  }
}).createMachine({
  context: ({ input }) => ({
    available: input.available,
    pending: null,
    holds: {},
    settled: []
  }),
  initial: 'open',
  states: {
    open: {
      on: {
        reserve: ({ context, event, guards }, enq) => {
          if (!guards.inStock({ context })) {
            enq(log, `denied ${event.customer}: out of stock`);
            return undefined;
          }
          enq(log, `granted ${event.customer}: 1 unit held`);
          return {
            target: 'granting',
            context: {
              pending: event.customer,
              available: context.available - 1
            }
          };
        },
        // `enq.sendTo` needs an actor ref, so the hold refs live in context.
        commit: ({ context, event }, enq) => {
          enq.sendTo(context.holds[event.customer]!, { type: 'commit' });
        },
        extend: ({ context, event }, enq) => {
          enq(log, `extending hold for ${event.customer}`);
          enq.sendTo(context.holds[event.customer]!, { type: 'extend' });
        },
        holdSettled: ({ context, event }, enq) => {
          const { customer, status } = event.outcome;
          enq(log, `hold for ${customer} ${status}`);
          const holds = { ...context.holds };
          delete holds[customer];
          const settled = [...context.settled, event.outcome];
          // An expired hold returns its unit to the shelf.
          const available =
            status === 'expired' ? context.available + 1 : context.available;
          return settled.length === 2
            ? { target: 'closed', context: { holds, settled, available } }
            : { context: { holds, settled, available } };
        }
      }
    },
    // Spawning happens in an entry action, which is where `enq.subscribeTo`
    // can route the hold's outcome back to the inventory.
    granting: {
      entry: ({ context }, enq) => {
        const customer = context.pending!;
        const ref = enq.spawn(holdMachine, {
          id: `hold-${customer}`,
          input: { customer }
        });
        enq.subscribeTo(ref, {
          done: (outcome) => ({ type: 'holdSettled' as const, outcome })
        });
        return {
          context: { holds: { ...context.holds, [customer]: ref } }
        };
      },
      always: { target: 'open', context: { pending: null } }
    },
    closed: {
      type: 'final',
      output: ({ context }) => ({
        available: context.available,
        settled: context.settled
      })
    }
  }
});

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const actor = createActor(inventoryMachine, {
  input: { available: 1 },
  inspect: inspector?.inspect
});

actor.subscribe((snapshot) =>
  log(
    `inventory: ${JSON.stringify(snapshot.value)} available=${snapshot.context.available}`
  )
);

actor.start();

// Two customers race for the last unit.
actor.send({ type: 'reserve', customer: 'ada' });
actor.send({ type: 'reserve', customer: 'grace' });

// Ada never checks out, so her hold expires and the unit returns to stock.
await wait(HOLD_MS + 100);

actor.send({ type: 'reserve', customer: 'grace' });
await wait(HOLD_MS / 2);
actor.send({ type: 'extend', customer: 'grace' });
await wait(HOLD_MS / 2);
actor.send({ type: 'commit', customer: 'grace' });

log(`result: ${JSON.stringify(await toPromise(actor), null, 2)}`);

inspector?.destroy();
