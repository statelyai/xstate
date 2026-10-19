import { testAll } from './utils';
import {
  createMachine,
  createActor,
  transition,
  initialTransition
} from '../src/index.ts';

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
            NEXT: { target: '#A_bar' }
          }
        },
        bar: {
          id: 'A_bar',
          on: {
            NEXT: { target: '#B_foo' }
          }
        }
      },
      on: {
        NEXT_DOT_RESOLVE: { target: '#B_bar' }
      }
    },
    B: {
      id: 'B',
      initial: 'foo',
      states: {
        foo: {
          id: 'B_foo',
          on: {
            NEXT: { target: '#B_bar' },
            NEXT_DOT: { target: '#B.dot' }
          }
        },
        bar: {
          id: 'B_bar',
          on: {
            NEXT: { target: '#A_foo' }
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

  it('resolves a nested state by its full implicit id', () => {
    const machine = createMachine({
      id: 'm',
      initial: 'foo',
      on: {
        ACTION: { target: '#m.bar.qux.quux' }
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
                quux: {}
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

  it('does not resolve an id followed by a relative path', () => {
    expect(() =>
      createMachine({
        id: 'm',
        initial: 'foo',
        on: {
          ACTION: { target: '#bar.qux.quux' }
        },
        states: {
          foo: {},
          bar: {
            id: 'bar',
            initial: 'qux',
            states: {
              qux: {
                initial: 'quux',
                states: {
                  quux: {}
                }
              }
            }
          }
        }
      } as any)
    ).toThrowError(
      'No state has id "bar.qux.quux". Use "#m.bar.qux.quux", or give that state an id.'
    );
  });

  it('suggests the explicit id of a state reached by id + relative path', () => {
    expect(() =>
      createMachine({
        initial: 'a',
        on: {
          GO: { target: '#a.b' }
        },
        states: {
          a: {
            id: 'a',
            initial: 'b',
            states: {
              b: { id: 'bee' }
            }
          }
        }
      } as any)
    ).toThrowError('No state has id "a.b". Use "#bee".');
  });

  it('throws a plain error for an unknown id', () => {
    expect(() =>
      createMachine({
        initial: 'a',
        on: {
          GO: { target: '#nope.child' }
        },
        states: {
          a: {}
        }
      } as any)
    ).toThrowError(/^No state has id "nope\.child"\.$/);
  });

  it('should work with keys that have escaped periods', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            escaped: { target: 'foo\\.bar' },
            unescaped: { target: 'foo.bar' }
          }
        },
        'foo\\.bar': {},
        foo: {
          initial: 'bar',
          states: {
            bar: {}
          }
        }
      }
    });

    const [initialState] = initialTransition(machine);
    const [escapedState] = transition(machine, initialState, {
      type: 'escaped'
    });

    expect(escapedState.value).toEqual('foo\\.bar');

    const [unescapedState] = transition(machine, initialState, {
      type: 'unescaped'
    });
    expect(unescapedState.value).toEqual({ foo: 'bar' });
  });

  it('matches explicit ids that contain periods exactly', () => {
    const machine = createMachine({
      // Without a machine id, the implicit id of `foo.bar` would collide with
      // the explicit `foo.bar` id.
      id: 'machine',
      initial: 'start',
      states: {
        start: {
          on: {
            explicit: { target: '#foo.bar' },
            implicit: { target: '#machine.foo.bar' }
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

    const [initialState] = initialTransition(machine);
    const [explicitState] = transition(machine, initialState, {
      type: 'explicit'
    });

    expect(explicitState.value).toEqual('stateWithDot');

    const [implicitState] = transition(machine, initialState, {
      type: 'implicit'
    });
    expect(implicitState.value).toEqual({ foo: 'bar' });
  });

  it('does not unescape explicit ids', () => {
    expect(() =>
      createMachine({
        id: 'machine',
        initial: 'start',
        states: {
          start: {
            on: { GO: { target: '#foo\\.bar' } }
          },
          stateWithDot: {
            id: 'foo.bar'
          }
        }
      } as any)
    ).toThrowError('No state has id "foo\\.bar".');
  });

  it('treats backslashes in explicit ids as literal characters', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            EV: { target: '#some\\.thing' }
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

    const [initialState] = initialTransition(machine);
    const [nextState] = transition(machine, initialState, {
      type: 'EV'
    });

    expect(nextState.value).toEqual('foo');
  });
});
