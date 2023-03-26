import { of } from 'rxjs';
import { assign, interpret } from '../src';
import { createMachine } from '../src/Machine';
import {
  fromCallback,
  fromObservable,
  fromPromise,
  fromTransition
} from '../src/actors';

describe('input', () => {
  it('should create a machine with input', () => {
    const spy = jest.fn();

    const machine = createMachine<{ count: number }>({
      context: ({ input }) => ({
        count: input.startCount
      }),
      entry: (ctx) => {
        spy(ctx.count);
      }
    });

    interpret(machine, { input: { startCount: 42 } }).start();

    expect(spy).toHaveBeenCalledWith(42);
  });

  it('initial event should have input property', (done) => {
    const machine = createMachine({
      entry: (_, ev) => {
        expect(ev.input.greeting).toBe('hello');
        done();
      }
    });

    interpret(machine, { input: { greeting: 'hello' } }).start();
  });

  it('should throw if input is expected but not provided', () => {
    const machine = createMachine<{
      message: string;
    }>({
      context: ({ input }) => ({
        message: `Hello, ${input.greeting}`
      })
    });

    expect(() => {
      interpret(machine).start();
    }).toThrowError(/Cannot read properties of undefined/);
  });

  it('should not throw if input is not expected and not provided', () => {
    const machine = createMachine<{ count: number }>({
      context: () => {
        return { count: 42 };
      }
    });

    expect(() => {
      interpret(machine).start();
    }).not.toThrowError();
  });

  it('should be a type error if input is not expected yet provided', () => {
    const machine = createMachine<{ count: 42 }>({
      context: { count: 42 }
    });

    expect(() => {
      // TODO: add ts-expect-errpr
      interpret(machine).start();
    }).not.toThrowError();
  });

  it('should provide input data to invoked machines', (done) => {
    const invokedMachine = createMachine({
      entry: (_, ev) => {
        expect(ev.input.greeting).toBe('hello');
        done();
      }
    });

    const machine = createMachine({
      invoke: {
        src: invokedMachine,
        input: { greeting: 'hello' }
      }
    });

    interpret(machine).start();
  });

  it('should provide input data to spawned machines', (done) => {
    const spawnedMachine = createMachine({
      entry: (_, ev) => {
        expect(ev.input.greeting).toBe('hello');
        done();
      }
    });

    const machine = createMachine({
      entry: assign((_ctx, _ev, { spawn }) => {
        return {
          ref: spawn(spawnedMachine, { input: { greeting: 'hello' } })
        };
      })
    });

    interpret(machine).start();
  });

  it('should create a promise with input', async () => {
    const promiseBehavior = fromPromise(({ input }) => Promise.resolve(input));

    const promiseActor = interpret(promiseBehavior, {
      input: { count: 42 }
    }).start();

    await new Promise((res) => setTimeout(res, 5));

    expect(promiseActor.getSnapshot()).toEqual({ count: 42 });
  });

  it('should create a transition function actor with input', () => {
    const transitionBehavior = fromTransition(
      (state) => state,
      ({ input }) => input
    );

    const transitionActor = interpret(transitionBehavior, {
      input: { count: 42 }
    }).start();

    expect(transitionActor.getSnapshot()).toEqual({ count: 42 });
  });

  it('should create an observable actor with input', (done) => {
    const observableBehavior = fromObservable(({ input }) => of(input));

    const observableActor = interpret(observableBehavior, {
      input: { count: 42 }
    });

    const sub = observableActor.subscribe((state) => {
      if (state?.count !== 42) return;
      expect(state).toEqual({ count: 42 });
      done();
      sub.unsubscribe();
    });

    observableActor.start();
  });

  it('should create a callback actor with input', (done) => {
    const callbackBehavior = fromCallback((_sendBack, _receive, { input }) => {
      expect(input).toEqual({ count: 42 });
      done();
    });

    interpret(callbackBehavior, {
      input: { count: 42 }
    }).start();
  });

  it('should provide a static inline input to the referenced actor', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        invoke: {
          src: 'child',
          input: 42
        }
      },
      {
        actors: {
          child: createMachine({
            context: ({ input }) => {
              spy(input);
              return {};
            }
          })
        }
      }
    );

    interpret(machine).start();

    expect(spy).toHaveBeenCalledWith(42);
  });

  it('should provide a dynamic inline input to the referenced actor', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        invoke: {
          src: 'child',
          input: (_, { input }) => input + 100
        }
      },
      {
        actors: {
          child: createMachine({
            context: ({ input }) => {
              spy(input);
              return {};
            }
          })
        }
      }
    );

    interpret(machine, { input: 42 }).start();

    expect(spy).toHaveBeenCalledWith(142);
  });

  it('should provide input to the referenced actor defined together with static input', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        invoke: {
          src: 'child'
        }
      },
      {
        actors: {
          child: {
            src: createMachine({
              context: ({ input }) => {
                spy(input);
                return {};
              }
            }),
            input: 42
          }
        }
      }
    );

    interpret(machine).start();

    expect(spy).toHaveBeenCalledWith(42);
  });

  it('should provide input to the referenced actor defined together with dynamic input when invoking', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        invoke: {
          src: 'child'
        }
      },
      {
        actors: {
          child: {
            src: createMachine({
              context: ({ input }) => {
                spy(input);
                return {};
              }
            }),
            input: (_, { input }) => input + 100
          }
        }
      }
    );

    interpret(machine, { input: 42 }).start();

    expect(spy).toHaveBeenCalledWith(142);
  });

  it('should provide input to the referenced actor defined together with dynamic input when spawning', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        entry: assign((_ctx, _ev, { spawn }) => ({
          childRef: spawn('child')
        }))
      },
      {
        actors: {
          child: {
            src: createMachine({
              context: ({ input }) => {
                spy(input);
                return {};
              }
            }),
            input: (_, { input }) => input + 100
          }
        }
      }
    );

    interpret(machine, { input: 42 }).start();

    expect(spy).toHaveBeenCalledWith(142);
  });

  it('should prioritize inline input over the one defined with referenced actor when invoking', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        invoke: {
          src: 'child',
          input: 100
        }
      },
      {
        actors: {
          child: {
            src: createMachine({
              context: ({ input }) => {
                spy(input);
                return {};
              }
            }),
            input: 42
          }
        }
      }
    );

    interpret(machine).start();

    expect(spy).toHaveBeenCalledWith(100);
  });

  it('should prioritize inline input over the one defined with referenced actor when spawning', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        entry: assign((_ctx, _ev, { spawn }) => ({
          childRef: spawn('child', { input: 100 })
        }))
      },
      {
        actors: {
          child: {
            src: createMachine({
              context: ({ input }) => {
                spy(input);
                return {};
              }
            }),
            input: 42
          }
        }
      }
    );

    interpret(machine).start();

    expect(spy).toHaveBeenCalledWith(100);
  });
});
