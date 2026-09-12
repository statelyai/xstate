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
it('reports accumulated readings then clears the next window', async () => {
  const actor = createActor(workflow).start();
  actors.push(actor);
  actor.send({ type: 'TemperatureEvent', roomId: 'r1', temperature: 22 });
  actor.send({ type: 'HumidityEvent', roomId: 'r1', humidity: 40 });
  await vi.advanceTimersByTimeAsync(10000);
  expect(console.log).toHaveBeenCalledWith('Starting ProduceReport', {
    temperature: 22,
    humidity: 40
  });
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().value).toBe('ConsumeReading');
  expect(actor.getSnapshot().context).toEqual({
    temperature: null,
    humidity: null
  });
});

it('rearms an incomplete window without losing its collected reading', async () => {
  const actor = createActor(workflow).start();
  actors.push(actor);
  actor.send({ type: 'TemperatureEvent', roomId: 'r1', temperature: 22 });
  await vi.advanceTimersByTimeAsync(10000);
  expect(actor.getSnapshot().context.temperature).toBe(22);
  actor.send({ type: 'HumidityEvent', roomId: 'r1', humidity: 40 });
  await vi.advanceTimersByTimeAsync(10000);
  expect(console.log).toHaveBeenCalledWith('Starting ProduceReport', {
    temperature: 22,
    humidity: 40
  });
  await vi.advanceTimersByTimeAsync(1000);
  expect(actor.getSnapshot().context).toEqual({
    temperature: null,
    humidity: null
  });
});
