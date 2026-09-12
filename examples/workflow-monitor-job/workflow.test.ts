import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createActor, createAsyncLogic, types } from 'xstate';
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
it('reports a completed job after submission and polling', async () => {
  const actor = createActor(workflow, {
    input: { job: { name: 'report' } }
  }).start();
  actors.push(actor);
  await vi.advanceTimersByTimeAsync(5000);
  expect(actor.getSnapshot().context.jobuid).toBe('123');
  expect(actor.getSnapshot().context.jobStatus).toBe('SUCCEEDED');
  expect(actor.getSnapshot().status).toBe('done');
});

it('reports a failed job', async () => {
  const actor = createActor(
    workflow.provide({
      actors: {
        checkJobStatus: createAsyncLogic({
          schemas: { input: types<{ name: string }>() },
          run: () => Promise.resolve({ jobStatus: 'FAILED' as const })
        })
      }
    }),
    { input: { job: { name: 'report' } } }
  ).start();
  actors.push(actor);
  await vi.advanceTimersByTimeAsync(5000);
  expect(actor.getSnapshot().context.jobStatus).toBe('FAILED');
  expect(actor.getSnapshot().status).toBe('done');
  expect(console.log).toHaveBeenCalledWith(
    'Starting reportJobFailed',
    undefined
  );
});
