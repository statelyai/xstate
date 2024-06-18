import { assign, createActor, createMachine } from '../src';

describe('state invariants', () => {
  it('throws an error and does not transition if the invariant throws', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            loadUser: {
              target: 'userLoaded'
            }
          }
        },
        userLoaded: {
          invariant: (x) => {
            if (!x.context.user) {
              throw new Error('User not loaded');
            }
          }
        }
      }
    });
    const spy = jest.fn();

    const actor = createActor(machine);
    actor.subscribe({
      error: spy
    });
    actor.start();

    actor.send({ type: 'loadUser' });

    expect(spy).toHaveBeenCalledWith(new Error('User not loaded'));

    expect(actor.getSnapshot().value).toEqual('idle');
  });

  it('transitions as normal if the invariant does not fail', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            loadUser: {
              target: 'userLoaded',
              actions: assign({ user: () => ({ name: 'David' }) })
            }
          }
        },
        userLoaded: {
          invariant: (x) => {
            if (!x.context.user) {
              throw new Error('User not loaded');
            }
          }
        }
      }
    });
    const spy = jest.fn();

    const actor = createActor(machine);
    actor.subscribe({
      error: spy
    });
    actor.start();

    actor.send({ type: 'loadUser' });

    expect(spy).not.toHaveBeenCalled();

    expect(actor.getSnapshot().value).toEqual('userLoaded');
  });

  it('throws an error and does not transition if the invariant fails on a transition within the state', () => {
    const machine = createMachine({
      initial: 'userLoaded',
      states: {
        userLoaded: {
          initial: 'active',
          states: {
            active: {
              on: {
                deactivate: 'inactive'
              }
            },
            inactive: {
              entry: assign({ user: null })
            }
          },
          invariant: (x) => {
            if (!x.context.user) {
              throw new Error('User not loaded');
            }
          },
          entry: assign({ user: { name: 'David' } })
        }
      }
    });
    const spy = jest.fn();

    const actor = createActor(machine);
    actor.subscribe({
      error: spy
    });
    actor.start();

    actor.send({ type: 'deactivate' });

    expect(spy).toHaveBeenCalledWith(new Error('User not loaded'));
    expect(actor.getSnapshot().value).toEqual({ userLoaded: 'active' });
  });

  it('does not throw an error when exiting a state with an invariant if the exit action clears the context', () => {
    const machine = createMachine({
      initial: 'userLoaded',
      states: {
        userLoaded: {
          invariant: (x) => {
            if (!x.context.user) {
              throw new Error('User not loaded');
            }
          },
          entry: assign({ user: { name: 'David' } }),
          exit: assign({ user: null }),
          on: {
            logout: 'idle'
          }
        },
        idle: {}
      }
    });
    const spy = jest.fn();

    const actor = createActor(machine);
    actor.subscribe({
      error: spy
    });
    actor.start();

    actor.send({ type: 'logout' });

    expect(spy).not.toHaveBeenCalled();
    expect(actor.getSnapshot().value).toEqual('idle');
  });

  it('interacts correctly with parallel states', () => {
    const spy = jest.fn();

    const machine = createMachine({
      initial: 'p',
      types: {
        context: {} as { user: { name: string; age: number } | null }
      },
      context: {
        user: {
          name: 'David',
          age: 30
        }
      },
      states: {
        p: {
          type: 'parallel',
          states: {
            a: {
              invariant: (x) => {
                if (!x.context.user) {
                  throw new Error('User not loaded');
                }
              },
              on: {
                updateAge: {
                  actions: assign({
                    user: (x) => ({ ...x.context.user, age: -3 })
                  })
                }
              }
            },
            b: {
              invariant: (x) => {
                if (x.context.user.age < 0) {
                  throw new Error('User age cannot be negative');
                }
              },
              on: {
                deleteUser: {
                  actions: assign({
                    user: () => null
                  })
                }
              }
            }
          }
        }
      }
    });

    const actor = createActor(machine);

    actor.subscribe({
      error: spy
    });

    actor.start();

    expect(actor.getSnapshot().value).toEqual({
      p: {
        a: {},
        b: {}
      }
    });

    actor.send({
      type: 'updateAge'
    });

    expect(spy).toHaveBeenCalledWith(new Error('User age cannot be negative'));

    expect(actor.getSnapshot().status).toEqual('error');
  });
});
