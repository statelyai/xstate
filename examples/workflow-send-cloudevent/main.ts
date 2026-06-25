import { createMachine, createAsyncLogic, createActor } from 'xstate';
import { z } from 'zod';
interface Order {
  id: string;
  item: string;
  quantity: string;
}
// https://github.com/serverlessworkflow/specification/tree/main/examples#send-cloudevent-on-workflow-completion-example
export const workflow = createMachine({
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
  actorSources: {
    provisionOrdersFunction: createAsyncLogic({
      schemas: {
        input: z.custom<{
          orders: Order[];
        }>()
      },
      run: async ({ input }) => {
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
    })
  },
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
        onDone: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'End',
            context: {
              ...context,
              provisionedOrders: (({ event }) => event.output)({
                context: context,
                event: event
              })
            }
          };
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
