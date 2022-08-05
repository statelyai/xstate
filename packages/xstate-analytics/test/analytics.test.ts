// import { Machine, StateNode } from 'xstate';
import { createAnalyzer } from '../src';
import { Machine, interpret } from 'xstate';

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

const lightMachine = Machine({
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
            "{\\"type\\":\\"xstate.init\\"}": Object {
              "count": 1,
              "currentWeight": 1,
              "relativeWeight": 1,
              "state": "{\\"value\\":\\"green\\"}",
              "weight": 0.3333333333333333,
            },
          },
          "{\\"value\\":\\"green\\"}": Object {
            "{\\"type\\":\\"TIMER\\"}": Object {
              "count": 1,
              "currentWeight": 1,
              "relativeWeight": 1,
              "state": "{\\"value\\":\\"yellow\\"}",
              "weight": 0.3333333333333333,
            },
          },
          "{\\"value\\":\\"yellow\\"}": Object {
            "{\\"type\\":\\"TIMER\\"}": Object {
              "count": 1,
              "currentWeight": 1,
              "relativeWeight": 1,
              "state": "{\\"value\\":{\\"red\\":\\"walk\\"}}",
              "weight": 0.3333333333333333,
            },
          },
        },
      }
    `);
  });
});
