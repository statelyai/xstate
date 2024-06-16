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
});
