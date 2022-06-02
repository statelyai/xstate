import { Machine, MachineConfig } from '../src';

const configWithStringInitial = {
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

const configWithFunctionInitial = {
  initial: () => 'a',
  states: {
    a: {
      initial: () => 'b',
      states: {
        b: {
          initial: () => 'c',
          states: {
            c: {}
          }
        }
      }
    },
    leaf: {}
  }
};

const createDeepMachine = (config: MachineConfig<any, any, any>) =>
  Machine(config);

const createParallelDeepMachine = (config: MachineConfig<any, any, any>) =>
  Machine({
    type: 'parallel',
    states: {
      foo: config,
      bar: config
    }
  });

const createDeepParallelMachine = (config: MachineConfig<any, any, any>) =>
  Machine({
    initial: 'one',
    states: {
      one: createParallelDeepMachine(config).config,
      two: createParallelDeepMachine(config).config
    }
  });

describe('Initial states', () => {
  it.each([
    ['string', createDeepMachine(configWithStringInitial)],
    ['function', createDeepMachine(configWithFunctionInitial)]
  ])('should return the correct initial state as %s', (_, deepMachine) => {
    expect(deepMachine.initialState.value).toEqual({ a: { b: 'c' } });
  });

  it.each([
    ['string', createParallelDeepMachine(configWithStringInitial)],
    ['function', createParallelDeepMachine(configWithFunctionInitial)]
  ])(
    'should return the correct initial state (parallel) as %s',
    (_, parallelDeepMachine) => {
      expect(parallelDeepMachine.initialState.value).toEqual({
        foo: { a: { b: 'c' } },
        bar: { a: { b: 'c' } }
      });
    }
  );

  it.each([
    ['string', createDeepParallelMachine(configWithStringInitial)],
    ['function', createDeepParallelMachine(configWithFunctionInitial)]
  ])(
    'should return the correct initial state (deep parallel) as %s',
    (_, deepParallelMachine) => {
      expect(deepParallelMachine.initialState.value).toEqual({
        one: {
          foo: { a: { b: 'c' } },
          bar: { a: { b: 'c' } }
        }
      });
    }
  );
});
