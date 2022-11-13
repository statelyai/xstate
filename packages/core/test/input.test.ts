import { interpret } from '../src';
import { createTypes } from '../src/createTypes';
import { createMachine2 as createMachine } from '../src/StateMachine';

describe('machine.withInput()', () => {
  it('should create a machine with input', () => {
    expect.assertions(3);
    const t = createTypes({
      input: {} as { startCount: number },
      context: {} as { count: number }
    });

    const machine = createMachine<typeof t>({
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

    // @ts-expect-error ("Missing `input`")
    interpret(machine);

    interpret(machine.withInput({ startCount: 42 })).start();
  });

  it('initial event should have input property', (done) => {
    const t = createTypes({
      input: {} as { greeting: string }
    });

    const machine = createMachine<typeof t>({
      entry: (_, ev) => {
        expect(ev.input.greeting).toBe('hello');
        done();
      }
    });

    interpret(machine.withInput({ greeting: 'hello' })).start();
  });

  it('should throw if input is expected but not provided', () => {
    const t = createTypes({
      input: {} as { greeting: string }
    });

    const machine = createMachine<typeof t>({
      context: ({ input }) => ({
        message: `Hello, ${input.greeting}`
      })
    });

    expect(() => {
      machine.getInitialState();
    }).toThrowError(/Cannot read properties of undefined/);
  });

  it('should not throw if input is not expected and not provided', () => {
    const t = createTypes({
      context: {} as { count: number }
    });

    const machine = createMachine<typeof t>({
      context: ({ input }) => {
        try {
          // @ts-expect-error
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
    const t = createTypes({
      context: {} as { count: number }
    });

    const machine = createMachine<typeof t>({
      context: { count: 42 }
    });

    expect(() => {
      machine.getInitialState();
    }).not.toThrowError();
  });
});
