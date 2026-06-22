import { createMachine } from 'xstate';

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
    CELSIUS: ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          tempC: (({ event }) => event.value)({
            context: context,
            event: event
          }),
          tempF: (({ event }) =>
            event.value.length ? +event.value * (9 / 5) + 32 : '')({
            context: context,
            event: event
          })
        }
      };
    },
    FAHRENHEIT: ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          tempC: (({ event }) =>
            event.value.length ? (+event.value - 32) * (5 / 9) : '')({
            context: context,
            event: event
          }),
          tempF: (({ event }) => event.value)({
            context: context,
            event: event
          })
        }
      };
    }
  }
});
