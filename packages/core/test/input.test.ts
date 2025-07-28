import { of } from 'rxjs';
import { createActor, next_createMachine } from '../src';
import {
  fromCallback,
  fromObservable,
  fromPromise,
  fromTransition
} from '../src/actors';
import z from 'zod';

describe('input', () => {
  it('should create a machine with input', () => {
    const spy = vi.fn();

    const machine = next_createMachine({
      // types: {} as {
      //   context: { count: number };
      //   input: { startCount: number };
      // },
      schemas: {
        context: z.object({
          count: z.number()
        }),
        input: z.object({
          startCount: z.number()
        })
      },
      context: ({ input }) => ({
        count: input.startCount
      }),
      entry: ({ context }, enq) => {
        enq(spy, context.count);
      }
    });

    createActor(machine, { input: { startCount: 42 } }).start();

    expect(spy).toHaveBeenCalledWith(42);
  });

  it('initial event should have input property', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      entry: ({ event }) => {
        expect(event.input.greeting).toBe('hello');
        resolve();
      }
    });

    createActor(machine, { input: { greeting: 'hello' } }).start();

    return promise;
  });

  it('should error if input is expected but not provided', () => {
    const machine = next_createMachine({
      // types: {} as {
      //   input: { greeting: string };
      //   context: { message: string };
      // },
      schemas: {
        input: z.object({
          greeting: z.string()
        }),
        context: z.object({
          message: z.string()
        })
      },
      context: ({ input }) => {
        return { message: `Hello, ${input.greeting}` };
      }
    });

    // @ts-expect-error
    const snapshot = createActor(machine).getSnapshot();

    expect(snapshot.status).toBe('error');
  });

  it('should be a type error if input is not expected yet provided', () => {
    const machine = next_createMachine({
      context: { count: 42 }
    });

    expect(() => {
      // TODO: add ts-expect-errpr
      createActor(machine).start();
    }).not.toThrowError();
  });

  it('should provide input data to invoked machines', () => {
    const { resolve, promise } = Promise.withResolvers<void>();

    const invokedMachine = next_createMachine({
      // types: {} as {
      //   input: { greeting: string };
      //   context: { greeting: string };
      // },
      schemas: {
        input: z.object({
          greeting: z.string()
        }),
        context: z.object({
          greeting: z.string()
        })
      },
      context: ({ input }) => input,
      entry: ({ context, event }) => {
        expect(context.greeting).toBe('hello');
        expect(event.input.greeting).toBe('hello');
        resolve();
      }
    });

    const machine = next_createMachine({
      invoke: {
        src: invokedMachine,
        input: { greeting: 'hello' }
      }
    });

    createActor(machine).start();

    return promise;
  });

  it('should provide input data to spawned machines', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const spawnedMachine = next_createMachine({
      // types: {} as {
      //   input: { greeting: string };
      //   context: { greeting: string };
      // },
      schemas: {
        input: z.object({
          greeting: z.string()
        }),
        context: z.object({
          greeting: z.string()
        }),
        events: z.object({
          type: z.literal('greeting'),
          input: z.object({
            greeting: z.string()
          })
        })
      },
      context({ input }) {
        return input;
      },
      entry: ({ context, event }) => {
        expect(context.greeting).toBe('hello');
        expect(event.input.greeting).toBe('hello');
        resolve();
      }
    });

    const machine = next_createMachine({
      schemas: {
        context: z.object({
          ref: z.object({}).optional()
        })
      },
      context: {
        ref: undefined
      },
      entry: (_, enq) => ({
        context: {
          ref: enq.spawn(spawnedMachine, { input: { greeting: 'hello' } })
        }
      })
    });

    createActor(machine).start();

    return promise;
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

  it('should create an observable actor with input', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
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
      sub.unsubscribe();
      resolve();
    });

    observableActor.start();

    return promise;
  });

  it('should create a callback actor with input', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const callbackLogic = fromCallback(({ input }) => {
      expect(input).toEqual({ count: 42 });
      resolve();
    });

    createActor(callbackLogic, {
      input: { count: 42 }
    }).start();

    return promise;
  });

  it('should provide a static inline input to the referenced actor', () => {
    const spy = vi.fn();

    const child = next_createMachine({
      context: ({ input }: { input: number }) => {
        spy(input);
        return {};
      }
    });

    const machine = next_createMachine({
      // types: {} as {
      //   actors: { src: 'child'; logic: typeof child };
      // },
      invoke: {
        src: child,
        input: 42
      }
    });

    createActor(machine).start();

    expect(spy).toHaveBeenCalledWith(42);
  });

  it('should provide a dynamic inline input to the referenced actor', () => {
    const spy = vi.fn();

    const child = next_createMachine({
      context: ({ input }: { input: number }) => {
        spy(input);
        return {};
      }
    });

    const machine = next_createMachine(
      {
        // types: {} as {
        //   actors: {
        //     src: 'child';
        //     logic: typeof child;
        //   };
        //   input: number;
        //   context: {
        //     count: number;
        //   };
        // },
        schemas: {
          context: z.object({
            count: z.number()
          }),
          input: z.number()
        },
        context: ({ input }) => ({
          count: input
        }),
        invoke: {
          src: child,
          input: ({ context }) => {
            return context.count + 100;
          }
        }
      }
      // {
      //   actors: {
      //     child
      //   }
      // }
    );

    createActor(machine, { input: 42 }).start();

    expect(spy).toHaveBeenCalledWith(142);
  });

  it('should call the input factory with self when invoking', () => {
    const spy = vi.fn();

    const machine = next_createMachine({
      invoke: {
        src: next_createMachine({}),
        input: ({ self }: any) => spy(self)
      }
    });

    const actor = createActor(machine).start();

    expect(spy).toHaveBeenCalledWith(actor);
  });

  it('should call the input factory with self when spawning', async () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const spy = vi.fn();

    const child = next_createMachine({});

    const machine = next_createMachine({
      // entry: spawnChild(child, {
      //   input: ({ self }: any) => spy(self)
      // })
      entry: (_, enq) => {
        enq.spawn(child, {
          input: ({ self }) => {
            // TODO: input isn't called as a function yet
            expect(self).toBe(actor);
            resolve();
          }
        });
      }
    });

    const actor = createActor(machine).start();

    return promise;
  });
});
