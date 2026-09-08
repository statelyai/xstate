import { expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { counterMachine } from './counterMachine';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('increments only after a committed event', () => {
  const actor = createActor(counterMachine).start();
  expect(actor.getSnapshot().can({ type: 'increase' })).toBe(true);
  expect(actor.getSnapshot().context.count).toBe(0);
  actor.send({ type: 'increase' });
  expect(actor.getSnapshot().context.count).toBe(1);
  actor.stop();
});
