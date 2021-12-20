import { createAnalyzer } from '../src';
import { createMachine, interpret } from 'xstate';

const pedestrianStates = {
  initial: 'walk',
  states: {
    walk: {
      on: {
        PED_COUNTDOWN: 'wait'
      },
      entry: 'enter_walk',
      exit: 'exit_walk'
    },
    wait: {
      on: {
        PED_COUNTDOWN: 'stop'
      },
      entry: 'enter_wait',
      exit: 'exit_wait'
    },
    stop: {
      entry: ['enter_stop'],
      exit: ['exit_stop']
    }
  }
};

const lightMachine = createMachine({
  key: 'light',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow',
        POWER_OUTAGE: 'red',
        NOTHING: 'green'
      },
      entry: 'enter_green',
      exit: 'exit_green'
    },
    yellow: {
      on: {
        TIMER: 'red',
        POWER_OUTAGE: 'red'
      },
      entry: 'enter_yellow',
      exit: 'exit_yellow'
    },
    red: {
      on: {
        TIMER: 'green',
        POWER_OUTAGE: 'red',
        NOTHING: 'red'
      },
      entry: 'enter_red',
      exit: 'exit_red',
      ...pedestrianStates
    }
  }
});

describe('@xstate/analytics', () => {
  it('analyzes transition counts', () => {
    let analysis: any = {};

    const service = interpret(lightMachine);

    service.subscribe(
      createAnalyzer((a) => {
        analysis = a;
      })
    );

    service.start();

    service.send('TIMER');
    service.send('TIMER');

    expect(analysis).toMatchInlineSnapshot(`
      Object {
        "count": 3,
        "transitions": Object {
          "": Object {
            "{\\"type\\":\\"TIMER\\"}": Object {
              "count": 2,
              "currentWeight": 0.6666666666666666,
              "relativeWeight": 0.6666666666666666,
              "state": "{\\"value\\":\\"yellow\\",\\"context\\":{}}",
              "weight": 0.6666666666666666,
            },
            "{\\"type\\":\\"xstate.init\\"}": Object {
              "count": 1,
              "currentWeight": 0.3333333333333333,
              "relativeWeight": 0.3333333333333333,
              "state": "{\\"value\\":\\"green\\",\\"context\\":{}}",
              "weight": 0.3333333333333333,
            },
          },
        },
      }
    `);
  });
});
