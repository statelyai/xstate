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
it('completes a confirmed and shipped order', () => {
  const actor = createActor(workflow).start();
  actors.push(actor);
  for (const type of [
    'OrderCreatedEvent',
    'OrderConfirmedEvent',
    'ShipmentSentEvent'
  ] as const)
    actor.send({ type });
  expect(actor.getSnapshot().value).toBe('OrderFinished');
  expect(actor.getSnapshot().status).toBe('done');
  expect(console.log).toHaveBeenCalledWith('logOrderFinished');
});
it('cancels an order after its deadline', async () => {
  const actor = createActor(workflow).start();
  actors.push(actor);
  await vi.advanceTimersByTimeAsync(16000);
  expect(actor.getSnapshot().value).toBe('OrderCancelled');
  expect(actor.getSnapshot().status).toBe('done');
});
