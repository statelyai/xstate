import { interpret } from '../src';
import { createMachine } from '../src/Machine';

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
});
