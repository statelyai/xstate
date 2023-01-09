import { EMPTY, interval, of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { createMachine, interpret } from '../src';
import { fromObservable, fromPromise, fromReducer } from '../src/actors';
import { waitFor } from '../src/waitFor';
import { raise, sendTo } from '../src/actions';

describe('promise behavior (fromPromise)', () => {
  it('should interpret a promise', async () => {
    const promiseBehavior = fromPromise(
      () =>
        new Promise<string>((res) => {
          setTimeout(() => res('hello'), 10);
        })
    );

    const actor = interpret(promiseBehavior).start();

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
    const behavior = fromPromise(() => {
      called = true;
      return Promise.resolve(42);
    });

    const actor = interpret(behavior);

    actor.getSnapshot();

    expect(called).toBe(false);
  });

  it('should persist a promise', async () => {
    const promiseBehavior = fromPromise(
      () =>
        new Promise<number>((_res) => {
          // never resolves
        })
    );
    const actor = interpret(
      promiseBehavior.at({
        status: 'done',
        canceled: false,
        data: 42
      }) ?? promiseBehavior
    );

    actor.start();

    expect(actor.getSnapshot()).toBe(42);
  });
});

describe('reducer behavior (fromReducer)', () => {
  it('should interpret a reducer', () => {
    const reducerBehavior = fromReducer(
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

    const actor = interpret(reducerBehavior).start();

    expect(actor.getSnapshot().status).toBe('active');

    actor.send({ type: 'toggle' });

    expect(actor.getSnapshot().status).toBe('inactive');
  });

  it('should persist a reducer', () => {
    const behavior = fromReducer((state) => state, {
      status: 'inactive' as 'inactive' | 'active'
    });
    const actor = interpret(
      behavior.at?.({
        status: 'active'
      })
    );

    actor.start();

    expect(actor.getSnapshot().status).toBe('active');
  });
});

describe('observable behavior (fromObservable)', () => {
  it('should interpret an observable', async () => {
    const observableBehavior = fromObservable(() => interval(10).pipe(take(4)));

    const actor = interpret(observableBehavior).start();

    const snapshot = await waitFor(actor, (s) => s === 3);

    expect(snapshot).toEqual(3);
  });

  it('should resolve', (done) => {
    const actor = interpret(fromObservable(() => of(42)));

    actor.subscribe((state) => {
      if (state === 42) {
        done();
      }
    });

    actor.start();
  });

  it('should resolve (observer .next)', (done) => {
    const actor = interpret(fromObservable(() => of(42)));

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
    const actor = interpret(fromObservable(() => throwError(() => 'Error')));

    actor.subscribe({
      error: (data) => {
        expect(data).toBe('Error');
        done();
      }
    });

    actor.start();
  });

  it('should complete (observer .complete)', (done) => {
    const actor = interpret(fromObservable(() => EMPTY));

    actor.subscribe({
      complete: () => {
        done();
      }
    });

    actor.start();
  });

  it('should not execute when reading initial state', async () => {
    let called = false;
    const behavior = fromObservable(() => {
      called = true;
      return EMPTY;
    });

    const actor = interpret(behavior);

    actor.getSnapshot();

    expect(called).toBe(false);
  });
});

describe('machine behavior', () => {
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
            src: fromReducer((s) => s, { status: 'active' })
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

    const persistedState = actor.getPersisted()!;

    expect(persistedState.children.a).toEqual(
      expect.objectContaining({
        canceled: false,
        data: 42
      })
    );

    expect(persistedState.children.b).toEqual(
      expect.objectContaining({
        context: {
          count: 55
        },
        value: 'start',
        children: {
          reducer: {
            status: 'active'
          }
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

    const persistedState = actor.getPersisted()!;
    const newActor = interpret(parentMachine.at(persistedState)).start();
    const newSnapshot = newActor.getSnapshot();

    expect(newSnapshot.children.child.getSnapshot().value).toBe('b');

    // Ensure that the child actor is started
    // LAST is sent to parent which sends LAST to child
    newActor.send({ type: 'LAST' });
    // child is at 'c'

    expect(newActor.getSnapshot().children.child.getSnapshot().value).toBe('c');
  });
});
