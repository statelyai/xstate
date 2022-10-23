import { createTypes } from '../src/createTypes';
import { createMachine2 } from '../src/Machine';

describe('machine.withInput()', () => {
  it('should create a machine with input', () => {
    const t = createTypes({
      input: {} as { startCount: number },
      context: {} as { count: number }
    });

    const machine = createMachine2<typeof t>({
      context: ({ input }) => ({
        count: input.startCount
      }),
      entry: (ctx) => {
        ctx.count;
      }
    });

    const inputMachine = machine.withInput({ startCount: 42 });
    const initialState = inputMachine.getInitialState();

    expect(initialState.context.count).toEqual(42);
    expect(machine.getInitialState().context.count).toBeUndefined();
  });
});
