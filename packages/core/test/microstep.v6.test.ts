import { next_createMachine } from '../src/index.ts';
import { createInertActorScope } from '../src/getNextSnapshot.ts';

describe('machine.microstep()', () => {
  it('should return an array of states from all microsteps', () => {
    const machine = next_createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            GO: 'a'
          }
        },
        a: {
          entry: (_, enq) => {
            enq.raise({ type: 'NEXT' });
          },
          on: {
            NEXT: 'b'
          }
        },
        b: {
          always: 'c'
        },
        c: {
          entry: (_, enq) => {
            enq.raise({ type: 'NEXT' });
          },
          on: {
            NEXT: 'd'
          }
        },
        d: {}
      }
    });

    const actorScope = createInertActorScope(machine);
    const states = machine.microstep(
      machine.getInitialSnapshot(actorScope),
      { type: 'GO' },
      actorScope
    );

    expect(states.map((s) => s.value)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('should return the states from microstep (transient)', () => {
    const machine = next_createMachine({
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

    const actorScope = createInertActorScope(machine);
    const states = machine.microstep(
      machine.resolveState({ value: 'first' }),
      { type: 'TRIGGER' },
      actorScope
    );

    expect(states.map((s) => s.value)).toEqual(['second', 'third']);
  });

  it('should return the states from microstep (raised event)', () => {
    const machine = next_createMachine({
      initial: 'first',
      states: {
        first: {
          on: {
            TRIGGER: (_, enq) => {
              enq.raise({ type: 'RAISED' });
              return { target: 'second' };
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

    const actorScope = createInertActorScope(machine);
    const states = machine.microstep(
      machine.resolveState({ value: 'first' }),
      { type: 'TRIGGER' },
      actorScope
    );

    expect(states.map((s) => s.value)).toEqual(['second', 'third']);
  });

  it('should return a single-item array for normal transitions', () => {
    const machine = next_createMachine({
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

    const actorScope = createInertActorScope(machine);
    const states = machine.microstep(
      machine.getInitialSnapshot(actorScope),
      { type: 'TRIGGER' },
      actorScope
    );

    expect(states.map((s) => s.value)).toEqual(['second']);
  });

  it('each state should preserve their internal queue', () => {
    const machine = next_createMachine({
      initial: 'first',
      states: {
        first: {
          on: {
            TRIGGER: (_, enq) => {
              enq.raise({ type: 'FOO' });
              enq.raise({ type: 'BAR' });
              return { target: 'second' };
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

    const actorScope = createInertActorScope(machine);
    const states = machine.microstep(
      machine.getInitialSnapshot(actorScope),
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
