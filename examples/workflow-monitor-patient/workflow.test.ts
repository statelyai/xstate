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
it('dispatches the matching patient action', () => {
  const actor = createActor(workflow, { input: { patientId: 'p1' } }).start();
  actors.push(actor);
  actor.send({
    type: 'org.monitor.highBodyTemp',
    source: 'monitoringSource',
    id: 'e1',
    time: '2026-01-01',
    patientId: 'p1',
    data: { value: 'high' }
  });
  expect(console.log).toHaveBeenCalledWith(
    'Executing sendTylenolOrder for patient:',
    'p1'
  );
  expect(actor.getSnapshot().status).toBe('active');
});
