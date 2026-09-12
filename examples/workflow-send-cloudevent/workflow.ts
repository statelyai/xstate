import { types, createMachine, createAsyncLogic } from 'xstate';
interface Order {
  id: string;
  item: string;
  quantity: string;
}
// https://github.com/serverlessworkflow/specification/tree/main/examples#send-cloudevent-on-workflow-completion-example
export const workflow = createMachine({
  schemas: {
    context: types<{
      orders: Order[];
      provisionedOrders:
        | {
            id: string;
            outcome: string;
          }[]
        | undefined;
    }>(),
    input: types<{
      orders: Order[];
    }>()
  },
  actors: {
    provisionOrdersFunction: createAsyncLogic({
      schemas: {
        input: types<{
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
        onDone: ({ context, event }) => {
          return {
            target: 'End',
            context: {
              ...context,
              provisionedOrders: event.output
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
