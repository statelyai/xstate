import { interpret } from '../src';
import { createMachine } from '../src/Machine';

describe('machine.withInput()', () => {
  it('should create a machine with input', () => {
    expect.assertions(3);

    const machine = createMachine<{ count: number }>({
      context: ({ input }) => ({
        count: input.startCount
      }),
      entry: (ctx) => {
        expect(ctx.count).toBe(42);
      }
    });

    const inputMachine = machine.withInput({ startCount: 42 });
    const initialState = inputMachine.getInitialState();

    expect(initialState.context.count).toEqual(42);
    expect(() => machine.getInitialState().context.count).toThrowError(
      /Cannot read properties of undefined/
    );

    interpret(machine.withInput({ startCount: 42 })).start();
  });

  it('initial event should have input property', (done) => {
    const machine = createMachine({
      entry: (_, ev) => {
        expect(ev.input.greeting).toBe('hello');
        done();
      }
    });

    interpret(machine.withInput({ greeting: 'hello' })).start();
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
      machine.getInitialState();
    }).toThrowError(/Cannot read properties of undefined/);
  });

  it('should not throw if input is not expected and not provided', () => {
    const machine = createMachine<{ count: number }>({
      context: ({ input }) => {
        try {
          input.whatever;
        } catch (_) {}

        return { count: 42 };
      }
    });

    expect(() => {
      machine.getInitialState();
    }).not.toThrowError();
  });

  it('should be a type error if input is not expected yet provided', () => {
    const machine = createMachine<{ count: 42 }>({
      context: { count: 42 }
    });

    expect(() => {
      machine.getInitialState();
    }).not.toThrowError();
  });
});
