import { interpret } from '../src';
import { createTypes } from '../src/createTypes';
import { createMachine2 } from '../src/StateMachine';

describe('machine.withInput()', () => {
  it('should create a machine with input', () => {
    expect.assertions(3);
    const t = createTypes({
      input: {} as { startCount: number },
      context: {} as { count: number }
    });

    const machine = createMachine2<typeof t>({
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
    expect(machine.getInitialState().context.count).toBeUndefined();

    interpret(machine.withInput({ startCount: 42 })).start();
  });

  it('initial event should have input property', (done) => {
    const t = createTypes({
      input: {} as { greeting: string }
    });

    const machine = createMachine2<typeof t>({
      entry: (_, ev) => {
        expect(ev.input.greeting).toBe('hello');
        done();
      }
    });

    interpret(machine.withInput({ greeting: 'hello' })).start();
  });
});
