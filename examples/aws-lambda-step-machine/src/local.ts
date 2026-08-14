import type { Context } from 'aws-lambda';
import {
  createStepHandler,
  inspector,
  type ExpenseSnapshot,
  type StepRequest
} from './handler';
import { createMemoryStore } from './storage';

/**
 * Invokes the handler function directly, three times, against one shared
 * in-memory store — the same shape as three separate Lambda invocations
 * hitting the same DynamoDB row.
 */
const handler = createStepHandler(createMemoryStore<ExpenseSnapshot>());

// The handler never reads the Lambda context, so a stub is enough.
const context = {} as Context;

const requests: StepRequest[] = [
  { expenseId: 'exp-1', event: { type: 'submit', amount: 480 } },
  { expenseId: 'exp-1', event: { type: 'approve', approver: 'dana' } },
  { expenseId: 'exp-1', event: { type: 'pay' } }
];

for (const request of requests) {
  const response = await handler(request, context, () => {});
  console.log(
    `${request.event.type} -> ${JSON.stringify(response?.state)}`,
    JSON.stringify({ ...response?.context, next: response?.nextEvents })
  );
}

inspector?.destroy();
