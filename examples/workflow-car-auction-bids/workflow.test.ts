import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
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
it('chooses the highest bid', async () => {
  const actor = createActor(workflow).start();
  actors.push(actor);
  const bidder = { id: 'p1', firstName: 'Ada', lastName: 'Lovelace' };
  for (const amount of [10, 30, 20])
    actor.send({ type: 'CarBidEvent', bid: { carid: 'c1', amount, bidder } });
  await vi.advanceTimersByTimeAsync(3000);
  expect(actor.getSnapshot().status).toBe('done');
  expect(actor.getSnapshot().output).toMatchObject({
    winningBid: { amount: 30 }
  });
});
it('completes an auction with no bids', async () => {
  const actor = createActor(workflow).start();
  actors.push(actor);
  await vi.advanceTimersByTimeAsync(3000);
  expect(actor.getSnapshot().status).toBe('done');
  expect(actor.getSnapshot().output).toEqual({ winningBid: undefined });
});
