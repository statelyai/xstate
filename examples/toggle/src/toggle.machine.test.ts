import { expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { toggleMachine } from './toggleMachine';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('toggles both ways', () => {
  const actor = createActor(toggleMachine).start();
  actor.send({ type: 'toggle' });
  expect(actor.getSnapshot().matches('active')).toBe(true);
  actor.send({ type: 'toggle' });
  expect(actor.getSnapshot().matches('inactive')).toBe(true);
  actor.stop();
});
