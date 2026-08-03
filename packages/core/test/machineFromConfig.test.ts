import { createActor, initialTransition, transition } from '../src';
import { createMachineFromConfig } from '../src/createMachineFromConfig';

describe('createMachineFromConfig ', () => {
  it('rejects history states without a non-empty default target', () => {
    expect(() =>
      createMachineFromConfig({
        initial: 'on',
        states: {
          on: {
            initial: 'active',
            states: {
              active: {},
              history: { type: 'history' }
            }
          }
        }
      })
    ).toThrow(
      'History state at $.states.on.states.history must declare a non-empty target.'
    );

    expect(() =>
      createMachineFromConfig({
        initial: 'on',
        states: {
          on: {
            initial: 'active',
            states: {
              active: {},
              history: {
                type: 'history',
                // @ts-expect-error - runtime JSON can still contain an empty array
                target: []
              }
            }
          }
        }
      })
    ).toThrow(
      'History state at $.states.on.states.history must declare a non-empty target.'
    );
  });

  it('rejects SCXML-illegal multi-target transitions at construction', () => {
    expect(() =>
      createMachineFromConfig({
        initial: 'idle',
        states: {
          idle: {
            on: {
              GO: { target: ['parallel.left.a', 'parallel.left.b'] }
            }
          },
          parallel: {
            type: 'parallel',
            states: {
              left: { initial: 'a', states: { a: {}, b: {} } },
              right: { initial: 'c', states: { c: {}, d: {} } }
            }
          }
        }
      })
    ).toThrow(
      "Invalid transition definition for state node '(machine).idle': target set is not a legal SCXML configuration."
    );
  });

  it('should create a machine from a config', () => {
    const machine = createMachineFromConfig({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: { target: 'b' }
          }
        },
        b: {
          on: {
            NEXT: { target: 'c' }
          }
        },
        c: {}
      }
    });
    const [initialState] = initialTransition(machine);
    expect(initialState.value).toEqual('a');
    const [nextState] = transition(machine, initialState, { type: 'NEXT' });
    expect(nextState.value).toEqual('b');
    const [nextState2] = transition(machine, nextState, { type: 'NEXT' });
    expect(nextState2.value).toEqual('c');
  });
  it('should handle raise actions', () => {
    const machine = createMachineFromConfig({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: {
              actions: [{ type: '@xstate.raise', event: { type: 'TO_B' } }]
            },
            TO_B: { target: 'b' }
          }
        },
        b: {}
      }
    });
    const [initialState] = initialTransition(machine);
    expect(initialState.value).toEqual('a');
    const [nextState] = transition(machine, initialState, { type: 'NEXT' });
    expect(nextState.value).toEqual('b');
  });

  it('should handle emit actions', async () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = createMachineFromConfig({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: {
              actions: [
                {
                  type: '@xstate.emit',
                  event: { type: 'EMITTED', msg: 'hello' }
                }
              ]
            }
          }
        }
      }
    });

    const actor = createActor(machine);
    actor.on('EMITTED', (ev) => {
      expect(ev.msg).toEqual('hello');
      resolve();
    });
    actor.start();
    actor.send({ type: 'NEXT' });
    await promise;
  });
});
