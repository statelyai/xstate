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
it('finishes with the greeting output', () => {
  const actor = createActor(workflow).start();
  actors.push(actor);
  expect(actor.getSnapshot().output).toEqual({ result: 'Hello World!' });
  expect(actor.getSnapshot().status).toBe('done');
});
