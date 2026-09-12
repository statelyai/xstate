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
it('waits for a greeting event and returns its result', async () => {
  const actor = createActor(workflow).start();
  actors.push(actor);
  expect(actor.getSnapshot().value).toBe('Waiting');
  actor.send({ type: 'greet', greet: { name: 'Ada' } });
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().output).toEqual({ greeting: 'Hello, Ada!' });
});
