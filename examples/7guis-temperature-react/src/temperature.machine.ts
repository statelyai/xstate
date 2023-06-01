import { createMachine, assign } from 'xstate';

interface TemperatureContext {
  tempC?: number | string;
  tempF?: number | string;
}

type TemperatureEvent =
  | {
      type: 'CELSIUS';
      value: string;
    }
  | {
      type: 'FAHRENHEIT';
      value: string;
    };

export const temperatureMachine = createMachine({
  types: {} as {
    context: TemperatureContext;
    events: TemperatureEvent;
  },
  context: { tempC: undefined, tempF: undefined },
  on: {
    CELSIUS: {
      actions: assign({
        tempC: ({ event }) => event.value,
        tempF: ({ event }) =>
          event.value.length ? +event.value * (9 / 5) + 32 : ''
      })
    },
    FAHRENHEIT: {
      actions: assign({
        tempC: ({ event }) =>
          event.value.length ? (+event.value - 32) * (5 / 9) : '',
        tempF: ({ event }) => event.value
      })
    }
  }
});
