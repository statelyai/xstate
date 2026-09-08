import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createActor, createAsyncLogic, types } from 'xstate';
import { workflow } from './workflow.ts';
const actors: { stop(): unknown }[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  for (const actor of actors.splice(0)) actor.stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('applies an approved credit decision', async () => {
  const customer = {
    id: 'c1',
    name: 'Ada',
    SSN: 123,
    yearlyIncome: 50000,
    address: 'Example',
    employer: 'Example'
  };
  const actor = createActor(workflow, { input: { customer } }).start();
  actors.push(actor);
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().context.creditCheck?.decision).toBe('Approved');
  expect(actor.getSnapshot().status).toBe('done');
});

it('rejects a denied credit decision', async () => {
  const customer = {
    id: 'c1',
    name: 'Ada',
    SSN: 123,
    yearlyIncome: 50000,
    address: 'Example',
    employer: 'Example'
  };
  const actor = createActor(
    workflow.provide({
      actors: {
        callCreditCheckMicroservice: createAsyncLogic({
          schemas: { input: types<{ customer: typeof customer }>() },
          run: () =>
            Promise.resolve({
              id: 'c1',
              score: 200,
              decision: 'Denied' as const,
              reason: 'Denied'
            })
        })
      }
    }),
    { input: { customer } }
  ).start();
  actors.push(actor);
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().context.creditCheck?.decision).toBe('Denied');
  expect(actor.getSnapshot().status).toBe('done');
  expect(console.log).toHaveBeenCalledWith('sending rejection email', {
    applicant: customer
  });
});
