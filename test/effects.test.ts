import { assert } from 'chai';
import { Machine, State } from '../src/index';
import { StateValue } from '../src/types';

describe('onEntry/onExit effects', () => {
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
          a1: { on: { CHANGE: 'a2' }, onEntry: 'enter_a1', onExit: 'exit_a1' },
          a2: { onEntry: 'enter_a2', onExit: 'exit_a2' }
        },
        onEntry: 'enter_a',
        onExit: 'exit_a'
      },
      b: {
        initial: 'b1',
        states: {
          b1: { on: { CHANGE: 'b2' }, onEntry: 'enter_b1', onExit: 'exit_b1' },
          b2: { onEntry: 'enter_b2', onExit: 'exit_b2' }
        },
        onEntry: 'enter_b',
        onExit: 'exit_b'
      }
    }
  });

  describe('State.effects', () => {
    it('should return the entry and exit effects of a transition', () => {
      assert.deepEqual(
        (lightMachine.transition('green', 'TIMER') as State).effects,
        {
          entry: ['enter_yellow'],
          exit: ['exit_green']
        }
      );
    });

    it('should return the entry and exit effects of a deep transition', () => {
      assert.deepEqual(
        (lightMachine.transition('yellow', 'TIMER') as State).effects,
        {
          entry: ['enter_red', 'enter_walk'],
          exit: ['exit_yellow']
        }
      );
    });

    it('should return the entry and exit effects of a nested transition', () => {
      assert.deepEqual(
        (lightMachine.transition('red.walk', 'PED_COUNTDOWN') as State).effects,
        {
          entry: ['enter_wait'],
          exit: ['exit_walk']
        }
      );
    });

    it('should not have effects for unchanged transitions (shallow)', () => {
      assert.deepEqual(
        (lightMachine.transition('green', 'NOTHING') as State).effects,
        {
          entry: [],
          exit: []
        }
      );
    });

    it('should not have effects for unchanged transitions (deep)', () => {
      assert.deepEqual(
        (lightMachine.transition('red', 'NOTHING') as State).effects,
        {
          entry: [],
          exit: []
        }
      );
    });

    it('should return effects for parallel machines', () => {
      assert.deepEqual(
        (parallelMachine.transition(
          parallelMachine.initialState as StateValue,
          'CHANGE'
        ) as State).effects,
        {
          entry: ['enter_a2', 'enter_b2'],
          exit: ['exit_a1', 'exit_b1']
        }
      );
    });
  });
});
