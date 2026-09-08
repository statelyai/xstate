import { expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { friendsMachine } from './friendsMachine';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('uses the event name, supports cancel/save, and stops removed children', async () => {
  vi.useFakeTimers();
  const actor = createActor(friendsMachine).start();
  actor.send({ type: 'FRIENDS.ADD', name: 'Ada' });
  const friend = actor.getSnapshot().context.friends[0].ref;
  expect(friend.getSnapshot().context.name).toBe('Ada');
  friend.send({ type: 'EDIT' });
  friend.send({ type: 'SET_NAME', value: 'Grace' });
  friend.send({ type: 'CANCEL' });
  expect(friend.getSnapshot().context.name).toBe('Ada');
  friend.send({ type: 'EDIT' });
  friend.send({ type: 'SET_NAME', value: 'Grace' });
  friend.send({ type: 'SAVE' });
  await vi.advanceTimersByTimeAsync(1000);
  expect(friend.getSnapshot().context.prevName).toBe('Grace');
  actor.send({ type: 'FRIEND.REMOVE', index: 0 });
  expect(friend.getSnapshot().status).toBe('stopped');
  expect(actor.getSnapshot().context.friends).toEqual([]);
  actor.stop();
});
