import { Machine, actions } from '../../src';
const { assign } = actions;

// @ts-ignore
const factorialMachine = Machine<{ n: number; fac: number }>(
  {
    initial: 'iteration',
    states: {
      iteration: {
        on: {
          ITERATE: [
            {
              target: 'iteration',
              cond: (xs) => xs.n > 0,
              actions: [
                assign({
                  fac: (xs) => xs.n * xs.fac,
                  n: (xs) => xs.n - 1
                })
              ]
            },
            { target: 'done' }
          ]
        }
      },
      done: {
        onEntry: [(xs) => console.log(`The answer is ${xs.fac}`)]
      }
    }
  },
  {},
  { n: 5, fac: 1 }
);

// @ts-ignore
const testMachine = Machine<{ count: number }>(
  {
    initial: 'init',
    states: {
      init: {
        on: {
          ADD: [
            {
              target: 'one',
              cond: (xs) => xs.count === 1
            },
            {
              target: 'init',
              cond: (xs) => xs.count % 2 === 0,
              actions: [
                assign({
                  count: (xs) => xs.count / 2
                })
              ]
            },
            {
              target: 'init',
              actions: [
                assign({
                  count: (xs) => xs.count * 3 + 1
                })
              ]
            }
          ]
        }
      },
      one: {}
    }
  },
  {},
  { count: 11 }
);
