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
    // Small expenses skip review entirely.
    isAutoApproved: ({ event }: { event: { amount: number } }) =>
      event.amount <= 100
  }
}).createMachine({
  id: 'expense',
  context: { amount: 0, approver: null, reason: null },
  initial: 'draft',
  states: {
    draft: {
      on: {
        submit: ({ event, guards }) => ({
          target: guards.isAutoApproved({ event }) ? 'approved' : 'inReview',
          context: {
            amount: event.amount,
            approver: guards.isAutoApproved({ event }) ? 'auto' : null
          }
        })
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
