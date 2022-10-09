import { createMachine } from '../src';
import { raise } from '../src/actions/raise';

describe('machine.microstep()', () => {
  it('should return an array of states from all microsteps', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            GO: 'a'
          }
        },
        a: {
          entry: raise('NEXT'),
          on: {
            NEXT: 'b'
          }
        },
        b: {
          always: 'c'
        },
        c: {
          entry: raise('NEXT'),
          on: {
            NEXT: 'd'
          }
        },
        d: {}
      }
    });

    const states = machine.microstep(machine.initialState, { type: 'GO' });

    expect(states.map((s) => s.value)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('should return the states from microstep (transient)', () => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          on: {
            TRIGGER: 'second'
          }
        },
        second: {
          always: 'third'
        },
        third: {}
      }
    });

    const states = machine.microstep(
      machine.resolveStateValue('first'),
      'TRIGGER',
      undefined
    );

    expect(states.map((s) => s.value)).toEqual(['second', 'third']);
  });

  it('should return the states from microstep (raised event)', () => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          on: {
            TRIGGER: {
              target: 'second',
              actions: raise('RAISED')
            }
          }
        },
        second: {
          on: {
            RAISED: 'third'
          }
        },
        third: {}
      }
    });

    const states = machine.microstep(
      machine.resolveStateValue('first'),
      'TRIGGER',
      undefined
    );

    expect(states.map((s) => s.value)).toEqual(['second', 'third']);
  });

  it('should return a single-item array for normal transitions', () => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          on: {
            TRIGGER: 'second'
          }
        },
        second: {}
      }
    });

    const states = machine.microstep(machine.initialState, 'TRIGGER');

    expect(states.map((s) => s.value)).toEqual(['second']);
  });
});
