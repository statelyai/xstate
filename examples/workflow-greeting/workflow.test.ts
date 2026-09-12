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
it('passes input through its async greeting', async () => {
  const actor = createActor(workflow, {
    input: { person: { name: 'Ada' } }
  }).start();
  actors.push(actor);
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().output).toEqual({ greeting: 'Hello, Ada!' });
});
