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

export const temperatureMachine = createMachine<
  TemperatureContext,
  TemperatureEvent
>({
  initial: 'active',
  context: { tempC: undefined, tempF: undefined },
  states: {
    active: {
      on: {
        CELSIUS: {
          actions: assign({
            tempC: (_, event) => event.value,
            tempF: (_, event) =>
              event.value.length ? +event.value * (9 / 5) + 32 : ''
          })
        },
        FAHRENHEIT: {
          actions: assign({
            tempC: (_, event) =>
              event.value.length ? (+event.value - 32) * (5 / 9) : '',
            tempF: (_, event) => event.value
          })
        }
      }
    }
  }
});
