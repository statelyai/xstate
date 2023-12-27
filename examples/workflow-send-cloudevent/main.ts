import { assign, createMachine, fromPromise, interpret } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#send-cloudevent-on-workflow-completion-example
export const workflow = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5SzAOwgYwDYHsCuEYAbmgC46oAOATjkQJaz0UB0ACrQ0xQPLWHVYAZVIBDUmADEECmBb1URHAGs5KdNnyESqclU6Nmqdge6o+A4WIkIFSjOKMBtAAwBdV28ShKOJqSNvEAAPRABmAA4WAE4ANhdosIB2AFYAGhAAT3Cw6JYwlIBGFNiAJhSAXyqM1BxCeCQQdUxcAmIyCho6Qwog339AxtCEAFo8l1yXMvSsxBHC0qSWFMTU6qa0Fq123U7TIxNuswswQRFxMD6-egDeocR4jOyEaJd15s02nT0urgOAUXQVwGd1Aw0KyRiEQALMkZs9oiklnEImsqhUgA */
    id: 'sendcloudeventonprovision',
    types: {} as {
      context: {
        orders: {
          id: string;
          item: string;
          quantity: string;
        }[];
        provisionedOrders:
          | {
              id: string;
              outcome: string;
            }[]
          | undefined;
      };
    },
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
  },
  {
    actors: {
      provisionOrdersFunction: fromPromise(async ({ input }) => {
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
      })
    }
  }
);

const actor = interpret(workflow, {
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
