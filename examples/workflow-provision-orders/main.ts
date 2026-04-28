import { createAsyncLogic, createActor, setup } from 'xstate';
import { z } from 'zod';
interface Order {
  id: string;
  item: string;
  quantity: string;
}
// https://github.com/serverlessworkflow/specification/tree/main/examples#provision-orders-example
export const workflow = setup({
  types: {
    context: {} as {
      order: Order;
    },
    input: {} as {
      order: Order;
    }
  },
  actors: {
    provisionOrderFunction: createAsyncLogic({
      schemas: {
        input: z.custom<{
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
  }
}).createMachine({
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
        onDone: 'ApplyOrder',
        onError: [
          {
            guard: ({ event }) =>
              (event.error as any).message === 'Missing order id',
            target: 'Exception.MissingId'
          },
          {
            guard: ({ event }) =>
              (event.error as any).message === 'Missing order item',
            target: 'Exception.MissingItem'
          },
          {
            guard: ({ event }) =>
              (event.error as any).message === 'Missing order quantity',
            target: 'Exception.MissingQuantity'
          }
        ]
      }
    },
    ApplyOrder: {
      invoke: {
        src: 'applyOrderWorkflowId',
        onDone: 'End'
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
            onDone: 'End'
          }
        },
        MissingItem: {
          invoke: {
            src: 'handleMissingItemExceptionWorkflow',
            onDone: 'End'
          }
        },
        MissingQuantity: {
          invoke: {
            src: 'handleMissingQuantityExceptionWorkflow',
            onDone: 'End'
          }
        },
        End: {
          type: 'final'
        }
      },
      onDone: 'End'
    }
  }
});
const actor = createActor(workflow, {
  input: {
    order: {
      id: '',
      item: 'laptop',
      quantity: '10'
    }
  }
});
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
