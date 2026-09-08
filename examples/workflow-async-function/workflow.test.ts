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
it('waits for the simulated email function to finish', async () => {
  const actor = createActor(workflow, {
    input: { customer: 'ada@example.test' }
  }).start();
  actors.push(actor);
  expect(actor.getSnapshot().status).toBe('active');
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().status).toBe('done');
  expect(console.log).toHaveBeenCalledWith('Email sent to', 'ada@example.test');
});
