import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Order {
  id: string;
  sku: string;
  amount: number;
  /** Drives the scripted payment outcome; no network is involved. */
  cardOk: boolean;
}

const reserveInventory = createAsyncLogic({
  run: async ({ input }: { input: { order: Order } }) => {
    await wait(80);
    log(`  inventory: reserved ${input.order.sku}`);
    return { reservationId: `res-${input.order.id}` };
  }
});

const releaseInventory = createAsyncLogic({
  run: async ({ input }: { input: { reservationId: string } }) => {
    await wait(80);
    log(`  inventory: released ${input.reservationId}`);
    return { released: true };
  }
});

const chargePayment = createAsyncLogic({
  run: async ({ input }: { input: { order: Order } }) => {
    await wait(80);
    if (!input.order.cardOk) {
      throw new Error('CardDeclined');
    }
    log(`  payment: charged ${input.order.amount}`);
    return { chargeId: `ch-${input.order.id}` };
  }
});

const refundPayment = createAsyncLogic({
  run: async ({ input }: { input: { chargeId: string } }) => {
    await wait(80);
    log(`  payment: refunded ${input.chargeId}`);
    return { refunded: true };
  }
});

const scheduleShipping = createAsyncLogic({
  run: async ({ input }: { input: { order: Order } }) => {
    await wait(80);
    log(`  shipping: scheduled for ${input.order.id}`);
    return { shipmentId: `shp-${input.order.id}` };
  }
});

/**
 * Each forward step has a matching compensation state. A failure jumps into
 * the compensation chain at the point that matches the last completed step,
 * and unwinds backwards from there.
 */
const sagaMachine = setup({
  schemas: {
    context: types<{
      order: Order;
      reservationId: string | null;
      chargeId: string | null;
      shipmentId: string | null;
      failure: string | null;
    }>(),
    input: types<{ order: Order }>()
  },
  actors: {
    chargePayment,
    refundPayment,
    releaseInventory,
    reserveInventory,
    scheduleShipping
  }
}).createMachine({
  context: ({ input }) => ({
    order: input.order,
    reservationId: null,
    chargeId: null,
    shipmentId: null,
    failure: null
  }),
  initial: 'reservingInventory',
  states: {
    reservingInventory: {
      entry: ({ context }, enq) => enq(log, `saga ${context.order.id}: start`),
      invoke: {
        src: 'reserveInventory',
        input: ({ context }) => ({ order: context.order }),
        onDone: ({ event }) => ({
          target: 'chargingPayment',
          context: { reservationId: event.output.reservationId }
        }),
        onError: ({ event }) => ({
          target: 'failed',
          context: { failure: (event.error as Error).message }
        })
      }
    },
    chargingPayment: {
      invoke: {
        src: 'chargePayment',
        input: ({ context }) => ({ order: context.order }),
        onDone: ({ event }) => ({
          target: 'schedulingShipping',
          context: { chargeId: event.output.chargeId }
        }),
        // Nothing to refund yet, so compensation starts at the reservation.
        onError: ({ event }, enq) => {
          const failure = (event.error as Error).message;
          enq(log, `  payment failed: ${failure}`);
          return { target: 'releasingInventory', context: { failure } };
        }
      }
    },
    schedulingShipping: {
      invoke: {
        src: 'scheduleShipping',
        input: ({ context }) => ({ order: context.order }),
        onDone: ({ event }) => ({
          target: 'fulfilled',
          context: { shipmentId: event.output.shipmentId }
        }),
        onError: ({ event }) => ({
          target: 'refundingPayment',
          context: { failure: (event.error as Error).message }
        })
      }
    },
    // Compensation chain, unwound in reverse order of the forward steps.
    refundingPayment: {
      entry: (_, enq) => enq(log, '  compensating: refund'),
      invoke: {
        src: 'refundPayment',
        input: ({ context }) => ({ chargeId: context.chargeId! }),
        onDone: { target: 'releasingInventory' },
        onError: { target: 'compensationFailed' }
      }
    },
    releasingInventory: {
      entry: (_, enq) => enq(log, '  compensating: release reservation'),
      invoke: {
        src: 'releaseInventory',
        input: ({ context }) => ({ reservationId: context.reservationId! }),
        onDone: { target: 'rolledBack' },
        onError: { target: 'compensationFailed' }
      }
    },
    fulfilled: {
      type: 'final',
      output: ({ context }) => ({
        id: context.order.id,
        status: 'fulfilled' as const,
        shipmentId: context.shipmentId
      })
    },
    rolledBack: {
      type: 'final',
      output: ({ context }) => ({
        id: context.order.id,
        status: 'rolled-back' as const,
        reason: context.failure
      })
    },
    failed: {
      type: 'final',
      output: ({ context }) => ({
        id: context.order.id,
        status: 'failed' as const,
        reason: context.failure
      })
    },
    compensationFailed: {
      type: 'final',
      output: ({ context }) => ({
        id: context.order.id,
        status: 'compensation-failed' as const,
        reason: context.failure
      })
    }
  }
});

const run = async (order: Order) => {
  const actor = createActor(sagaMachine, {
    input: { order },
    inspect: inspector?.inspect
  });
  actor.subscribe((snapshot) =>
    log(`${order.id} state: ${JSON.stringify(snapshot.value)}`)
  );
  actor.start();
  log(`${order.id} result: ${JSON.stringify(await toPromise(actor))}`);
};

await run({ id: 'ord-1', sku: 'desk-lamp', amount: 4200, cardOk: true });
await run({ id: 'ord-2', sku: 'standing-desk', amount: 89000, cardOk: false });

inspector?.destroy();
