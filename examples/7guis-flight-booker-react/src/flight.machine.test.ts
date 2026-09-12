import { expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { flightBookerMachine } from './machines/flightMachine';
import { TODAY, TOMORROW } from './utils';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('validates return dates and waits for booking completion', async () => {
  vi.useFakeTimers();
  const actor = createActor(flightBookerMachine).start();
  actor.send({ type: 'CHANGE_DEPART_DATE', value: '2000-01-01' });
  expect(actor.getSnapshot().can({ type: 'BOOK_DEPART' })).toBe(false);
  actor.send({ type: 'CHANGE_DEPART_DATE', value: TODAY });
  actor.send({ type: 'CHANGE_TRIP_TYPE' });
  actor.send({ type: 'CHANGE_RETURN_DATE', value: TODAY });
  expect(actor.getSnapshot().can({ type: 'BOOK_RETURN' })).toBe(false);
  actor.send({ type: 'CHANGE_RETURN_DATE', value: TOMORROW });
  actor.send({ type: 'BOOK_RETURN' });
  expect(actor.getSnapshot().matches('booking')).toBe(true);
  await vi.advanceTimersByTimeAsync(2000);
  expect(actor.getSnapshot().status).toBe('done');
  expect(actor.getSnapshot().context.isRoundTrip).toBe(true);
  actor.stop();
});
