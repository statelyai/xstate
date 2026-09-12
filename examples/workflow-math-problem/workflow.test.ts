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
it('collects results for every input expression', async () => {
  const actor = createActor(workflow, {
    input: { expressions: ['2+2', '3*4'] }
  }).start();
  actors.push(actor);
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().output).toEqual({
    results: ['Solved 2+2', 'Solved 3*4']
  });
});
