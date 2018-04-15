import { assert } from 'chai';
import { Machine, State } from '../src/index';

describe('machine', () => {
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

  const lightMachine = Machine({
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

  const topLevelMachine = Machine({
    initial: 'Hidden',
    on: {
      CLICKED_CLOSE: '.Hidden'
    },
    states: {
      Hidden: {
        on: {
          PUBLISH_FAILURE: 'Failure'
        }
      },
      Failure: {}
    }
  });

  describe('machine.states', () => {
    it('should properly register machine states', () => {
      assert.deepEqual(Object.keys(lightMachine.states), [
        'green',
        'yellow',
        'red'
      ]);
    });
  });

  describe('machine.events', () => {
    it('should return the set of events accepted by machine', () => {
      assert.sameMembers(lightMachine.events, [
        'TIMER',
        'POWER_OUTAGE',
        'PED_COUNTDOWN'
      ]);
    });
  });

  describe('machine.initialState', () => {
    it('should return a State instance', () => {
      assert.instanceOf(lightMachine.initialState, State);
    });

    it('should return the initial state', () => {
      assert.equal(lightMachine.initialState.value, 'green');
    });
  });

  xit('should listen to events declared at top state', () => {
    const actualState = topLevelMachine.transition('Failure', 'CLICKED_CLOSE');

    assert.deepEqual(actualState.value, 'Hidden');
  });
});
