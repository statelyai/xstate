import { expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { tempMachine } from './tempMachine';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('converts both directions and clears both values for blank input', () => {
  const actor = createActor(tempMachine).start();
  actor.send({ type: 'changeC', value: '100' });
  expect(actor.getSnapshot().context).toEqual({
    celsius: 100,
    fahrenheit: 212
  });
  actor.send({ type: 'changeF', value: '32' });
  expect(actor.getSnapshot().context).toEqual({ celsius: 0, fahrenheit: 32 });
  actor.send({ type: 'changeC', value: 'bad' });
  expect(actor.getSnapshot().context.celsius).toBe(0);
  actor.send({ type: 'changeC', value: ' ' });
  expect(actor.getSnapshot().context).toEqual({
    celsius: undefined,
    fahrenheit: undefined
  });
  actor.stop();
});
