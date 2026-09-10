import { setup, types } from 'xstate';

export const EXPENSE_EVENTS = ['submit', 'approve', 'reject', 'pay'] as const;

export type ExpenseEvent =
  | { type: 'submit'; amount: number }
  | { type: 'approve'; approver: string }
  | { type: 'reject'; reason: string }
  | { type: 'pay' };

/**
 * One workflow instance per expense report. The Lambda handler owns no state
 * of its own: every fact the workflow needs lives in this machine's snapshot.
 */
export const expenseMachine = setup({
  schemas: {
    context: types<{
      amount: number;
      approver: string | null;
      reason: string | null;
    }>(),
    events: {
      submit: types<{ amount: number }>(),
      approve: types<{ approver: string }>(),
      reject: types<{ reason: string }>(),
      pay: types<{}>()
    }
  },
  guards: {
    /** Small expenses skip review entirely. */
    isAutoApproved: (amount: number) => amount <= 100
  }
}).createMachine({
  id: 'expense',
  context: { amount: 0, approver: null, reason: null },
  initial: 'draft',
  states: {
    draft: {
      on: {
        submit: ({ event, guards }) => {
          const autoApproved = guards.isAutoApproved(event.amount);

          return {
            target: autoApproved ? 'approved' : 'inReview',
            context: {
              amount: event.amount,
              approver: autoApproved ? 'auto' : null
            }
          };
        }
      }
    },
    inReview: {
      on: {
        approve: ({ event }) => ({
          target: 'approved',
          context: { approver: event.approver }
        }),
        reject: ({ event }) => ({
          target: 'rejected',
          context: { reason: event.reason }
        })
      }
    },
    approved: {
      on: { pay: { target: 'paid' } }
    },
    rejected: { type: 'final' },
    paid: { type: 'final' }
  }
});
