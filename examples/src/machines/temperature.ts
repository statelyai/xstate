import { Machine, actions } from 'xstate';
const { assign } = actions;

const context = {
  C: '' as string | number,
  F: '' as string | number
};

type TemperatureCtx = typeof context;

export const temperatureMachine = Machine<TemperatureCtx>({
  id: 'temperature',
  initial: 'empty',
  context,
  states: {
    empty: {},
    celsius: {
      initial: 'valid',
      states: {
        valid: {},
        invalid: {}
      },
      on: {
        change: [
          {
            target: '.valid',
            actions: assign<TemperatureCtx>({
              C: (_, e) => e.target.value,
              F: (_, e) => +e.target.value * (9 / 5) + 32
            }),
            cond: (_, e) => !isNaN(e.target.value) && e.target.value.length
          },
          {
            target: '.invalid',
            actions: assign<TemperatureCtx>({
              C: (_, e) => e.target.value
            })
          }
        ]
      }
    },
    fahrenheit: {
      initial: 'valid',
      states: {
        valid: {},
        invalid: {}
      },
      on: {
        change: [
          {
            target: '.valid',
            actions: assign<TemperatureCtx>({
              F: (_, e) => e.target.value,
              C: (_, e) => (+e.target.value - 32) * (5 / 9)
            }),
            cond: (_, e) => !isNaN(e.target.value) && e.target.value.length
          },
          {
            target: '.invalid',
            actions: assign<TemperatureCtx>({
              F: (_, e) => e.target.value
            })
          }
        ]
      }
    }
  },
  on: {
    FOCUS_C: '.celsius',
    FOCUS_F: '.fahrenheit'
  }
});
