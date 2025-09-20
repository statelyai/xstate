import { fromPromise } from 'xstate';
import { RunServiceMachine } from './machines';

export async function delay(
  ms: number,
  errorProbability: number = 0
): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < errorProbability) {
        reject({ type: 'ServiceNotAvailable' });
      } else {
        resolve();
      }
    }, ms);
  });
}

export function createActors(errorProbability = 0.6) {
  const services: Record<string, any> = {
    'up-step1-system1': fromPromise(async () => {
      const resp = await delay(1000);
      return resp;
    }),
    'up-step2-system1': fromPromise(async () => {
      const resp = await delay(1000, errorProbability);
      return resp;
    }),
    'up-step3-system2': fromPromise(async () => {
      const resp = await delay(1000);
      return resp;
    }),
    'up-step4-system1': fromPromise(async () => {
      const resp = await delay(1000);
      return resp;
    }),
    'up-step5-system3': fromPromise(async () => {
      const resp = await delay(1000);
      return resp;
    }),
    'down-step1-system1': fromPromise(async () => {
      const resp = await delay(1000);
      return resp;
    }),
    'down-step2-system2': fromPromise(async () => {
      const resp = await delay(1000);
      return resp;
    }),
    'down-step3-system3': fromPromise(async () => {
      const resp = await delay(1000);
      return resp;
    })
  };

  const actors: Record<string, any> = {};
  Object.keys(services).forEach(
    (key) =>
      (actors[key] = RunServiceMachine.provide({
        actors: { upDownService: services[key] }
      }))
  );

  return actors;
}
