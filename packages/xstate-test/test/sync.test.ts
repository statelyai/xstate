import { createMachine } from 'xstate';
import { createTestModel } from '../src';

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

const promiseStateModel = createTestModel(machine, {
  states: {
    a: async () => {},
    b: () => {}
  },
  events: {
    EVENT: () => {}
  }
});

const promiseEventModel = createTestModel(machine, {
  states: {
    a: () => {},
    b: () => {}
  },
  events: {
    EVENT: {
      exec: async () => {}
    }
  }
});

const syncModel = createTestModel(machine, {
  states: {
    a: () => {},
    b: () => {}
  },
  events: {
    EVENT: {
      exec: () => {}
    }
  }
});

describe('.testPathSync', () => {
  it('Should error if it encounters a promise in a state', () => {
    expect(() =>
      promiseStateModel
        .getPaths()
        .forEach((path) => promiseStateModel.testPathSync(path))
    ).toThrowError(
      `The test for 'a' returned a promise - did you mean to use the sync method?`
    );
  });

  it('Should error if it encounters a promise in an event', () => {
    expect(() =>
      promiseEventModel
        .getPaths()
        .forEach((path) => promiseEventModel.testPathSync(path))
    ).toThrowError(
      `The event 'EVENT' returned a promise - did you mean to use the sync method?`
    );
  });

  it('Should succeed if it encounters no promises', () => {
    expect(() =>
      syncModel.getPaths().forEach((path) => syncModel.testPathSync(path))
    ).not.toThrow();
  });
});
