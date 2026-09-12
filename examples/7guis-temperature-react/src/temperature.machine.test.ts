import { expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { temperatureMachine } from './temperatureMachine';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('preserves editable text while converting the other scale', () => {
  const actor = createActor(temperatureMachine).start();
  actor.send({ type: 'CELSIUS', value: '100' });
  expect(actor.getSnapshot().context).toEqual({ tempC: '100', tempF: 212 });
  actor.send({ type: 'FAHRENHEIT', value: '32' });
  expect(actor.getSnapshot().context).toEqual({ tempC: 0, tempF: '32' });
  actor.send({ type: 'FAHRENHEIT', value: '' });
  expect(actor.getSnapshot().context).toEqual({ tempC: '', tempF: '' });
  actor.stop();
});
