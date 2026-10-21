import { setup, types } from 'xstate';

interface TemperatureContext {
  tempC?: number | string;
  tempF?: number | string;
}

export const temperatureMachine = setup({
  schemas: {
    context: types<TemperatureContext>(),
    events: {
      CELSIUS: types<{ value: string }>(),
      FAHRENHEIT: types<{ value: string }>()
    }
  }
}).createMachine({
  context: { tempC: undefined, tempF: undefined },
  on: {
    CELSIUS: ({ event }) => ({
      context: {
        tempC: event.value,
        tempF: event.value.length ? +event.value * (9 / 5) + 32 : ''
      }
    }),
    FAHRENHEIT: ({ event }) => ({
      context: {
        tempC: event.value.length ? (+event.value - 32) * (5 / 9) : '',
        tempF: event.value
      }
    })
  }
});
