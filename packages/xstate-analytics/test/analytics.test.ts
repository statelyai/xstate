import { createAnalyzer } from '../src/index.ts';
import { createMachine, createActor } from 'xstate';

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
  // TODO: re-enable when we land on the new inspection API
  it.skip('analyzes transition counts', () => {
    let analysis: any = {};

    const service = createActor(lightMachine);

    service.subscribe(
      createAnalyzer((a) => {
        analysis = a;
      })
    );

    service.start();

    service.send({ type: 'TIMER' });
    service.send({ type: 'TIMER' });

    expect(analysis).toMatchInlineSnapshot(`
      {
        "count": 3,
        "transitions": {
          "": {
            "{"type":"xstate.init"}": {
              "count": 1,
              "currentWeight": 1,
              "relativeWeight": 1,
              "state": "{"value":"green","context":{}}",
              "weight": 0.3333333333333333,
            },
          },
          "{"value":"green","context":{}}": {
            "{"type":"TIMER"}": {
              "count": 1,
              "currentWeight": 1,
              "relativeWeight": 1,
              "state": "{"value":"yellow","context":{}}",
              "weight": 0.3333333333333333,
            },
          },
          "{"value":"yellow","context":{}}": {
            "{"type":"TIMER"}": {
              "count": 1,
              "currentWeight": 1,
              "relativeWeight": 1,
              "state": "{"value":{"red":"walk"},"context":{}}",
              "weight": 0.3333333333333333,
            },
          },
        },
      }
    `);
  });
});
