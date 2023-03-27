import { createMachine, interpret } from '../src';

describe('restoring state', () => {
  it('should not replay actions', () => {
    const entrySpy = jest.fn();
    const machine = createMachine({
      entry: entrySpy
    });

    const actor = interpret(machine).start();

    expect(entrySpy).toHaveBeenCalledTimes(1);

    const persistedState = actor.getPersistedState();

    actor.stop();

    interpret(machine, { state: persistedState }).start();

    expect(entrySpy).toHaveBeenCalledTimes(1);
  });
});
