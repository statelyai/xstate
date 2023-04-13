import { createMachine, assign } from '../../src';

// @ts-ignore
const factorialMachine = createMachine<{ n: number; fac: number }>({
  initial: 'iteration',
  context: { n: 5, fac: 1 },
  states: {
    iteration: {
      on: {
        ITERATE: [
          {
            target: 'iteration',
            guard: ({ context }) => context.n > 0,
            actions: [
              assign({
                fac: ({ context }) => context.n * context.fac,
                n: ({ context }) => context.n - 1
              })
            ]
          },
          { target: 'done' }
        ]
      }
    },
    done: {
      entry: [({ context }) => console.log(`The answer is ${context.fac}`)]
    }
  }
});

// @ts-ignore
const testMachine = createMachine<{ count: number }>({
  context: { count: 11 },
  initial: 'init',
  states: {
    init: {
      on: {
        ADD: [
          {
            target: 'one',
            guard: ({ context }) => context.count === 1
          },
          {
            target: 'init',
            guard: ({ context }) => context.count % 2 === 0,
            actions: [
              assign({
                count: ({ context }) => context.count / 2
              })
            ]
          },
          {
            target: 'init',
            actions: [
              assign({
                count: ({ context }) => context.count * 3 + 1
              })
            ]
          }
        ]
      }
    },
    one: {}
  }
});
