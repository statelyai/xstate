import {
  assign,
  createMachine,
  forwardTo,
  fromPromise,
  createActor,
  sendParent,
  setup
} from 'xstate';

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
export const workflow = setup({
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

  actors: {
    checkfunds: fromPromise(
      async ({
        input
      }: {
        input: {
          account: string;
          paymentamount: number;
        };
      }) => {
        console.log('Running checkfunds');
        await delay(1000);

        console.log('checkfunds done');

        return {
          available: input.paymentamount < 1000
        };
      }
    ),
    sendSuccessEmail: fromPromise(async ({ input }) => {
      console.log('Running sendSuccessEmail');
      await delay(1000);

      console.log('sendSuccessEmail done');
    }),
    sendInsufficientFundsEmail: fromPromise(async ({ input }) => {
      console.log('Running sendInsufficientFundsEmail');
      await delay(1000);

      console.log('sendInsufficientFundsEmail done');
    })
  },
  guards: {
    fundsAvailable: ({ context }) => !!context.funds?.available
  }
}).createMachine({
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
        PaymentReceivedEvent: {
          actions: assign({
            customer: ({ event }) => event.customer,
            payment: ({ event }) => event.payment,
            funds: ({ event }) => event.funds
          }),
          target: 'PaymentReceived'
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
        onDone: {
          actions: assign({
            funds: ({ event }) => event.output
          }),
          target: 'ConfirmBasedOnFunds'
        }
      }
    },
    ConfirmBasedOnFunds: {
      always: [
        {
          guard: 'fundsAvailable',
          target: 'SendPaymentSuccess'
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
      entry: sendParent(({ context }) => ({
        type: 'ConfirmationCompletedEvent',
        payment: context.payment
      }))
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
    onSnapshot: {
      actions: ({ event }) => {
        console.log(event.snapshot);
      }
    }
  },
  on: {
    PaymentReceivedEvent: { actions: forwardTo('paymentconfirmation') },
    '*': {
      actions: ({ event }) => {
        console.log('Received event', event);
      }
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
