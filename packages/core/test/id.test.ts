import { testAll } from './utils';
import { AnyStateMachine, Machine } from '../src';

const idMachine: AnyStateMachine = Machine({
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
        dot: {
          id: 'B.dot'
        }
      }
    },
    getter: {
      on: {
        get NEXT() {
          return idMachine.states.A;
        },
        get NEXT_DEEP() {
          return idMachine.states.A.states.foo;
        },
        NEXT_TARGET: {
          get target() {
            return idMachine.states.B;
          }
        },
        NEXT_TARGET_ARRAY: [
          {
            get target() {
              return idMachine.states.B;
            }
          }
        ]
      }
    }
  }
});

describe('State node IDs', () => {
  const expected = {
    A: {
      NEXT: 'A.bar',
      NEXT_DOT_RESOLVE: 'B.bar'
    },
    '#A': {
      NEXT: 'A.bar'
    },
    'A.foo': {
      NEXT: 'A.bar'
    },
    '#A_foo': {
      NEXT: 'A.bar'
    },
    'A.bar': {
      NEXT: 'B.foo'
    },
    '#A_bar': {
      NEXT: 'B.foo'
    },
    'B.foo': {
      'NEXT,NEXT': 'A.foo',
      NEXT_DOT: 'B.dot'
    },
    '#B_foo': {
      'NEXT,NEXT': 'A.foo'
    },

    // With getters
    getter: {
      NEXT: 'A',
      NEXT_DEEP: 'A.foo',
      NEXT_TARGET: 'B',
      NEXT_TARGET_ARRAY: 'B'
    }
  };

  testAll(idMachine, expected);

  it('should work with ID + relative path', () => {
    const brokenMachine = Machine({
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
          states: {
            baz: {},
            qux: {
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

    expect(brokenMachine.transition('foo', 'ACTION').value).toEqual({
      bar: { qux: 'quux' }
    });
  });
});
