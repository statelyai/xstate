import { createMachine, Machine } from '../src/index';

describe('state meta data', () => {
  const pedestrianStates = {
    initial: 'walk',
    states: {
      walk: {
        meta: { walkData: 'walk data' },
        on: {
          PED_COUNTDOWN: 'wait'
        },
        onEntry: 'enter_walk',
        onExit: 'exit_walk'
      },
      wait: {
        meta: { waitData: 'wait data' },
        on: {
          PED_COUNTDOWN: 'stop'
        },
        onEntry: 'enter_wait',
        onExit: 'exit_wait'
      },
      stop: {
        meta: { stopData: 'stop data' },
        onEntry: 'enter_stop',
        onExit: 'exit_stop'
      }
    }
  };

  const lightMachine = Machine({
    key: 'light',
    initial: 'green',
    states: {
      green: {
        meta: ['green', 'array', 'data'],
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red',
          NOTHING: 'green'
        },
        onEntry: 'enter_green',
        onExit: 'exit_green'
      },
      yellow: {
        meta: { yellowData: 'yellow data' },
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        },
        onEntry: 'enter_yellow',
        onExit: 'exit_yellow'
      },
      red: {
        meta: {
          redData: {
            nested: {
              red: 'data',
              array: [1, 2, 3]
            }
          }
        },
        on: {
          TIMER: 'green',
          POWER_OUTAGE: 'red',
          NOTHING: 'red'
        },
        onEntry: 'enter_red',
        onExit: 'exit_red',
        ...pedestrianStates
      }
    }
  });

  it('states should aggregate meta data', () => {
    const yellowState = lightMachine.transition('green', 'TIMER');
    expect(yellowState.meta).toEqual({
      'light.yellow': {
        yellowData: 'yellow data'
      }
    });
    expect('light.green' in yellowState.meta).toBeFalsy();
    expect('light' in yellowState.meta).toBeFalsy();
  });

  it('states should aggregate meta data (deep)', () => {
    expect(lightMachine.transition('yellow', 'TIMER').meta).toEqual({
      'light.red': {
        redData: {
          nested: {
            array: [1, 2, 3],
            red: 'data'
          }
        }
      },
      'light.red.walk': {
        walkData: 'walk data'
      }
    });
  });
});

describe('transition meta data', () => {
  it('should show meta data in transitions', () => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            EVENT: {
              target: 'active',
              meta: {
                description: 'Going from inactive to active'
              }
            }
          }
        },
        active: {}
      }
    });

    const nextState = machine.transition(undefined, 'EVENT');

    expect(nextState.transitions.map((t) => t.meta)).toMatchInlineSnapshot(`
      Array [
        Object {
          "description": "Going from inactive to active",
        },
      ]
    `);
  });
});
