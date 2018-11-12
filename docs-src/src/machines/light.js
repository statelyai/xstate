import { Machine } from 'xstate';

const pedestrianStates = {
  initial: 'walk',
  states: {
    walk: {
      on: {
        PED_COUNTDOWN: 'wait',
        TIMER: undefined
      }
    },
    wait: {
      on: {
        PED_COUNTDOWN: 'stop'
      }
    },
    stop: {}
  }
};

const lightMachine = Machine({
  key: 'light',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: 'red'
      }
    },
    red: {
      on: {
        TIMER: 'green'
      },
      ...pedestrianStates
    }
  }
});

// Final states
const finalLightMachine = Machine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      on: { TIMER: 'yellow' }
    },
    yellow: {
      on: { TIMER: 'red' }
    },
    red: {
      type: 'parallel',
      states: {
        crosswalkNorth: {
          initial: 'walk',
          states: {
            walk: {
              on: { PED_WAIT: 'wait' }
            },
            wait: {
              on: { PED_STOP: 'stop' }
            },
            stop: {
              // 'stop' is a final state node for 'crosswalkNorth'
              type: 'final'
            }
          },
          onDone: {
            actions: 'stopCrosswalkNorth'
          }
        },
        crosswalkEast: {
          initial: 'walk',
          states: {
            walk: {
              on: { PED_WAIT: 'wait' }
            },
            wait: {
              on: { PED_STOP: 'stop' }
            },
            stop: {
              type: 'final'
            }
          },
          onDone: {
            // 'stop' is a final state node for 'crosswalkEast'
            actions: 'stopCrosswalkEast'
          }
        }
      },
      onDone: 'green'
    }
  }
});

const lightDelayMachine = Machine({
  id: 'lightDelay',
  initial: 'green',
  states: {
    green: {
      after: {
        // after 1 second, transition to yellow
        1000: 'yellow'
      }
    },
    yellow: {
      after: {
        // after 0.5 seconds, transition to red
        500: 'red'
      }
    },
    red: {
      after: {
        // after 2 seconds, transition to green
        2000: 'green'
      }
    }
  }
});

export { lightMachine, finalLightMachine, lightDelayMachine };
