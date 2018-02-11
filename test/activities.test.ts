import { assert } from 'chai';
import { Machine } from '../src/index';
import { start, stop } from '../src/actions';

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
      on: {
        TIMER: 'green'
      },
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
    const nextState = lightMachine.transition('yellow', 'TIMER');
    assert.deepEqual(nextState.activities, {
      activateCrosswalkLight: true
    });
    assert.sameDeepMembers(nextState.actions, [
      start('activateCrosswalkLight')
    ]);
  });

  it('identifies start activities for child states and active activities', () => {
    const redWalkState = lightMachine.transition('yellow', 'TIMER');
    const nextState = lightMachine.transition(redWalkState, 'PED_WAIT');
    assert.deepEqual(nextState.activities, {
      activateCrosswalkLight: true,
      blinkCrosswalkLight: true
    });
    assert.sameDeepMembers(nextState.actions, [start('blinkCrosswalkLight')]);
  });

  it('identifies stop activities for child states', () => {
    const redWalkState = lightMachine.transition('yellow', 'TIMER');
    const redWaitState = lightMachine.transition(redWalkState, 'PED_WAIT');
    const nextState = lightMachine.transition(redWaitState, 'PED_STOP');

    assert.deepEqual(nextState.activities, {
      activateCrosswalkLight: true,
      blinkCrosswalkLight: false
    });
    assert.sameDeepMembers(nextState.actions, [stop('blinkCrosswalkLight')]);
  });

  it('identifies multiple stop activities for child and parent states', () => {
    const redWalkState = lightMachine.transition('yellow', 'TIMER');
    const redWaitState = lightMachine.transition(redWalkState, 'PED_WAIT');
    const redStopState = lightMachine.transition(redWaitState, 'PED_STOP');
    const nextState = lightMachine.transition(redStopState, 'TIMER');

    assert.deepEqual(nextState.activities, {
      activateCrosswalkLight: false,
      blinkCrosswalkLight: false
    });
    assert.sameDeepMembers(nextState.actions, [stop('activateCrosswalkLight')]);
  });
});
