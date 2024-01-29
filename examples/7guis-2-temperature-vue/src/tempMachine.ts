import { assign, setup } from 'xstate';

interface TempContext {
  celsius: number | undefined;
  fahrenheit: number | undefined;
}

interface changeC {
  type: 'changeC';
  value: string;
}

interface changeF {
  type: 'changeF';
  value: string;
}

const isOnlyWhiteSpace = (string: string) => string.trim().length === 0;

export const tempMachine = setup({
  types: {
    context: {} as TempContext,
    events: {} as changeC | changeF
  },
  guards: {
    valueIsNumber: ({ event }) => {
      return !isNaN(+event.value);
    }
  },
  actions: {
    onChangeC: assign({
      celsius: ({ event }) =>
        isOnlyWhiteSpace(event.value) ? undefined : +event.value,
      fahrenheit: ({ event }) =>
        isOnlyWhiteSpace(event.value)
          ? undefined
          : Math.round(+event.value * (9 / 5) + 32)
    }),
    onChangeF: assign({
      fahrenheit: ({ event }) =>
        isOnlyWhiteSpace(event.value) ? undefined : +event.value,
      celsius: ({ event }) =>
        isOnlyWhiteSpace(event.value)
          ? undefined
          : Math.round((+event.value - 32) * (5 / 9))
    })
  }
}).createMachine({
  id: 'tempConverter',
  initial: 'ready',
  context: {
    celsius: undefined,
    fahrenheit: undefined
  },
  states: {
    ready: {
      on: {
        changeC: {
          target: 'ready',
          guard: 'valueIsNumber',
          actions: {
            type: 'onChangeC'
          }
        },
        changeF: {
          target: 'ready',
          guard: 'valueIsNumber',
          actions: {
            type: 'onChangeF'
          }
        }
      }
    }
  }
});
