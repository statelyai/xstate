import { testAll } from './utils';
import { createMachine, interpret } from '../src/index.ts';

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

    const actorRef = interpret(machine).start();

    actorRef.send({
      type: 'ACTION'
    });

    expect(actorRef.getSnapshot().value).toEqual({
      bar: {
        qux: 'quux'
      }
    });
  });
});
