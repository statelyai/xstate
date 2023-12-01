import { createMachine } from '../src/index.ts';
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

    const actorScope = null as any; // TODO: figure out the simulation API
    const states = machine.microstep(
      machine.getInitialState(actorScope),
      { type: 'GO' },
      actorScope
    );

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

    const actorScope = null as any; // TODO: figure out the simulation API
    const states = machine.microstep(
      machine.resolveState({ value: 'first' }),
      { type: 'TRIGGER' },
      actorScope
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

    const actorScope = null as any; // TODO: figure out the simulation API
    const states = machine.microstep(
      machine.resolveState({ value: 'first' }),
      { type: 'TRIGGER' },
      actorScope
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

    const actorScope = null as any; // TODO: figure out the simulation API
    const states = machine.microstep(
      machine.getInitialState(actorScope),
      { type: 'TRIGGER' },
      actorScope
    );

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

    const actorScope = null as any; // TODO: figure out the simulation API
    const states = machine.microstep(
      machine.getInitialState(actorScope),
      { type: 'TRIGGER' },
      actorScope
    );

    expect(states.map((s) => s.value)).toEqual([
      'second',
      'third',
      'fourth',
      'fifth'
    ]);
  });
});
