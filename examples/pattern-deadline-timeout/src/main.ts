import { createActor, setup, toPromise, types } from 'xstate';
// Actor creators are imported from the `xstate/actors` subpath so that this
// example runs under `tsx` against the workspace build.
import { createAsyncLogic } from 'xstate/actors';

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const cancelOrder = createAsyncLogic({
  run: async ({ input }: { input: { orderId: string } }) => {
    log(`releasing reservations for ${input.orderId}`);
    await wait(200);
    return { refunded: true };
  }
});

const machine = setup({
  schemas: {
    context: types<{ orderId: string; confirmed: boolean; shipped: boolean }>(),
    events: {
      confirm: types<{}>(),
      ship: types<{}>()
    },
    input: types<{ orderId: string }>()
  },
  actors: { cancelOrder },
  delays: {
    // A real purchase order would use PT30D. Two seconds keeps the demo short.
    deadline: 2000
  }
}).createMachine({
  context: ({ input }) => ({
    orderId: input.orderId,
    confirmed: false,
    shipped: false
  }),
  // A root-level `after` is the deadline for the whole workflow: whatever
  // state the order is in, it is cancelled once the clock runs out.
  after: {
    deadline: ({ context }, enq) => {
      enq(log, `deadline expired for ${context.orderId}`);
      return { target: '.cancelling' };
    }
  },
  initial: 'awaitingConfirmation',
  states: {
    awaitingConfirmation: {
      on: {
        confirm: (_, enq) => {
          enq(log, 'order confirmed');
          return { target: 'awaitingShipment', context: { confirmed: true } };
        }
      }
    },
    awaitingShipment: {
      on: {
        ship: (_, enq) => {
          enq(log, 'order shipped');
          return { target: 'completed', context: { shipped: true } };
        }
      }
    },
    cancelling: {
      invoke: {
        src: ({ actors }) => actors.cancelOrder,
        input: ({ context }) => ({ orderId: context.orderId }),
        onDone: { target: 'cancelled' }
      }
    },
    completed: { type: 'final', output: () => ({ outcome: 'completed' }) },
    cancelled: { type: 'final', output: () => ({ outcome: 'cancelled' }) }
  }
});

const actor = createActor(machine, { input: { orderId: 'PO-1001' } });

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

// The buyer confirms in time, but never ships: the deadline wins.
await wait(500);
actor.send({ type: 'confirm' });

log(`result: ${JSON.stringify(await toPromise(actor))}`);
