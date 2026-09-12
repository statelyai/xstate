import { setup, types } from 'xstate';

interface TempContext {
  celsius: number | undefined;
  fahrenheit: number | undefined;
}

function parse(value: string): number | undefined | null {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isNaN(parsed) ? null : parsed;
}

const toFahrenheit = (celsius: number) => Math.round(celsius * (9 / 5) + 32);
const toCelsius = (fahrenheit: number) =>
  Math.round((fahrenheit - 32) * (5 / 9));

export const tempMachine = setup({
  schemas: {
    context: types<TempContext>(),
    events: {
      changeC: types<{ value: string }>(),
      changeF: types<{ value: string }>()
    }
  }
}).createMachine({
  id: 'tempConverter',
  context: {
    celsius: undefined,
    fahrenheit: undefined
  },
  on: {
    changeC: ({ event }) => {
      const celsius = parse(event.value);

      if (celsius === null) {
        return;
      }

      return {
        context: {
          celsius,
          fahrenheit: celsius === undefined ? undefined : toFahrenheit(celsius)
        }
      };
    },
    changeF: ({ event }) => {
      const fahrenheit = parse(event.value);

      if (fahrenheit === null) {
        return;
      }

      return {
        context: {
          fahrenheit,
          celsius: fahrenheit === undefined ? undefined : toCelsius(fahrenheit)
        }
      };
    }
  }
});
