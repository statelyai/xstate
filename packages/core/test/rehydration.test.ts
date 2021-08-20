import { createMachine, interpret, State } from '../src';

describe('rehydration', () => {
  it('should be able to use `hasTag` on the rehydrated state', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          tags: 'foo'
        }
      }
    });

    const persistedState = JSON.stringify(machine.initialState);
    const restoredState = State.create(JSON.parse(persistedState));

    const service = interpret(machine).start(restoredState);

    expect(service.state.hasTag('foo')).toBe(true);
  });
});
