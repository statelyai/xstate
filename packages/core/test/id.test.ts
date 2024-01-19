import { testAll } from './utils';
import { createMachine, createActor } from '../src/index.ts';
import { getInitialSnapshot, getNextSnapshot } from '../src/getNextSnapshot.ts';

const idMachine = createMachine({
  initial: 'A',
  states: {
    A: {
      id: 'A',
      initial: 'foo',
      states: {
        foo: {
          id: 'A_foo',
          on: {
            NEXT: '#A_bar'
          }
        },
        bar: {
          id: 'A_bar',
          on: {
            NEXT: '#B_foo'
          }
        }
      },
      on: {
        NEXT_DOT_RESOLVE: '#B.bar'
      }
    },
    B: {
      id: 'B',
      initial: 'foo',
      states: {
        foo: {
          id: 'B_foo',
          on: {
            NEXT: '#B_bar',
            NEXT_DOT: '#B.dot'
          }
        },
        bar: {
          id: 'B_bar',
          on: {
            NEXT: '#A_foo'
          }
        },
        dot: {}
      }
    }
  }
});

describe('State node IDs', () => {
  const expected = {
    A: {
      NEXT: { A: 'bar' },
      NEXT_DOT_RESOLVE: { B: 'bar' }
    },
    '{"A":"foo"}': {
      NEXT: { A: 'bar' }
    },
    '{"A":"bar"}': {
      NEXT: { B: 'foo' }
    },
    '{"B":"foo"}': {
      'NEXT,NEXT': { A: 'foo' },
      NEXT_DOT: { B: 'dot' }
    }
  };

  testAll(idMachine, expected);

  it('should work with ID + relative path', () => {
    const machine = createMachine({
      initial: 'foo',
      on: {
        ACTION: '#bar.qux.quux'
      },
      states: {
        foo: {
          id: 'foo'
        },
        bar: {
          id: 'bar',
          initial: 'baz',
          states: {
            baz: {},
            qux: {
              initial: 'quux',
              states: {
                quux: {
                  id: '#bar.qux.quux'
                }
              }
            }
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({
      type: 'ACTION'
    });

    expect(actorRef.getSnapshot().value).toEqual({
      bar: {
        qux: 'quux'
      }
    });
  });

  it('should work with keys that have escaped periods', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            escaped: 'foo\\.bar',
            unescaped: 'foo.bar'
          }
        },
        'foo.bar': {},
        foo: {
          initial: 'bar',
          states: {
            bar: {}
          }
        }
      }
    });

    const initialState = getInitialSnapshot(machine);
    const escapedState = getNextSnapshot(machine, initialState, {
      type: 'escaped'
    });

    expect(escapedState.value).toEqual('foo.bar');

    const unescapedState = getNextSnapshot(machine, initialState, {
      type: 'unescaped'
    });
    expect(unescapedState.value).toEqual({ foo: 'bar' });
  });

  it('should work with IDs that have escaped periods', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            escaped: '#foo\\.bar',
            unescaped: '#foo.bar'
          }
        },
        stateWithDot: {
          id: 'foo.bar'
        },
        foo: {
          id: 'foo',
          initial: 'bar',
          states: {
            bar: {}
          }
        }
      }
    });

    const initialState = getInitialSnapshot(machine);
    const escapedState = getNextSnapshot(machine, initialState, {
      type: 'escaped'
    });

    expect(escapedState.value).toEqual('stateWithDot');

    const unescapedState = getNextSnapshot(machine, initialState, {
      type: 'unescaped'
    });
    expect(unescapedState.value).toEqual({ foo: 'bar' });
  });

  it("should not treat escaped backslash as period's escape", () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            EV: '#some\\\\.thing'
          }
        },
        foo: {
          id: 'some\\.thing'
        },
        bar: {
          id: 'some\\',
          initial: 'baz',
          states: {
            baz: {},
            thing: {}
          }
        }
      }
    });

    const initialState = getInitialSnapshot(machine);
    const escapedState = getNextSnapshot(machine, initialState, {
      type: 'EV'
    });

    expect(escapedState.value).toEqual({ bar: 'thing' });
  });
});
