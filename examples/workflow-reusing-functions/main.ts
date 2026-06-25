import { createMachine, createAsyncLogic, createActor } from 'xstate';
import { z } from 'zod';
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}
interface PaymentReceivedEvent {
  type: 'PaymentReceivedEvent';
  accountId: string;
  payment: {
    amount: number;
  };
  customer: {
    name: string;
  };
  funds: {
    available: boolean;
  };
}
// https://github.com/serverlessworkflow/specification/tree/main/examples#event-based-service-invocation
export const workflow = createMachine({
  types: {
    events: {} as PaymentReceivedEvent,
    context: {} as {
      payment: {
        amount: number;
      } | null;
      customer: {
        name: string;
      } | null;
      funds: {
        available: boolean;
      } | null;
      accountId: string | null;
    }
  },
  actorSources: {
    checkfunds: createAsyncLogic({
      schemas: {
        input: z.custom<{
          account: string;
          paymentamount: number;
        }>()
      },
      run: async ({ input }) => {
        console.log('Running checkfunds');
        await delay(1000);
        console.log('checkfunds done');
        return {
          available: input.paymentamount < 1000
        };
      }
    }),
    sendSuccessEmail: createAsyncLogic({
      run: async ({ input }) => {
        console.log({ input });
        console.log('Running sendSuccessEmail');
        await delay(1000);
        console.log('sendSuccessEmail done');
      }
    }),
    sendInsufficientFundsEmail: createAsyncLogic({
      run: async ({ input }) => {
        console.log({ input });
        console.log('Running sendInsufficientFundsEmail');
        await delay(1000);
        console.log('sendInsufficientFundsEmail done');
      }
    })
  },
  guards: {
    fundsAvailable: ({ context }) => !!context.funds?.available
  },
  id: 'paymentconfirmation',
  initial: 'Pending',
  context: {
    customer: null,
    payment: null,
    funds: null,
    accountId: null
  },
  states: {
    Pending: {
      on: {
        PaymentReceivedEvent: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'PaymentReceived',
            context: {
              ...context,
              customer: (({ event }) => event.customer)({
                context: context,
                event: event
              }),
              payment: (({ event }) => event.payment)({
                context: context,
                event: event
              }),
              funds: (({ event }) => event.funds)({
                context: context,
                event: event
              })
            }
          };
        }
      }
    },
    PaymentReceived: {
      invoke: {
        src: 'checkfunds',
        input: ({ context }) => ({
          account: context.accountId!,
          paymentamount: context.payment!.amount
        }),
        onDone: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'ConfirmBasedOnFunds',
            context: {
              ...context,
              funds: (({ event }) => event.output)({
                context: context,
                event: event
              })
            }
          };
        }
      }
    },
    ConfirmBasedOnFunds: {
      always: [
        ({ context, event, guards, actions }, enq) => {
          if (!guards['fundsAvailable']({ context, event })) {
            return;
          }
          return { target: 'SendPaymentSuccess' };
        },
        {
          target: 'SendInsufficientResults'
        }
      ]
    },
    SendPaymentSuccess: {
      invoke: {
        src: 'sendSuccessEmail',
        input: ({ context }) => ({
          applicant: context.customer
        }),
        onDone: {
          target: 'End'
        }
      }
    },
    SendInsufficientResults: {
      invoke: {
        src: 'sendInsufficientFundsEmail',
        input: ({ context }) => ({
          applicant: context.customer
        }),
        onDone: {
          target: 'End'
        }
      }
    },
    End: {
      type: 'final',
      entry: ({ context, parent }, enq) => {
        if (parent) {
          enq.sendTo(parent, {
            type: 'ConfirmationCompletedEvent',
            payment: context.payment
          });
        }
      }
    }
  }
});
const parentWorkflow = createMachine({
  id: 'parent',
  types: {} as {
    events: PaymentReceivedEvent;
  },
  invoke: {
    id: 'paymentconfirmation',
    src: workflow,
    onSnapshot: ({ context, event, guards, actions }, enq) => {
      enq(({ event }) => {
        console.log(event.snapshot);
      });
    }
  },
  on: {
    PaymentReceivedEvent: ({ context, event, children }, enq) => {
      enq.sendTo(children.paymentconfirmation, event);
    },
    '*': ({ context, event, guards, actions }, enq) => {
      enq(({ event }) => {
        console.log('Received event', event);
      });
    }
  }
});
const actor = createActor(parentWorkflow);
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
actor.send({
  type: 'PaymentReceivedEvent',
  accountId: '1234',
  payment: {
    amount: 100
  },
  customer: {
    name: 'John Doe'
  },
  funds: {
    available: true
  }
});
