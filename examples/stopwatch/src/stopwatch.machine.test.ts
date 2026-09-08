import { expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { stopwatchMachine } from './stopwatchMachine';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('pauses, resumes and cleans up ticks on reset and actor stop', () => {
  vi.useFakeTimers();
  const actor = createActor(stopwatchMachine).start();
  actor.send({ type: 'start' });
  vi.advanceTimersByTime(50);
  expect(actor.getSnapshot().context.elapsed).toBe(5);
  actor.send({ type: 'stop' });
  vi.advanceTimersByTime(50);
  expect(actor.getSnapshot().context.elapsed).toBe(5);
  expect(vi.getTimerCount()).toBe(0);
  actor.send({ type: 'start' });
  vi.advanceTimersByTime(10);
  expect(actor.getSnapshot().context.elapsed).toBe(6);
  actor.send({ type: 'reset' });
  expect(actor.getSnapshot().context.elapsed).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  actor.send({ type: 'start' });
  actor.stop();
  expect(vi.getTimerCount()).toBe(0);
});
