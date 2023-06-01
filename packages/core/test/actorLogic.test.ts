import { EMPTY, interval, of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { createMachine, interpret } from '../src/index.ts';
import {
  fromObservable,
  fromPromise,
  fromTransition
} from '../src/actors/index.ts';
import { waitFor } from '../src/waitFor.ts';
import { raise, sendTo } from '../src/actions.ts';

describe('promise logic (fromPromise)', () => {
  it('should interpret a promise', async () => {
    const promiseLogic = fromPromise(
      () =>
        new Promise<string>((res) => {
          setTimeout(() => res('hello'), 10);
        })
    );

    const actor = interpret(promiseLogic).start();

    const snapshot = await waitFor(actor, (s) => s === 'hello');

    expect(snapshot).toBe('hello');
  });
  it('should resolve', (done) => {
    const actor = interpret(fromPromise(() => Promise.resolve(42)));

    actor.subscribe((state) => {
      if (state === 42) {
        done();
      }
    });

    actor.start();
  });

  it('should resolve (observer .next)', (done) => {
    const actor = interpret(fromPromise(() => Promise.resolve(42)));

    actor.subscribe({
      next: (state) => {
        if (state === 42) {
          done();
        }
      }
    });

    actor.start();
  });

  it('should reject (observer .error)', (done) => {
    const actor = interpret(fromPromise(() => Promise.reject('Error')));

    actor.subscribe({
      error: (data) => {
        expect(data).toBe('Error');
        done();
      }
    });

    actor.start();
  });

  it('should complete (observer .complete)', async () => {
    const actor = interpret(fromPromise(() => Promise.resolve(42)));
    actor.start();

    const snapshot = await waitFor(actor, (s) => s === 42);

    expect(snapshot).toBe(42);
  });

  it('should not execute when reading initial state', async () => {
    let called = false;
    const logic = fromPromise(() => {
      called = true;
      return Promise.resolve(42);
    });

    const actor = interpret(logic);

    actor.getSnapshot();

    expect(called).toBe(false);
  });

  it('should persist an unresolved promise', (done) => {
    const promiseLogic = fromPromise(
      () =>
        new Promise<number>((res) => {
          setTimeout(() => res(42), 10);
        })
    );

    const actor = interpret(promiseLogic);
    actor.start();

    const resolvedPersistedState = actor.getPersistedState();
    actor.stop();

    const restoredActor = interpret(promiseLogic, {
      state: resolvedPersistedState
    }).start();

    setTimeout(() => {
      expect(restoredActor.getSnapshot()).toBe(42);
      done();
    }, 20);
  });

  it('should persist a resolved promise', (done) => {
    const promiseLogic = fromPromise(
      () =>
        new Promise<number>((res) => {
          res(42);
        })
    );

    const actor = interpret(promiseLogic);
    actor.start();

    setTimeout(() => {
      const resolvedPersistedState = actor.getPersistedState();

      expect(resolvedPersistedState).toEqual(
        expect.objectContaining({
          data: 42
        })
      );

      const restoredActor = interpret(promiseLogic, {
        state: resolvedPersistedState
      }).start();
      expect(restoredActor.getSnapshot()).toBe(42);
      done();
    }, 5);
  });

  it('should not invoke a resolved promise again', async () => {
    let createdPromises = 0;
    const promiseLogic = fromPromise(() => {
      createdPromises++;
      return Promise.resolve(createdPromises);
    });
    const actor = interpret(promiseLogic);
    actor.start();

    await new Promise((res) => setTimeout(res, 5));

    const resolvedPersistedState = actor.getPersistedState();
    expect(resolvedPersistedState).toEqual(
      expect.objectContaining({
        data: 1
      })
    );
    expect(createdPromises).toBe(1);

    const restoredActor = interpret(promiseLogic, {
      state: resolvedPersistedState
    }).start();

    expect(restoredActor.getSnapshot()).toBe(1);
    expect(createdPromises).toBe(1);
  });

  it('should not invoke a rejected promise again', async () => {
    let createdPromises = 0;
    const promiseLogic = fromPromise(() => {
      createdPromises++;
      return Promise.reject(createdPromises);
    });
    const actor = interpret(promiseLogic);
    actor.start();

    await new Promise((res) => setTimeout(res, 5));

    const rejectedPersistedState = actor.getPersistedState();
    expect(rejectedPersistedState).toEqual(
      expect.objectContaining({
        data: 1
      })
    );
    expect(createdPromises).toBe(1);

    const restoredActor = interpret(promiseLogic, {
      state: rejectedPersistedState
    }).start();

    expect(restoredActor.getSnapshot()).toBe(1);
    expect(createdPromises).toBe(1);
  });
});

describe('transition function logic (fromTransition)', () => {
  it('should interpret a transition function', () => {
    const transitionLogic = fromTransition(
      (state, event) => {
        if (event.type === 'toggle') {
          return {
            ...state,
            status:
              state.status === 'active'
                ? ('inactive' as const)
                : ('active' as const)
          };
        }

        return state;
      },
      { status: 'active' as 'inactive' | 'active' }
    );

    const actor = interpret(transitionLogic).start();

    expect(actor.getSnapshot().status).toBe('active');

    actor.send({ type: 'toggle' });

    expect(actor.getSnapshot().status).toBe('inactive');
  });

  it('should persist a transition function', () => {
    const logic = fromTransition(
      (state, event) => {
        if (event.type === 'activate') {
          return { status: 'active' as const };
        }
        return state;
      },
      {
        status: 'inactive' as 'inactive' | 'active'
      }
    );
    const actor = interpret(logic).start();
    actor.send({ type: 'activate' });
    const persistedState = actor.getPersistedState();

    expect(persistedState).toEqual({
      status: 'active'
    });

    const restoredActor = interpret(logic, { state: persistedState });

    restoredActor.start();

    expect(restoredActor.getSnapshot().status).toBe('active');
  });
});

describe('observable logic (fromObservable)', () => {
  it('should interpret an observable', async () => {
    const observableLogic = fromObservable(() => interval(10).pipe(take(4)));

    const actor = interpret(observableLogic).start();

    const snapshot = await waitFor(actor, (s) => s === 3);

    expect(snapshot).toEqual(3);
  });

  it('should resolve', () => {
    const actor = interpret(fromObservable(() => of(42)));
    const spy = jest.fn();

    actor.subscribe(spy);

    actor.start();

    expect(spy).toHaveBeenCalledWith(42);
  });

  it('should resolve (observer .next)', () => {
    const actor = interpret(fromObservable(() => of(42)));
    const spy = jest.fn();

    actor.subscribe({
      next: spy
    });

    actor.start();
    expect(spy).toHaveBeenCalledWith(42);
  });

  it('should reject (observer .error)', () => {
    const actor = interpret(fromObservable(() => throwError(() => 'Error')));
    const spy = jest.fn();

    actor.subscribe({
      error: spy
    });

    actor.start();
    expect(spy).toHaveBeenCalledWith('Error');
  });

  it('should complete (observer .complete)', () => {
    const actor = interpret(fromObservable(() => EMPTY));
    const spy = jest.fn();

    actor.subscribe({
      complete: spy
    });

    actor.start();

    expect(spy).toHaveBeenCalled();
  });

  it('should not execute when reading initial state', () => {
    let called = false;
    const logic = fromObservable(() => {
      called = true;
      return EMPTY;
    });

    const actor = interpret(logic);

    actor.getSnapshot();

    expect(called).toBe(false);
  });
});

describe('machine logic', () => {
  it('should persist a machine', async () => {
    const childMachine = createMachine({
      context: {
        count: 55
      },
      initial: 'start',
      states: {
        start: {
          invoke: {
            id: 'reducer',
            src: fromTransition((s) => s, { status: 'active' })
          }
        }
      }
    });

    const machine = createMachine({
      initial: 'waiting',
      invoke: [
        {
          id: 'a',
          src: fromPromise(() => Promise.resolve(42)),
          onDone: {
            // @ts-ignore TODO: fix types
            actions: raise({ type: 'done' })
          }
        },
        {
          id: 'b',
          src: childMachine
        }
      ],
      states: {
        waiting: {
          on: {
            done: 'success'
          }
        },
        success: {}
      }
    });

    const actor = interpret(machine).start();

    await waitFor(actor, (s) => s.matches('success'));

    const persistedState = actor.getPersistedState()!;

    expect(persistedState.children.a.state).toEqual(
      expect.objectContaining({
        status: 'done',
        data: 42
      })
    );

    expect(persistedState.children.b.state).toEqual(
      expect.objectContaining({
        context: {
          count: 55
        },
        value: 'start',
        children: {
          reducer: expect.objectContaining({
            state: {
              status: 'active'
            }
          })
        }
      })
    );
  });

  it('should persist and restore a nested machine', () => {
    const childMachine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            LAST: 'c'
          }
        },
        c: {}
      }
    });

    const parentMachine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            START: 'invoked'
          }
        },
        invoked: {
          invoke: {
            id: 'child',
            src: childMachine
          },
          on: {
            NEXT: {
              actions: sendTo('child', { type: 'NEXT' })
            },
            LAST: {
              actions: sendTo('child', { type: 'LAST' })
            }
          }
        }
      }
    });

    const actor = interpret(parentMachine).start();

    // parent is at 'idle'
    // ...
    actor.send({ type: 'START' });
    // parent is at 'invoked'
    // child is at 'a'
    // ...
    actor.send({ type: 'NEXT' });
    // child is at 'b'

    const persistedState = actor.getPersistedState()!;
    const newActor = interpret(parentMachine, {
      state: persistedState
    }).start();
    const newSnapshot = newActor.getSnapshot();

    expect(newSnapshot.children.child.getSnapshot().value).toBe('b');

    // Ensure that the child actor is started
    // LAST is sent to parent which sends LAST to child
    newActor.send({ type: 'LAST' });
    // child is at 'c'

    expect(newActor.getSnapshot().children.child.getSnapshot().value).toBe('c');
  });

  it('should return the initial persisted state of a non-started actor', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    const actor = interpret(machine);

    expect(actor.getPersistedState()).toEqual(
      expect.objectContaining({
        value: 'idle'
      })
    );
  });

  it('the initial state of a child is available before starting the parent', () => {
    const machine = createMachine({
      invoke: {
        id: 'child',
        src: createMachine({
          initial: 'inner',
          states: { inner: {} }
        })
      }
    });

    const actor = interpret(machine);

    expect(actor.getPersistedState()?.children['child'].state).toEqual(
      expect.objectContaining({
        value: 'inner'
      })
    );
  });

  it('should invoke an actor even if missing in persisted state', () => {
    const machine = createMachine({
      invoke: {
        id: 'child',
        src: createMachine({
          initial: 'inner',
          states: { inner: {} }
        })
      }
    });

    const actor = interpret(machine).start();

    const persisted = actor.getPersistedState();

    delete persisted?.children['child'];

    const actor2 = interpret(machine, { state: persisted }).start();

    expect(actor2.getSnapshot().children.child.getSnapshot().value).toBe(
      'inner'
    );
  });
});
