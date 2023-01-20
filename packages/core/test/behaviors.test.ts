import { EMPTY, interval, of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { interpret } from '../src';
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
});

describe('observable behavior (fromObservable)', () => {
  it('should interpret an observable', async () => {
    const observableBehavior = fromObservable(() => interval(10).pipe(take(4)));

    const actor = interpret(observableBehavior).start();

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
    const behavior = fromObservable(() => {
      called = true;
      return EMPTY;
    });

    const actor = interpret(behavior);

    actor.getSnapshot();

    expect(called).toBe(false);
  });
});
