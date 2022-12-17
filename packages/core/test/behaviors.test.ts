import { EMPTY, interval, of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { createMachine, interpret } from '../src';
import { raise } from '../src/actions';
import { fromObservable, fromPromise, fromReducer } from '../src/actors';
import { waitFor } from '../src/waitFor';

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

  it('should persist a promise', async () => {
    const actor = interpret(
      fromPromise(
        () =>
          new Promise<number>((_res) => {
            // never resolves
          })
      )
    );

    actor.start({
      canceled: false,
      data: 42
    });

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
    const actor = interpret(
      fromReducer((state) => state, {
        status: 'inactive' as 'inactive' | 'active'
      })
    );

    actor.start({
      status: 'active'
    });

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

    const persistedState = actor.getPersisted();

    machine.restoreState(persistedState);

    expect(persistedState.children.a).toEqual({
      canceled: false,
      data: 42
    });

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
});
