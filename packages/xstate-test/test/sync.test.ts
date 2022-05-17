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

describe('.testPlanSync', () => {
  it('Should error if it encounters a promise in a state', () => {
    expect(() =>
      promiseStateModel
        .getPlans()
        .forEach((plan) => promiseStateModel.testPlanSync(plan))
    ).toThrowError(
      `The test for 'a' returned a promise - did you mean to use the sync method?`
    );
  });

  it('Should error if it encounters a promise in an event', () => {
    expect(() =>
      promiseEventModel
        .getPlans()
        .forEach((plan) => promiseEventModel.testPlanSync(plan))
    ).toThrowError(
      `The event 'EVENT' returned a promise - did you mean to use the sync method?`
    );
  });

  it('Should succeed if it encounters no promises', () => {
    expect(() =>
      syncModel.getPlans().forEach((plan) => syncModel.testPlanSync(plan))
    ).not.toThrow();
  });
});
