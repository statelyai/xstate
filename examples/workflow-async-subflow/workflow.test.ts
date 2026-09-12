import { expect, it, vi } from 'vitest';
import { createActor, toPromise } from 'xstate';
import { createWorkflow, type Prompt } from './workflow.ts';

it('waits for both prompts and personalizes the nested prompt', async () => {
  let finish!: (value: string) => void;
  const prompt = vi
    .fn<Prompt>()
    .mockResolvedValueOnce('Ada')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
  const actor = createActor(createWorkflow(prompt)).start();
  await vi.waitFor(() => expect(prompt).toHaveBeenCalledTimes(2));
  expect(prompt.mock.calls[1][0]).toContain('Welcome Ada');
  expect(actor.getSnapshot().status).toBe('active');
  finish('');
  await toPromise(actor);
  expect(actor.getSnapshot().matches('Onboarded')).toBe(true);
});
it('stopping the parent aborts an outstanding nested prompt', () => {
  let signal!: AbortSignal;
  const actor = createActor(
    createWorkflow((_question, abortSignal) => {
      signal = abortSignal;
      return new Promise(() => {});
    })
  ).start();
  expect(signal.aborted).toBe(false);
  actor.stop();
  expect(signal.aborted).toBe(true);
});
it('propagates prompt failures and stops onboarding', async () => {
  const failure = new Error('prompt unavailable');
  const actor = createActor(createWorkflow(() => Promise.reject(failure)));
  actor.subscribe({ error: () => {} });
  actor.start();
  await expect(toPromise(actor)).rejects.toBe(failure);
  expect(actor.getSnapshot().status).toBe('error');
});
