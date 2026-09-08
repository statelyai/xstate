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
it('requires every document before finalization', async () => {
  const actor = createActor(workflow, { input: { applicantId: 'a1' } }).start();
  actors.push(actor);
  actor.send({ type: 'ApplicationSubmitted' });
  actor.send({ type: 'SATScoresReceived' });
  expect(actor.getSnapshot().value).toBe('FinalizeApplication');
  actor.send({ type: 'RecommendationLetterReceived' });
  expect(actor.getSnapshot().value).toBe('FinalizingApplication');
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().status).toBe('done');
});
