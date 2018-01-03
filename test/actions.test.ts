import { assert } from 'chai';
import { Machine } from '../src/index';
import { StateValueMap } from '../src/types';

describe('onEntry/onExit actions', () => {
  const pedestrianStates = {
    initial: 'walk',
    states: {
      walk: {
        on: {
          PED_COUNTDOWN: 'wait'
        },
        onEntry: 'enter_walk',
        onExit: 'exit_walk'
      },
      wait: {
        on: {
          PED_COUNTDOWN: 'stop'
        },
        onEntry: 'enter_wait',
        onExit: 'exit_wait'
      },
      stop: {
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
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red',
          NOTHING: 'green'
        },
        onEntry: 'enter_green',
        onExit: 'exit_green'
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        },
        onEntry: 'enter_yellow',
        onExit: 'exit_yellow'
      },
      red: {
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

  const parallelMachine = Machine({
    parallel: true,
    states: {
      a: {
        initial: 'a1',
        states: {
          a1: {
            on: { CHANGE: { a2: { actions: ['do_a2'] } } },
            onEntry: 'enter_a1',
            onExit: 'exit_a1'
          },
          a2: { onEntry: 'enter_a2', onExit: 'exit_a2' }
        },
        onEntry: 'enter_a',
        onExit: 'exit_a'
      },
      b: {
        initial: 'b1',
        states: {
          b1: {
            on: { CHANGE: { b2: { actions: ['do_b2'] } } },
            onEntry: 'enter_b1',
            onExit: 'exit_b1'
          },
          b2: { onEntry: 'enter_b2', onExit: 'exit_b2' }
        },
        onEntry: 'enter_b',
        onExit: 'exit_b'
      }
    }
  });

  const deepMachine = Machine({
    initial: 'a',
    states: {
      a: {
        initial: 'a1',
        states: {
          a1: {
            onEntry: 'enter_a1',
            onExit: 'exit_a1'
          }
        },
        onEntry: 'enter_a',
        onExit: 'exit_a',
        on: { CHANGE: 'b' }
      },
      b: {
        onEntry: 'enter_b',
        onExit: 'exit_b',
        initial: 'b1',
        states: {
          b1: {
            onEntry: 'enter_b1',
            onExit: 'exit_b1'
          }
        }
      }
    }
  });

  describe('State.actions', () => {
    it('should return the entry and exit actions of a transition', () => {
      assert.deepEqual(lightMachine.transition('green', 'TIMER').actions, [
        'exit_green',
        'enter_yellow'
      ]);
    });

    it('should return the entry and exit actions of a deep transition', () => {
      assert.deepEqual(lightMachine.transition('yellow', 'TIMER').actions, [
        'exit_yellow',
        'enter_red',
        'enter_walk'
      ]);
    });

    it('should return the entry and exit actions of a nested transition', () => {
      assert.deepEqual(
        lightMachine.transition('red.walk', 'PED_COUNTDOWN').actions,
        ['exit_walk', 'enter_wait']
      );
    });

    it('should not have actions for unchanged transitions (shallow)', () => {
      assert.deepEqual(lightMachine.transition('green', 'NOTHING').actions, []);
    });

    it('should not have actions for unchanged transitions (deep)', () => {
      assert.deepEqual(lightMachine.transition('red', 'NOTHING').actions, []);
    });

    it('should return actions for parallel machines', () => {
      assert.deepEqual(
        parallelMachine.transition(
          parallelMachine.initialState as StateValueMap,
          'CHANGE'
        ).actions,
        ['exit_b1', 'exit_a1', 'do_a2', 'do_b2', 'enter_a2', 'enter_b2']
      );
    });

    it('should return nested actions in the correct (child to parent) order', () => {
      assert.deepEqual(deepMachine.transition('a.a1', 'CHANGE').actions, [
        'exit_a1',
        'exit_a',
        'enter_b',
        'enter_b1'
      ]);
    });
  });
});
