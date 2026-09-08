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
it('returns to idle with the appointment payload', async () => {
  const patientInfo = { name: 'Ada', pet: 'Cat', reason: 'Checkup' };
  const actor = createActor(workflow).start();
  actors.push(actor);
  actor.send({ type: 'MakeVetAppointment', patientInfo });
  await vi.advanceTimersByTimeAsync(2000);
  expect(actor.getSnapshot().value).toBe('Idle');
  expect(actor.getSnapshot().context.appointmentInfo).toEqual({
    appointmentId: '1234',
    appointmentDate: expect.any(String)
  });
});
