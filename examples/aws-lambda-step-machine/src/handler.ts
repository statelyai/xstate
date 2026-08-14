import type { Handler } from 'aws-lambda';
import { createActor, type SnapshotFrom } from 'xstate';
import {
  EXPENSE_EVENTS,
  expenseMachine,
  type ExpenseEvent
} from './expenseMachine';
import { createMemoryStore, type SnapshotStore } from './storage';
import { createInspector } from '@statelyai/sdk';

export const inspector = process.env.INSPECT ? createInspector() : undefined;

export type StepRequest = {
  /** Which workflow instance this invocation belongs to. */
  expenseId: string;
  event: ExpenseEvent;
};

export type StepResponse = {
  expenseId: string;
  state: unknown;
  context: { amount: number; approver: string | null; reason: string | null };
  done: boolean;
  /** Which events the workflow will accept next. */
  nextEvents: string[];
};

/**
 * A Lambda invocation is short-lived, so the actor is too: restore it from the
 * store, apply one event, persist the new snapshot, respond, stop.
 */
export type ExpenseSnapshot = SnapshotFrom<typeof expenseMachine>;

export function createStepHandler(
  store: SnapshotStore<ExpenseSnapshot>
): Handler<StepRequest, StepResponse> {
  return async (request) => {
    const persisted = await store.get(request.expenseId);

    const actor = createActor(expenseMachine, {
      // `undefined` starts a fresh workflow; anything else resumes one.
      snapshot: persisted,
      inspect: inspector?.inspect
    });

    actor.start();
    actor.send(request.event);

    const snapshot = actor.getSnapshot();
    // `getPersistedSnapshot()` is typed as the generic `Snapshot<unknown>`,
    // while `createActor({ snapshot })` wants this machine's snapshot type,
    // so the store is typed by what it restores.
    await store.put(
      request.expenseId,
      actor.getPersistedSnapshot() as ExpenseSnapshot
    );
    actor.stop();

    return {
      expenseId: request.expenseId,
      state: snapshot.value,
      context: snapshot.context,
      done: snapshot.status === 'done',
      nextEvents: EXPENSE_EVENTS.filter((type) =>
        snapshot.can({ type } as ExpenseEvent)
      )
    };
  };
}

/**
 * The deployed entry point. Swap `createMemoryStore()` for a DynamoDB store
 * (see `storage.ts`) to survive across invocations.
 */
export const handler = createStepHandler(createMemoryStore<ExpenseSnapshot>());
