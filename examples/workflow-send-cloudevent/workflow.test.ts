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
it('returns all provisioned order outcomes', async () => {
  const actor = createActor(workflow, {
    input: {
      orders: [
        { id: 'a', item: 'book', quantity: '2' },
        { id: 'b', item: 'pen', quantity: '3' }
      ]
    }
  }).start();
  actors.push(actor);
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().output).toEqual({
    provisionedOrders: [
      { id: 'a', outcome: 'SUCCESS' },
      { id: 'b', outcome: 'SUCCESS' }
    ]
  });
});
