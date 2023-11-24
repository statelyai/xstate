import { of } from 'rxjs';
import { assign, createActor, spawn } from '../src';
import { createMachine } from '../src/createMachine';
import {
  fromCallback,
  fromObservable,
  fromPromise,
  fromTransition
} from '../src/actors';

describe('input', () => {
  it('should create a machine with input', () => {
    const spy = jest.fn();

    const machine = createMachine({
      types: {} as {
        context: { count: number };
        input: { startCount: number };
      },
      context: ({ input }) => ({
        count: input.startCount
      }),
      entry: ({ context }) => {
        spy(context.count);
      }
    });

    createActor(machine, { input: { startCount: 42 } }).start();

    expect(spy).toHaveBeenCalledWith(42);
  });

  it('initial event should have input property', (done) => {
    const machine = createMachine({
      entry: ({ event }) => {
        expect(event.input.greeting).toBe('hello');
        done();
      }
    });

    createActor(machine, { input: { greeting: 'hello' } }).start();
  });

  // TODO: rewrite this test to reflect the current behavior better
  it.skip('should throw if input is expected but not provided', () => {
    const machine = createMachine({
      types: {} as {
        input: { greeting: string };
        context: { message: string };
      },
      context: ({ input }) => {
        return { message: `Hello, ${input.greeting}` };
      }
    });

    expect(() => {
      createActor(machine).start();
    }).toThrowError(/Cannot read properties of undefined/);
  });

  // TODO: rewrite this test to reflect the current behavior better
  it('should not throw if input is not expected and not provided', () => {
    const machine = createMachine({
      context: () => {
        return { count: 42 };
      }
    });

    expect(() => {
      createActor(machine).start();
    }).not.toThrowError();
  });

  it('should be a type error if input is not expected yet provided', () => {
    const machine = createMachine({
      context: { count: 42 }
    });

    expect(() => {
      // TODO: add ts-expect-errpr
      createActor(machine).start();
    }).not.toThrowError();
  });

  it('should provide input data to invoked machines', (done) => {
    const invokedMachine = createMachine({
      types: {} as {
        input: { greeting: string };
        context: { greeting: string };
      },
      context: ({ input }) => input,
      entry: ({ context, event }) => {
        expect(context.greeting).toBe('hello');
        expect(event.input.greeting).toBe('hello');
        done();
      }
    });

    const machine = createMachine({
      invoke: {
        src: invokedMachine,
        input: { greeting: 'hello' }
      }
    });

    createActor(machine).start();
  });

  it('should provide input data to spawned machines', (done) => {
    const spawnedMachine = createMachine({
      types: {} as {
        input: { greeting: string };
        context: { greeting: string };
      },
      context({ input }) {
        return input;
      },
      entry: ({ context, event }) => {
        expect(context.greeting).toBe('hello');
        expect(event.input.greeting).toBe('hello');
        done();
      }
    });

    const machine = createMachine({
      entry: assign(({ spawn }) => {
        return {
          ref: spawn(spawnedMachine, { input: { greeting: 'hello' } })
        };
      })
    });

    createActor(machine).start();
  });

  it('should create a promise with input', async () => {
    const promiseLogic = fromPromise<{ count: number }, { count: number }>(
      ({ input }) => Promise.resolve(input)
    );

    const promiseActor = createActor(promiseLogic, {
      input: { count: 42 }
    }).start();

    await new Promise((res) => setTimeout(res, 5));

    expect(promiseActor.getSnapshot().output).toEqual({ count: 42 });
  });

  it('should create a transition function actor with input', () => {
    const transitionLogic = fromTransition(
      (state) => state,
      ({ input }) => input
    );

    const transitionActor = createActor(transitionLogic, {
      input: { count: 42 }
    }).start();

    expect(transitionActor.getSnapshot().context).toEqual({ count: 42 });
  });

  it('should create an observable actor with input', (done) => {
    const observableLogic = fromObservable<
      { count: number },
      { count: number }
    >(({ input }) => of(input));

    const observableActor = createActor(observableLogic, {
      input: { count: 42 }
    });

    const sub = observableActor.subscribe((state) => {
      if (state.context?.count !== 42) return;
      expect(state.context).toEqual({ count: 42 });
      done();
      sub.unsubscribe();
    });

    observableActor.start();
  });

  it('should create a callback actor with input', (done) => {
    const callbackLogic = fromCallback(({ input }) => {
      expect(input).toEqual({ count: 42 });
      done();
    });

    createActor(callbackLogic, {
      input: { count: 42 }
    }).start();
  });

  it('should provide a static inline input to the referenced actor', () => {
    const spy = jest.fn();

    const child = createMachine({
      context: ({ input }: { input: number }) => {
        spy(input);
        return {};
      }
    });

    const machine = createMachine(
      {
        types: {} as {
          actors: { src: 'child'; logic: typeof child };
        },
        invoke: {
          src: 'child',
          input: 42
        }
      },
      {
        actors: {
          child
        }
      }
    );

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith(42);
  });

  it('should provide a dynamic inline input to the referenced actor', () => {
    const spy = jest.fn();

    const child = createMachine({
      context: ({ input }: { input: number }) => {
        spy(input);
        return {};
      }
    });

    const machine = createMachine(
      {
        types: {} as {
          actors: {
            src: 'child';
            logic: typeof child;
          };
          input: number;
          context: {
            count: number;
          };
        },
        context: ({ input }) => ({
          count: input
        }),
        invoke: {
          src: 'child',
          input: ({ context }) => {
            return context.count + 100;
          }
        }
      },
      {
        actors: {
          child
        }
      }
    );

    createActor(machine, { input: 42 }).start();

    expect(spy).toHaveBeenCalledWith(142);
  });

  it('should call the input factory with self when invoking', () => {
    const spy = jest.fn();

    const machine = createMachine({
      invoke: {
        src: createMachine({}),
        input: ({ self }: any) => spy(self)
      }
    });

    const actor = createActor(machine).start();

    expect(spy).toHaveBeenCalledWith(actor);
  });

  it('should call the input factory with self when spawning', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        entry: spawn('child', {
          input: ({ self }: any) => spy(self)
        })
      },
      {
        actors: {
          child: createMachine({})
        }
      }
    );

    const actor = createActor(machine).start();

    expect(spy).toHaveBeenCalledWith(actor);
  });
});
