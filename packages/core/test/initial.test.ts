import { createMachine } from '../src';

const config = {
  initial: 'a',
  states: {
    a: {
      initial: 'b',
      states: {
        b: {
          initial: 'c',
          states: {
            c: {}
          }
        }
      }
    },
    leaf: {}
  }
};

const deepMachine = createMachine(config);

const parallelDeepMachine = createMachine({
  type: 'parallel',
  states: {
    foo: config,
    bar: config
  }
});

const deepParallelMachine = createMachine({
  initial: 'one',
  states: {
    one: parallelDeepMachine.config,
    two: parallelDeepMachine.config
  }
});

describe('Initial states', () => {
  it('should return the correct initial state', () => {
    expect(deepMachine.initialState.value).toEqual({ a: { b: 'c' } });
  });

  it('should return the correct initial state (parallel)', () => {
    expect(parallelDeepMachine.initialState.value).toEqual({
      foo: { a: { b: 'c' } },
      bar: { a: { b: 'c' } }
    });
  });

  it('should return the correct initial state (deep parallel)', () => {
    expect(deepParallelMachine.initialState.value).toEqual({
      one: {
        foo: { a: { b: 'c' } },
        bar: { a: { b: 'c' } }
      }
    });
  });
});
