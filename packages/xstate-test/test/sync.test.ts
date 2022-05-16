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

describe('.testPlansSync', () => {
  it('Should error if it encounters a promise in a state', () => {
    expect(() =>
      promiseStateModel.testPlansSync(promiseStateModel.getShortestPlans())
    ).toThrowError(
      `The test for 'a' returned a promise - did you mean to use the sync method?`
    );
  });

  it('Should error if it encounters a promise in an event', () => {
    expect(() =>
      promiseEventModel.testPlansSync(promiseEventModel.getShortestPlans())
    ).toThrowError(
      `The event 'EVENT' returned a promise - did you mean to use the sync method?`
    );
  });

  it('Should succeed if it encounters no promises', () => {
    expect(() =>
      syncModel.testPlansSync(syncModel.getShortestPlans())
    ).not.toThrow();
  });
});
