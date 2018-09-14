import { assert } from 'chai';
import { Machine } from '../src/index';

function noop(_x) {
  return;
}

describe('StateSchema', () => {
  interface LightStateSchema {
    data: {
      interval: number;
    };
    states: {
      green: {
        data: { name: string };
      };
      yellow: {};
      red: {
        states: {
          walk: any;
          wait: any;
          stop: any;
        };
      };
    };
  }

  type LightEvents =
    | { type: 'TIMER' }
    | { type: 'POWER_OUTAGE' }
    | { type: 'PED_COUNTDOWN'; duration: number };

  const lightMachine = Machine<undefined, LightStateSchema, LightEvents>({
    key: 'light',
    initial: 'green',
    data: { interval: 1000 },
    states: {
      green: {
        data: { name: 'greenLight' },
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
        initial: 'walk',
        states: {
          walk: {
            on: {
              PED_COUNTDOWN: 'wait'
            }
          },
          wait: {
            on: {
              PED_COUNTDOWN: {
                target: 'stop',
                cond: (_, e) => {
                  return e.duration === 0;
                }
              }
            }
          },
          stop: {}
        }
      }
    }
  });

  noop(lightMachine);

  it('should work with a StateSchema defined', () => {
    assert.ok(true, 'Tests will not compile if types are wrong');
  });
});
