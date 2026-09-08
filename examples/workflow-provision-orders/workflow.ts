import { types, createMachine, createAsyncLogic } from 'xstate';
interface Order {
  id: string;
  item: string;
  quantity: string;
}
// https://github.com/serverlessworkflow/specification/tree/main/examples#provision-orders-example
export const workflow = createMachine({
  schemas: {
    context: types<{
      order: Order;
    }>(),
    input: types<{
      order: Order;
    }>()
  },
  actors: {
    provisionOrderFunction: createAsyncLogic({
      schemas: {
        input: types<{
          order: Order;
        }>()
      },
      run: async ({ input }) => {
        console.log('starting provisionOrderFunction');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!input.order.id) {
          throw new Error('Missing order id');
        }
        if (!input.order.item) {
          throw new Error('Missing order item');
        }
        if (!input.order.quantity) {
          throw new Error('Missing order quantity');
        }
        console.log('finished provisionOrderFunction');
        return {
          order: input.order
        };
      }
    }),
    applyOrderWorkflowId: createAsyncLogic({
      run: async () => {
        console.log('starting applyOrderWorkflowId');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('finished applyOrderWorkflowId');
        return;
      }
    }),
    handleMissingIdExceptionWorkflow: createAsyncLogic({
      run: async () => {
        console.log('starting handleMissingIdExceptionWorkflow');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('finished handleMissingIdExceptionWorkflow');
        return;
      }
    }),
    handleMissingItemExceptionWorkflow: createAsyncLogic({
      run: async () => {
        console.log('starting handleMissingItemExceptionWorkflow');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('finished handleMissingItemExceptionWorkflow');
        return;
      }
    }),
    handleMissingQuantityExceptionWorkflow: createAsyncLogic({
      run: async () => {
        console.log('starting handleMissingQuantityExceptionWorkflow');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('finished handleMissingQuantityExceptionWorkflow');
        return;
      }
    })
  },
  id: 'provisionorders',
  initial: 'ProvisionOrder',
  context: ({ input }) => ({
    order: input.order
  }),
  states: {
    ProvisionOrder: {
      invoke: {
        src: 'provisionOrderFunction',
        input: ({ context }) => ({
          order: context.order
        }),
        onDone: { target: 'ApplyOrder' },
        onError: ({ event }) => {
          if (
            (event.error instanceof Error ? event.error.message : undefined) ===
            'Missing order id'
          ) {
            return { target: 'Exception.MissingId' };
          }
          if (
            (event.error instanceof Error ? event.error.message : undefined) ===
            'Missing order item'
          ) {
            return { target: 'Exception.MissingItem' };
          }
          if (
            (event.error instanceof Error ? event.error.message : undefined) ===
            'Missing order quantity'
          ) {
            return { target: 'Exception.MissingQuantity' };
          }
          throw event.error;
        }
      }
    },
    ApplyOrder: {
      invoke: {
        src: 'applyOrderWorkflowId',
        onDone: { target: 'End' }
      }
    },
    End: {
      type: 'final'
    },
    Exception: {
      initial: 'MissingId',
      states: {
        MissingId: {
          invoke: {
            src: 'handleMissingIdExceptionWorkflow',
            onDone: { target: 'End' }
          }
        },
        MissingItem: {
          invoke: {
            src: 'handleMissingItemExceptionWorkflow',
            onDone: { target: 'End' }
          }
        },
        MissingQuantity: {
          invoke: {
            src: 'handleMissingQuantityExceptionWorkflow',
            onDone: { target: 'End' }
          }
        },
        End: {
          type: 'final'
        }
      },
      onDone: { target: 'End' }
    }
  }
});
