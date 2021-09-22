import { createSelector, createMachine } from '../src';

const machine = createMachine<{ count: number }>({
  context: {
    count: 0
  }
});

describe('createSelector', () => {
  it('Should create a function which can be used to extract info from a state', () => {
    const selector = createSelector(machine, (state) => state.context.count);

    expect(selector(machine.initialState)).toEqual(0);
  });

  it('Should correctly infer the type of the context', () => {
    createSelector(machine, (state) => {
      // @ts-expect-error
      state.context.doesNotExist;
    });
  });

  it('Should correctly infer the type of the state', () => {
    createSelector(machine, (state) => {
      // @ts-expect-error
      state.doesNotExist;
    });
  });
});
