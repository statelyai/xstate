import { expect, it, vi } from 'vitest';
import { createActor, createAsyncLogic, types, toPromise } from 'xstate';
import {
  workflow,
  parentWorkflow,
  type PaymentReceivedEvent
} from './workflow.ts';

const payment = (amount: number): PaymentReceivedEvent => ({
  type: 'PaymentReceivedEvent',
  accountId: 'account-42',
  payment: { amount },
  customer: { name: 'Ada' },
  funds: { available: false }
});
it.each([true, false])(
  'passes the account and customer through the %s funds branch to its parent',
  async (available) => {
    const check = vi.fn((_input: { account: string; paymentamount: number }) =>
      Promise.resolve({ available })
    );
    const success = vi.fn(
      async (_input: { applicant: { name: string } }) => {}
    );
    const insufficient = vi.fn(
      async (_input: { applicant: { name: string } }) => {}
    );
    const child = workflow.provide({
      actors: {
        checkfunds: createAsyncLogic({
          schemas: {
            input: types<{ account: string; paymentamount: number }>(),
            output: types<{ available: boolean }>()
          },
          run: ({ input }) => check(input)
        }),
        sendSuccessEmail: createAsyncLogic({
          schemas: { input: types<{ applicant: { name: string } }>() },
          run: ({ input }) => success(input)
        }),
        sendInsufficientFundsEmail: createAsyncLogic({
          schemas: { input: types<{ applicant: { name: string } }>() },
          run: ({ input }) => insufficient(input)
        })
      }
    });
    const actor = createActor(
      parentWorkflow.provide({ actors: { paymentconfirmation: child } })
    ).start();
    actor.send(payment(100));
    expect(await toPromise(actor)).toEqual({ payment: { amount: 100 } });
    expect(check).toHaveBeenCalledExactlyOnceWith({
      account: 'account-42',
      paymentamount: 100
    });
    expect(available ? success : insufficient).toHaveBeenCalledExactlyOnceWith({
      applicant: { name: 'Ada' }
    });
    expect(available ? insufficient : success).not.toHaveBeenCalled();
  }
);
it('stopping the parent aborts its child funds request', () => {
  let signal!: AbortSignal;
  const child = workflow.provide({
    actors: {
      checkfunds: createAsyncLogic({
        schemas: {
          input: types<{ account: string; paymentamount: number }>(),
          output: types<{ available: boolean }>()
        },
        run: (args) => {
          signal = args.signal;
          return new Promise(() => {});
        }
      })
    }
  });
  const actor = createActor(
    parentWorkflow.provide({ actors: { paymentconfirmation: child } })
  ).start();
  actor.send(payment(100));
  expect(signal.aborted).toBe(false);
  actor.stop();
  expect(signal.aborted).toBe(true);
});
