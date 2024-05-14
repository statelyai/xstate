import { createMachine } from 'xstate';
import { createTestModel } from '../src/index.ts';

const machine = createMachine({
  initial: 'a',
  states: {
    a: {
      on: {
        EVENT: 'b'
      }
    },
    b: {}
  }
});

const promiseStateModel = createTestModel(machine);

const promiseEventModel = createTestModel(machine);

const syncModel = createTestModel(machine);

describe('.testPathSync', () => {
  it('Should error if it encounters a promise in a state', () => {
    expect(() =>
      promiseStateModel.getShortestPaths().forEach((path) =>
        promiseStateModel.testPathSync(path, {
          states: {
            a: async () => {},
            b: () => {}
          },
          events: {
            EVENT: () => {}
          }
        })
      )
    ).toThrowError(
      `The test for 'a' returned a promise - did you mean to use the sync method?`
    );
  });

  it('Should error if it encounters a promise in an event', () => {
    expect(() =>
      promiseEventModel.getShortestPaths().forEach((path) =>
        promiseEventModel.testPathSync(path, {
          states: {
            a: () => {},
            b: () => {}
          },
          events: {
            EVENT: async () => {}
          }
        })
      )
    ).toThrowError(
      `The event 'EVENT' returned a promise - did you mean to use the sync method?`
    );
  });

  it('Should succeed if it encounters no promises', () => {
    expect(() =>
      syncModel.getShortestPaths().forEach((path) =>
        syncModel.testPathSync(path, {
          states: {
            a: () => {},
            b: () => {}
          },
          events: {
            EVENT: () => {}
          }
        })
      )
    ).not.toThrow();
  });
});
