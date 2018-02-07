import { assert } from 'chai';
import { Machine } from '../src/index';

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
      initial: 'walk',
      activities: ['activateCrosswalkLight'],
      states: {
        walk: { on: { PED_WAIT: 'wait' } },
        wait: {
          activities: ['blinkCrosswalkLight'],
          on: { PED_STOP: 'stop' }
        },
        stop: {}
      }
    }
  }
});

describe('activities', () => {
  it('identifies start activities', () => {
    assert.deepEqual(lightMachine.transition('yellow', 'TIMER').activities, {
      activateCrosswalkLight: true
    });
  });

  it('identifies start activities for child states and active activities', () => {
    const redWalkState = lightMachine.transition('yellow', 'TIMER');
    assert.deepEqual(
      lightMachine.transition(redWalkState, 'PED_WAIT').activities,
      {
        activateCrosswalkLight: true,
        blinkCrosswalkLight: true
      }
    );
  });

  it('identifies stop activities for child states', () => {
    const redWalkState = lightMachine.transition('yellow', 'TIMER');
    const redWaitState = lightMachine.transition(redWalkState, 'PED_WAIT');

    assert.deepEqual(
      lightMachine.transition(redWaitState, 'PED_STOP').activities,
      {
        activateCrosswalkLight: true,
        blinkCrosswalkLight: false
      }
    );
  });
});
