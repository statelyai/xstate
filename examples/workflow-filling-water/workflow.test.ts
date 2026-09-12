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
it('increments the water level and exits once full', async () => {
  const actor = createActor(workflow, {
    input: { current: 0, max: 2 }
  }).start();
  actors.push(actor);
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().context.counts).toEqual({ current: 2, max: 2 });
  expect(actor.getSnapshot().status).toBe('done');
});

it('does not add water when already full', () => {
  const actor = createActor(workflow, {
    input: { current: 2, max: 2 }
  }).start();
  actors.push(actor);
  expect(actor.getSnapshot().status).toBe('done');
  expect(actor.getSnapshot().context.counts.current).toBe(2);
});
