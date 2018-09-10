import { assert } from 'chai';
import { Machine } from '../src/index';

function noop(_x) {
  return;
}

describe('StateSchema', () => {
  const pedestrianStates = {
    initial: 'walk',
    states: {
      walk: {
        on: {
          PED_COUNTDOWN: 'wait'
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

  interface LightStateSchema {
    states: {
      green: any;
      yellow: any;
      red: any;
    };
  }

  const lightMachine = Machine<undefined, LightStateSchema>({
    key: 'light',
    initial: 'green',
    states: {
      green: {
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red'
        }
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        }
      },
      red: {
        on: {
          TIMER: 'green',
          POWER_OUTAGE: 'red'
        },
        ...pedestrianStates
      }
    }
  });

  noop(lightMachine);

  it('should work with a StateSchema defined', () => {
    assert.ok(true, 'Tests will not compile if types are wrong');
  });
});
