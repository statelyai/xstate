import { createMachine } from '../src/index.ts';
import { raise } from '../src/actions/raise';
import { simulate } from '../src/simulate.ts';

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
          entry: raise({ type: 'NEXT' }),
          on: {
            NEXT: 'b'
          }
        },
        b: {
          always: 'c'
        },
        c: {
          entry: raise({ type: 'NEXT' }),
          on: {
            NEXT: 'd'
          }
        },
        d: {}
      }
    });

    const states = simulate(machine).microstep(undefined, { type: 'GO' });

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

    const states = simulate(machine).microstep(
      machine.resolveStateValue('first'),
      { type: 'TRIGGER' }
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
              actions: raise({ type: 'RAISED' })
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

    const states = simulate(machine).microstep(
      machine.resolveStateValue('first'),
      { type: 'TRIGGER' }
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

    const states = simulate(machine).microstep(undefined, { type: 'TRIGGER' });

    expect(states.map((s) => s.value)).toEqual(['second']);
  });

  it('each state should preserve their internal queue', () => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          on: {
            TRIGGER: {
              target: 'second',
              actions: [raise({ type: 'FOO' }), raise({ type: 'BAR' })]
            }
          }
        },
        second: {
          on: {
            FOO: {
              target: 'third'
            }
          }
        },
        third: {
          on: {
            BAR: {
              target: 'fourth'
            }
          }
        },
        fourth: {
          always: 'fifth'
        },
        fifth: {}
      }
    });

    const states = simulate(machine).microstep(undefined, { type: 'TRIGGER' });

    expect(states.map((s) => [s.value, s._internalQueue.length])).toEqual([
      ['second', 2], // foo, bar
      ['third', 1], // bar
      ['fourth', 0], // (eventless)
      ['fifth', 0]
    ]);
  });

  it('actions are preserved throughout microstep', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            TRIGGER: 'first'
          }
        },
        first: {
          entry: ['one'],
          always: 'second'
        },
        second: {
          entry: ['two'],
          always: 'third'
        },
        third: {
          entry: ['three']
        }
      }
    });

    const states = simulate(machine).microstep(undefined, { type: 'TRIGGER' });

    expect(states.map((s) => s.actions.map((a) => a.type))).toEqual([
      ['one'],
      ['one', 'two'],
      ['one', 'two', 'three']
    ]);
  });
});
