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

const services: Record<string, any> = {
  cloneCollection: fromPromise(async () => {
    const resp = await delay(2000, 0.4);
    return resp;
  }),
  recreateIndexes: fromPromise(async () => {
    const resp = await delay(1000);
    return resp;
  }),
  createNewList: fromPromise(async () => {
    const resp = await delay(1000);
    return resp;
  }),
  updateSampleDate: fromPromise(async () => {
    const resp = await delay(1000);
    return resp;
  }),
  copyViews: fromPromise(async () => {
    const resp = await delay(1000);
    return resp;
  }),
  deleteCollection: fromPromise(async () => {
    const resp = await delay(1000);
    return resp;
  }),
  deleteList: fromPromise(async () => {
    const resp = await delay(1000);
    return resp;
  }),
  deleteViews: fromPromise(async () => {
    const resp = await delay(1000);
    return resp;
  })
};

export const actors: Record<string, any> = {};
Object.keys(services).forEach(
  (key) =>
    (actors[key] = RunServiceMachine.provide({
      actors: { upDownService: services[key] }
    }))
);
