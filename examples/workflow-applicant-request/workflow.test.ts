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
it.each([17, 18])('routes applicant age %i', async (age) => {
  const applicant = {
    fname: 'Ada',
    lname: 'Lovelace',
    age,
    email: 'ada@example.test'
  };
  const actor = createActor(workflow, { input: { applicant } }).start();
  actors.push(actor);
  actor.send({ type: 'Submit' });
  expect(actor.getSnapshot().value).toBe(
    age >= 18 ? 'StartApplication' : 'RejectApplication'
  );
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().status).toBe('done');
});
