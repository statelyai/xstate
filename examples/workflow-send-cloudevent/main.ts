import { assign, fromPromise, createActor, setup } from 'xstate';

interface Order {
  id: string;
  item: string;
  quantity: string;
}

// https://github.com/serverlessworkflow/specification/tree/main/examples#send-cloudevent-on-workflow-completion-example
export const workflow = setup({
  types: {
    context: {} as {
      orders: Order[];
      provisionedOrders:
        | {
            id: string;
            outcome: string;
          }[]
        | undefined;
    },
    input: {} as {
      orders: Order[];
    }
  },
  actors: {
    provisionOrdersFunction: fromPromise(
      async ({ input }: { input: { orders: Order[] } }) => {
        const data = await Promise.all(
          input.orders.map(async (order) => {
            console.log('provisioning order', order);
            // wait 1 second
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return {
              id: order.id,
              outcome: 'SUCCESS'
            };
          })
        );

        return data;
      }
    )
  }
}).createMachine({
  id: 'sendcloudeventonprovision',
  context: ({ input }) => ({
    orders: input.orders,
    provisionedOrders: undefined
  }),
  initial: 'ProvisionOrdersState',
  states: {
    ProvisionOrdersState: {
      invoke: {
        src: 'provisionOrdersFunction',
        input: ({ context }) => ({
          orders: context.orders
        }),
        onDone: {
          actions: assign({
            provisionedOrders: ({ event }) => event.output
          }),
          target: 'End'
        }
      }
    },
    End: {
      type: 'final',
      output: ({ context }) => ({
        provisionedOrders: context.provisionedOrders
      })
    }
  }
});

const actor = createActor(workflow, {
  input: {
    orders: [
      {
        id: '123',
        item: 'laptop',
        quantity: '10'
      },
      {
        id: '456',
        item: 'desktop',
        quantity: '4'
      }
    ]
  }
});

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();
