import { types, createMachine } from 'xstate';

interface TempContext {
  celsius: number | undefined;
  fahrenheit: number | undefined;
}

export const tempMachine = createMachine({
  schemas: {
    context: types<TempContext>(),
    events: {
      changeC: types<{ value: string }>(),
      changeF: types<{ value: string }>()
    }
  },
  context: { celsius: undefined, fahrenheit: undefined },
  on: {
    changeC: ({ event }) => {
      if (isNaN(+event.value)) return;
      const celsius = event.value.trim() ? +event.value : undefined;
      return {
        context: {
          celsius,
          fahrenheit:
            celsius === undefined
              ? undefined
              : Math.round((celsius * 9) / 5 + 32)
        }
      };
    },
    changeF: ({ event }) => {
      if (isNaN(+event.value)) return;
      const fahrenheit = event.value.trim() ? +event.value : undefined;
      return {
        context: {
          fahrenheit,
          celsius:
            fahrenheit === undefined
              ? undefined
              : Math.round(((fahrenheit - 32) * 5) / 9)
        }
      };
    }
  }
});
