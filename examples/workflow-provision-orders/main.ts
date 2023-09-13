import { createMachine, fromPromise, interpret } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#provision-orders-example
export const workflow = createMachine(
  {
    id: 'provisionorders',
    types: {} as {
      context: {
        order: {
          id: string;
          item: string;
          quantity: string;
        };
      };
    },
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
              guard: ({ event }) => event.data.message === 'Missing order id',
              target: 'Exception.MissingId'
            },
            {
              guard: ({ event }) => event.data.message === 'Missing order item',
              target: 'Exception.MissingItem'
            },
            {
              guard: ({ event }) =>
                event.data.message === 'Missing order quantity',
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
  },
  {
    actors: {
      provisionOrderFunction: fromPromise(async ({ input }) => {
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
      }),
      applyOrderWorkflowId: fromPromise(async () => {
        console.log('starting applyOrderWorkflowId');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('finished applyOrderWorkflowId');
        return;
      }),
      handleMissingIdExceptionWorkflow: fromPromise(async () => {
        console.log('starting handleMissingIdExceptionWorkflow');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('finished handleMissingIdExceptionWorkflow');
        return;
      }),
      handleMissingItemExceptionWorkflow: fromPromise(async () => {
        console.log('starting handleMissingItemExceptionWorkflow');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('finished handleMissingItemExceptionWorkflow');
        return;
      }),
      handleMissingQuantityExceptionWorkflow: fromPromise(async () => {
        console.log('starting handleMissingQuantityExceptionWorkflow');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('finished handleMissingQuantityExceptionWorkflow');
        return;
      })
    }
  }
);

const actor = interpret(workflow, {
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
