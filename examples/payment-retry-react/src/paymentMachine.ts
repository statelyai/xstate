import { setup, types, createAsyncLogic } from 'xstate';

export const MAX_ATTEMPTS = 3;
const BASE_DELAY = 1_000;

export type Receipt = { id: string; amount: number };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The mock gateway is flaky: it fails until `failuresLeft` runs out. The
 * idempotency key is what lets it recognize retries of the same payment
 * instead of charging the customer once per attempt.
 */
const submitPayment = createAsyncLogic({
  schemas: {
    input: types<{
      amount: number;
      idempotencyKey: string;
      failuresLeft: number;
    }>()
  },
  run: async ({ input }): Promise<Receipt> => {
    await sleep(700);

    if (input.failuresLeft > 0) {
      throw new Error('Gateway timeout.');
    }

    return { id: input.idempotencyKey, amount: input.amount };
  }
});

type PaymentContext = {
  amount: number;
  /**
   * Generated once when the attempt series starts and reused by every retry,
   * so a request that actually reached the gateway can never be charged twice.
   */
  idempotencyKey: string;
  attempt: number;
  failuresLeft: number;
  receipt: Receipt | null;
  error: string | null;
};

export const paymentMachine = setup({
  schemas: {
    context: types<PaymentContext>(),
    events: {
      pay: types<{ amount: number; failures: number }>(),
      cancel: types<{}>(),
      reset: types<{}>()
    }
  },
  actors: { submitPayment },
  delays: {
    // Exponential backoff: 1s, 2s, 4s. The delay is a function of context.
    backoff: ({ context }: { context: PaymentContext }) =>
      BASE_DELAY * 2 ** (context.attempt - 1)
  }
}).createMachine({
  id: 'payment',
  context: {
    amount: 0,
    idempotencyKey: '',
    attempt: 0,
    failuresLeft: 0,
    receipt: null,
    error: null
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        pay: ({ event }) => ({
          target: 'submitting',
          context: {
            amount: event.amount,
            failuresLeft: event.failures,
            // One key for the whole retry series.
            idempotencyKey: crypto.randomUUID(),
            attempt: 1,
            receipt: null,
            error: null
          }
        })
      }
    },
    submitting: {
      invoke: {
        src: submitPayment,
        input: ({ context }) => ({
          amount: context.amount,
          idempotencyKey: context.idempotencyKey,
          failuresLeft: context.failuresLeft
        }),
        onDone: ({ event }) => ({
          target: 'succeeded',
          context: { receipt: event.output, error: null }
        }),
        onError: ({ context, event }) => {
          const error = (event.error as Error).message;
          const failuresLeft = Math.max(0, context.failuresLeft - 1);

          if (context.attempt >= MAX_ATTEMPTS) {
            return { target: 'failed' as const, context: { error } };
          }

          return {
            target: 'waiting' as const,
            context: { error, failuresLeft }
          };
        }
      },
      on: { cancel: { target: 'canceled' } }
    },
    waiting: {
      after: {
        backoff: ({ context }) => ({
          target: 'submitting',
          context: { attempt: context.attempt + 1 }
        })
      },
      on: { cancel: { target: 'canceled' } }
    },
    succeeded: {
      on: { reset: { target: 'idle' } }
    },
    failed: {
      on: { reset: { target: 'idle' } }
    },
    canceled: {
      on: { reset: { target: 'idle' } }
    }
  }
});
