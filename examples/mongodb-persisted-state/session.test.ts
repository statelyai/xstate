import { expect, test, vi } from 'vitest';
import type { Snapshot } from 'xstate';
import { createDonutSession } from './session';
import { TaskQueue } from './TaskQueue';

test('captures each snapshot before queueing and restores the last saved workflow', async () => {
  const saved: Snapshot<unknown>[] = [];
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const onError = vi.fn();
  const session = createDonutSession({
    save: async (snapshot) => {
      await blocked;
      saved.push(snapshot);
    },
    onError
  });
  session.actor.start();
  session.actor.send({ type: 'NEXT' });
  session.actor.send({ type: 'NEXT' });
  release();
  await session.flush();
  expect(saved).toMatchObject([
    { value: 'ingredients' },
    { value: { directions: 'makeDough' } },
    { value: { directions: { mix: { mixDry: 'mixing', mixWet: 'mixing' } } } }
  ]);
  session.actor.stop();
  const restored = createDonutSession({
    snapshot: saved.at(-1),
    save: async () => {},
    onError
  });
  restored.actor.start();
  expect(restored.actor.getSnapshot().value).toEqual({
    directions: { mix: { mixDry: 'mixing', mixWet: 'mixing' } }
  });
  restored.actor.stop();
  await restored.flush();
  expect(onError).not.toHaveBeenCalled();
});

test('a rejected task reports failure and does not strand subsequent writes', async () => {
  const queue = new TaskQueue();
  const calls: number[] = [];
  const failure = queue.addTask(() => {
    calls.push(1);
    return Promise.reject(new Error('offline'));
  });
  const success = queue.addTask(() => {
    calls.push(2);
    return Promise.resolve();
  });
  await expect(failure).rejects.toThrow('offline');
  await success;
  await queue.flush();
  expect(calls).toEqual([1, 2]);
});
