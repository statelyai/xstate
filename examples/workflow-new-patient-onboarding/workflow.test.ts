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
it('completes the sequential onboarding work', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
  const actor = createActor(workflow).start();
  actors.push(actor);
  actor.send({ type: 'NewPatientEvent', name: 'Ada', condition: 'Checkup' });
  await vi.advanceTimersByTimeAsync(3000);
  expect(actor.getSnapshot().status).toBe('done');
  expect(actor.getSnapshot().context.patient).toBeNull();
});

it('retries a temporary service failure before continuing onboarding', async () => {
  vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.9);
  const actor = createActor(workflow).start();
  actors.push(actor);
  actor.send({ type: 'NewPatientEvent', name: 'Ada', condition: 'Checkup' });
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().status).toBe('active');
  expect(console.log).toHaveBeenCalledWith('Retrying...', expect.anything());
  await vi.advanceTimersByTimeAsync(6000);
  expect(actor.getSnapshot().status).toBe('done');
});
