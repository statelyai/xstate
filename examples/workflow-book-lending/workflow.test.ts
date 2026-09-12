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
it('keeps the lender and completes an available-book checkout', async () => {
  const lender = { name: 'Ada', address: 'Example', phone: '555-0100' };
  const actor = createActor(workflow).start();
  actors.push(actor);
  actor.send({
    type: 'bookLendingRequest',
    book: { id: 'b1', title: 'Book' },
    lender
  });
  await vi.advanceTimersByTimeAsync(3000);
  expect(actor.getSnapshot().context.lender).toEqual(lender);
  expect(actor.getSnapshot().status).toBe('done');
});

it.each(['holdBook', 'declineBookhold'] as const)(
  'handles the on-loan lender response %s',
  async (type) => {
    const lender = { name: 'Ada', address: 'Example', phone: '555-0100' };
    const actor = createActor(
      workflow.provide({
        actors: {
          'Get status for book': createAsyncLogic({
            schemas: { input: types<{ bookid: string }>() },
            run: () => Promise.resolve({ status: 'onloan' as const })
          })
        }
      })
    ).start();
    actors.push(actor);
    actor.send({
      type: 'bookLendingRequest',
      book: { id: 'b1', title: 'Book' },
      lender
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(actor.getSnapshot().value).toBe('Wait for Lender response');
    actor.send({ type });
    await vi.advanceTimersByTimeAsync(1000);
    expect(actor.getSnapshot().value).toBe(
      type === 'holdBook' ? 'Sleep two weeks' : 'End'
    );
  }
);
