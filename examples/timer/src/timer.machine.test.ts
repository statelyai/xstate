import { expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { timerMachine } from './timerMachine';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('cannot start empty and stops ticking at zero or reset', () => {
  vi.useFakeTimers();
  const actor = createActor(timerMachine).start();
  expect(actor.getSnapshot().can({ type: 'start' })).toBe(false);
  actor.send({ type: 'second' });
  actor.send({ type: 'start' });
  vi.advanceTimersByTime(2000);
  expect(actor.getSnapshot().context.seconds).toBe(0);
  expect(actor.getSnapshot().matches('stopped')).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  actor.send({ type: 'minute' });
  actor.send({ type: 'start' });
  actor.send({ type: 'reset' });
  expect(actor.getSnapshot().matches('stopped')).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  actor.stop();
});
