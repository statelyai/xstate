import { createMachine } from '../src';

describe('machine.withInput()', () => {
  it('should create a machine with input', () => {
    const machine = createMachine({
      context: ({ input }) => ({
        count: input.startCount
      })
    });

    const inputMachine = machine.withInput({ startCount: 42 });
    const initialState = inputMachine.getInitialState();

    expect(initialState.context.count).toEqual(42);
    expect(machine.getInitialState().context.count).toBeUndefined();
  });
});
