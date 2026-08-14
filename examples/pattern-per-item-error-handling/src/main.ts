import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

interface Order {
  id: string;
  item: string;
  quantity: number;
}

/** Rejects with a domain error the item machine can route on. */
const provisionOrder = createAsyncLogic({
  run: async ({ input }: { input: { order: Order } }) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (!input.order.item) {
      throw new Error('MissingItem');
    }
    if (input.order.quantity <= 0) {
      throw new Error('InvalidQuantity');
    }
    log(`provisioned ${input.order.id}`);
    return { provisionedAt: Date.now() };
  }
});

/** One actor per order. Each error kind gets its own compensation path. */
const orderMachine = setup({
  schemas: {
    context: types<{ order: Order; problem: string | null }>(),
    input: types<{ order: Order }>(),
    output: types<{ id: string; status: string }>()
  }
}).createMachine({
  context: ({ input }) => ({ order: input.order, problem: null }),
  initial: 'provisioning',
  states: {
    provisioning: {
      invoke: {
        src: provisionOrder,
        input: ({ context }) => ({ order: context.order }),
        onDone: { target: 'provisioned' },
        onError: ({ event }, enq) => {
          const problem = (event.error as Error).message;
          enq(log, `error on order: ${problem}`);
          return problem === 'MissingItem'
            ? { target: 'requestingCatalogFix', context: { problem } }
            : { target: 'requestingQuantityFix', context: { problem } };
        }
      }
    },
    requestingCatalogFix: {
      entry: (_, enq) => enq(log, 'opened a catalog ticket'),
      always: { target: 'failed' }
    },
    requestingQuantityFix: {
      entry: (_, enq) => enq(log, 'asked the buyer to correct the quantity'),
      always: { target: 'failed' }
    },
    provisioned: {
      type: 'final',
      output: ({ context }) => ({ id: context.order.id, status: 'provisioned' })
    },
    failed: {
      type: 'final',
      output: ({ context }) => ({
        id: context.order.id,
        status: `failed: ${context.problem}`
      })
    }
  }
});

const batchMachine = setup({
  schemas: {
    context: types<{
      orders: Order[];
      results: Array<{ id: string; status: string }>;
    }>(),
    events: {
      itemSettled: types<{ result: { id: string; status: string } }>()
    },
    input: types<{ orders: Order[] }>()
  }
}).createMachine({
  context: ({ input }) => ({ orders: input.orders, results: [] }),
  initial: 'processing',
  states: {
    processing: {
      // One child actor per item. A failure in one child never stops the
      // others: the parent only ever sees a settled result.
      entry: ({ context }, enq) => {
        for (const order of context.orders) {
          const child = enq.spawn(orderMachine, {
            id: order.id,
            input: { order }
          });
          enq.subscribeTo(child, {
            done: (result) => ({ type: 'itemSettled' as const, result })
          });
        }
      },
      on: {
        itemSettled: ({ context, event }, enq) => {
          const results = [...context.results, event.result];
          enq(log, `settled ${event.result.id}: ${event.result.status}`);
          return results.length === context.orders.length
            ? { target: 'done', context: { results } }
            : { context: { results } };
        }
      }
    },
    done: {
      type: 'final',
      output: ({ context }) => ({
        provisioned: context.results.filter((r) => r.status === 'provisioned')
          .length,
        failed: context.results.filter((r) => r.status !== 'provisioned')
          .length,
        results: context.results
      })
    }
  }
});

const orders: Order[] = [
  { id: 'o-1', item: 'laptop', quantity: 2 },
  { id: 'o-2', item: '', quantity: 1 },
  { id: 'o-3', item: 'monitor', quantity: 0 }
];

const actor = createActor(batchMachine, {
  input: { orders },
  inspect: inspector?.inspect
});

actor.subscribe((snapshot) =>
  log(
    `state: ${JSON.stringify(snapshot.value)} settled: ${snapshot.context.results.length}`
  )
);

actor.start();

log(`batch: ${JSON.stringify(await toPromise(actor), null, 2)}`);

inspector?.destroy();
