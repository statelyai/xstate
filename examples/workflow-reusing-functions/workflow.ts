import { setTimeout as delay } from 'node:timers/promises';
import {
  createMachine,
  createAsyncLogic,
  types,
  type ActorRefFrom
} from 'xstate';

type Payment = { amount: number };
type Customer = { name: string };
export interface PaymentReceivedEvent {
  type: 'PaymentReceivedEvent';
  accountId: string;
  payment: Payment;
  customer: Customer;
  funds: { available: boolean };
}
function email(name: string) {
  return createAsyncLogic({
    schemas: { input: types<{ applicant: Customer }>() },
    run: async ({ input, signal }) => {
      console.log('Simulating', name, input.applicant.name);
      await delay(1000, undefined, { signal });
      console.log(name, 'done');
    }
  });
}
export const workflow = createMachine({
  schemas: {
    context: types<{
      payment: Payment | null;
      customer: Customer | null;
      funds: { available: boolean } | null;
      accountId: string | null;
    }>(),
    events: {
      PaymentReceivedEvent: types<Omit<PaymentReceivedEvent, 'type'>>()
    }
  },
  actors: {
    checkfunds: createAsyncLogic({
      schemas: {
        input: types<{ account: string; paymentamount: number }>(),
        output: types<{ available: boolean }>()
      },
      run: async ({ input, signal }) => {
        await delay(1000, undefined, { signal });
        return { available: input.paymentamount < 1000 };
      }
    }),
    sendSuccessEmail: email('sendSuccessEmail'),
    sendInsufficientFundsEmail: email('sendInsufficientFundsEmail')
  },
  id: 'paymentconfirmation',
  initial: 'Pending',
  context: { customer: null, payment: null, funds: null, accountId: null },
  states: {
    Pending: {
      on: {
        PaymentReceivedEvent: ({ event }) => ({
          target: 'PaymentReceived',
          context: {
            customer: event.customer,
            payment: event.payment,
            funds: event.funds,
            accountId: event.accountId
          }
        })
      }
    },
    PaymentReceived: {
      invoke: {
        src: 'checkfunds',
        input: ({ context }) => ({
          account: context.accountId!,
          paymentamount: context.payment!.amount
        }),
        onDone: ({ context, event }) => ({
          target: 'ConfirmBasedOnFunds',
          context: { ...context, funds: event.output }
        })
      }
    },
    ConfirmBasedOnFunds: {
      always: ({ context }) => ({
        target: context.funds?.available
          ? 'SendPaymentSuccess'
          : 'SendInsufficientResults'
      })
    },
    SendPaymentSuccess: {
      invoke: {
        src: 'sendSuccessEmail',
        input: ({ context }) => ({ applicant: context.customer! }),
        onDone: { target: 'End' }
      }
    },
    SendInsufficientResults: {
      invoke: {
        src: 'sendInsufficientFundsEmail',
        input: ({ context }) => ({ applicant: context.customer! }),
        onDone: { target: 'End' }
      }
    },
    End: {
      type: 'final',
      entry: ({ context, parent }, enq) => {
        if (parent)
          enq.sendTo(parent, {
            type: 'ConfirmationCompletedEvent',
            payment: context.payment
          });
      }
    }
  }
});

export const parentWorkflow = createMachine({
  schemas: {
    context: types<{ confirmedPayment: Payment | null }>(),
    events: {
      PaymentReceivedEvent: types<Omit<PaymentReceivedEvent, 'type'>>(),
      ConfirmationCompletedEvent: types<{ payment: Payment }>()
    },
    children: { paymentconfirmation: types<ActorRefFrom<typeof workflow>>() },
    output: types<{ payment: Payment | null }>()
  },
  actors: { paymentconfirmation: workflow },
  context: { confirmedPayment: null },
  output: ({ context }) => ({ payment: context.confirmedPayment }),
  id: 'parent',
  initial: 'Waiting',
  states: {
    Waiting: {
      invoke: {
        id: 'paymentconfirmation',
        src: 'paymentconfirmation',
        onDone: { target: 'Completed' }
      },
      on: {
        PaymentReceivedEvent: ({ event, children }, enq) =>
          enq.sendTo(children.paymentconfirmation, event),
        ConfirmationCompletedEvent: ({ event }) => ({
          context: { confirmedPayment: event.payment }
        })
      }
    },
    Completed: { type: 'final' }
  }
});
