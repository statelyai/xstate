import { types, createMachine } from 'xstate';

export const temperatureMachine = createMachine({
  schemas: {
    context: types<{ tempC?: number | string; tempF?: number | string }>(),
    events: {
      CELSIUS: types<{ value: string }>(),
      FAHRENHEIT: types<{ value: string }>()
    }
  },
  context: { tempC: undefined, tempF: undefined },
  on: {
    CELSIUS: ({ event }) => ({
      context: {
        tempC: event.value,
        tempF: event.value.trim() ? (+event.value * 9) / 5 + 32 : ''
      }
    }),
    FAHRENHEIT: ({ event }) => ({
      context: {
        tempF: event.value,
        tempC: event.value.trim() ? ((+event.value - 32) * 5) / 9 : ''
      }
    })
  }
});
