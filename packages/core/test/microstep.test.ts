import {
  createMachine,
  getMicrosteps,
  getInitialMicrosteps
} from '../src/index.ts';
import { raise } from '../src/actions/raise';
import { createInertActorScope } from '../src/getNextSnapshot.ts';

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

    const actorScope = createInertActorScope(machine);
    const states = machine.microstep(
      machine.getInitialSnapshot(actorScope),
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

    const actorScope = createInertActorScope(machine);
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

    const actorScope = createInertActorScope(machine);
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

    const actorScope = createInertActorScope(machine);
    const states = machine.microstep(
      machine.getInitialSnapshot(actorScope),
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

describe('getMicrosteps', () => {
  it('should return microsteps with actions', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO: {
              target: 'b',
              actions: () => {}
            }
          }
        },
        b: {
          entry: () => {},
          always: {
            target: 'c',
            actions: () => {}
          }
        },
        c: {}
      }
    });

    const actorScope = createInertActorScope(machine);
    const initialSnapshot = machine.getInitialSnapshot(actorScope);

    const microsteps = getMicrosteps(machine, initialSnapshot, { type: 'GO' });

    expect(microsteps).toHaveLength(2);

    // First microstep: a -> b
    expect(microsteps[0][0].value).toEqual('b');
    expect(microsteps[0][1]).toHaveLength(2); // transition action + entry action

    // Second microstep: b -> c (always)
    expect(microsteps[1][0].value).toEqual('c');
    expect(microsteps[1][1]).toHaveLength(1); // always transition action
  });

  it('should capture actions from raised events', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO: {
              target: 'b',
              actions: [() => {}, raise({ type: 'NEXT' })]
            }
          }
        },
        b: {
          on: {
            NEXT: {
              target: 'c',
              actions: () => {}
            }
          }
        },
        c: {}
      }
    });

    const actorScope = createInertActorScope(machine);
    const initialSnapshot = machine.getInitialSnapshot(actorScope);

    const microsteps = getMicrosteps(machine, initialSnapshot, { type: 'GO' });

    expect(microsteps).toHaveLength(2);
    expect(microsteps[0][0].value).toEqual('b');
    expect(microsteps[1][0].value).toEqual('c');
  });
});

describe('getInitialMicrosteps', () => {
  it('should return initial microsteps with entry actions', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: () => {}
        }
      }
    });

    const microsteps = getInitialMicrosteps(machine);

    expect(microsteps).toHaveLength(1);
    expect(microsteps[0][0].value).toEqual('a');
    expect(microsteps[0][1]).toHaveLength(1); // entry action
  });

  it('should capture actions from initial always transitions', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: () => {},
          always: {
            target: 'b',
            actions: () => {}
          }
        },
        b: {
          entry: () => {}
        }
      }
    });

    const microsteps = getInitialMicrosteps(machine);

    expect(microsteps).toHaveLength(2);
    expect(microsteps[0][0].value).toEqual('a');
    expect(microsteps[0][1]).toHaveLength(1); // entry action for 'a'
    expect(microsteps[1][0].value).toEqual('b');
    expect(microsteps[1][1]).toHaveLength(2); // always action + entry action for 'b'
  });

  it('should work with nested initial states', () => {
    const machine = createMachine({
      initial: 'parent',
      states: {
        parent: {
          entry: () => {},
          initial: 'child',
          states: {
            child: {
              entry: () => {}
            }
          }
        }
      }
    });

    const microsteps = getInitialMicrosteps(machine);

    expect(microsteps).toHaveLength(1);
    expect(microsteps[0][0].value).toEqual({ parent: 'child' });
    expect(microsteps[0][1]).toHaveLength(2); // parent entry + child entry
  });

  it('should pass input to context function', () => {
    const machine = createMachine({
      context: ({ input }: { input: { value: number } }) => ({
        count: input.value
      }),
      initial: 'a',
      states: {
        a: {}
      }
    });

    const microsteps = getInitialMicrosteps(machine, { value: 42 });

    expect(microsteps[0][0].context).toEqual({ count: 42 });
  });
});
