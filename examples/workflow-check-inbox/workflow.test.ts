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
it('checks the inbox on schedule and cleans up its timer', async () => {
  const actor = createActor(workflow).start();
  actors.push(actor);
  await vi.advanceTimersByTimeAsync(3500);
  expect(actor.getSnapshot().value).toBe('Idle');
  expect(actor.getSnapshot().context.messages).toHaveLength(2);
  expect(console.log).toHaveBeenCalledWith('text sent', 'Hello');
  expect(console.log).not.toHaveBeenCalledWith('text sent', 'Hi');
  actor.stop();
  expect(vi.getTimerCount()).toBe(0);
});
