import { setup, types } from '../../../src/index.ts';

type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type ChildContext = Record<`f${Digit}${Digit}`, string>;

export const childMachine = setup({
  schemas: {
    context: types<ChildContext>(),
    input: types<{ token: string }>(),
    events: {
      a: types<{ value: string }>(),
      b: types<{ value: string }>(),
      c: types<{ value: string }>()
    }
  }
}).createMachine({
  context: {} as ChildContext,
  initial: 'c0',
  states: {
    c0: {
      on: {
        a: ({ context }) => ({ target: 'c1' as const, context }),
        b: ({ context }) => ({ target: 'c2' as const, context }),
        c: ({ context }) => ({ target: 'c0' as const, context })
      }
    },
    c1: {
      on: {
        a: ({ context }) => ({ target: 'c2' as const, context }),
        b: ({ context }) => ({ target: 'c0' as const, context }),
        c: ({ context }) => ({ target: 'c1' as const, context })
      }
    },
    c2: {
      on: {
        a: ({ context }) => ({ target: 'c0' as const, context }),
        b: ({ context }) => ({ target: 'c1' as const, context }),
        c: ({ context }) => ({ target: 'c2' as const, context })
      }
    }
  }
});
