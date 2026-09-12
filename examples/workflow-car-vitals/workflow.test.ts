import { expect, it, vi } from 'vitest';
import {
  createActor,
  createAsyncLogic,
  SimulatedClock,
  types,
  waitFor,
  toPromise
} from 'xstate';
import { workflow, vitalsWorkflow } from './workflow.ts';

function controlledChecks() {
  const requests: {
    signal: AbortSignal;
    resolve: (value: { value: number }) => void;
    reject: (error: Error) => void;
  }[] = [];
  const check = createAsyncLogic({
    schemas: { output: types<{ value: number }>() },
    run: ({ signal }) =>
      new Promise<{ value: number }>((resolve, reject) =>
        requests.push({ signal, resolve, reject })
      )
  });
  const logic = vitalsWorkflow.provide({
    actors: {
      checkTirePressure: check,
      checkOilPressure: check,
      checkCoolantLevel: check,
      checkBattery: check
    }
  });
  return { requests, logic };
}
it('waits for all four concurrent checks, repeats, and cancels on car off', async () => {
  const { requests, logic } = controlledChecks();
  const clock = new SimulatedClock();
  const report = vi.fn();
  const actor = createActor(
    workflow.provide({
      actors: { vitalscheck: logic },
      actions: { report, carOff: () => {} }
    }),
    { clock }
  ).start();
  actor.send({ type: 'CarTurnedOnEvent' });
  expect(requests).toHaveLength(4);
  requests.slice(0, 3).forEach((request, i) => request.resolve({ value: i }));
  await Promise.resolve();
  await Promise.resolve();
  expect(actor.getSnapshot().matches('DoCarVitalChecks')).toBe(true);
  requests[3].resolve({ value: 3 });
  await waitFor(actor, (snapshot) =>
    snapshot.matches('CheckContinueVitalChecks')
  );
  expect(report).toHaveBeenCalledTimes(1);
  expect(actor.getSnapshot().context.lastReadings?.tirePressure).toEqual({
    value: 0
  });
  clock.increment(1000);
  expect(requests).toHaveLength(8);
  actor.send({ type: 'CarTurnedOffEvent' });
  expect(requests.slice(4).every((request) => request.signal.aborted)).toBe(
    true
  );
  clock.increment(10000);
  expect(requests).toHaveLength(8);
  expect(actor.getSnapshot().matches('WhenCarIsOn')).toBe(true);
  actor.stop();
});
it('a failed check aborts the other checks and surfaces the failure', async () => {
  const { requests, logic } = controlledChecks();
  const actor = createActor(logic);
  actor.subscribe({ error: () => {} });
  actor.start();
  const failure = new Error('sensor unavailable');
  const result = toPromise(actor);
  requests[0].reject(failure);
  await expect(result).rejects.toBe(failure);
  expect(requests.slice(1).every((request) => request.signal.aborted)).toBe(
    true
  );
});
