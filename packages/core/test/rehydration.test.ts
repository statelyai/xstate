import { createMachine, interpret, State } from '../src';

describe('rehydration', () => {
  it('should be able to use `hasTag` after rehydrating persisted state', () => {
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

  it('should be able to use `hasTag` after rehydrating state value', () => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: { NEXT: 'active' }
        },
        active: {
          tags: 'foo'
        }
      }
    });

    const service = interpret(machine);

    service.start('active');

    expect(service.state.hasTag('foo')).toBe(true);
  });
});
