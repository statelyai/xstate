import { createMachine, interpret } from '../src/index.ts';

describe('rehydration', () => {
  describe('using persisted state', () => {
    it('should be able to use `hasTag` immediately', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            tags: 'foo'
          }
        }
      });

      const persistedState = JSON.stringify(machine.initialState);
      const restoredState = machine.createState(JSON.parse(persistedState));

      const service = interpret(machine, { state: restoredState }).start();

      expect(service.getSnapshot().hasTag('foo')).toBe(true);
    });

    it('should call exit actions when machine gets stopped immediately', () => {
      const actual: string[] = [];
      const machine = createMachine({
        exit: () => actual.push('root'),
        initial: 'a',
        states: {
          a: {
            exit: () => actual.push('a')
          }
        }
      });

      const persistedState = JSON.stringify(machine.initialState);
      const restoredState = machine.createState(JSON.parse(persistedState));

      interpret(machine, { state: restoredState }).start().stop();

      expect(actual).toEqual(['a', 'root']);
    });

    it('should get correct result back from `can` immediately', () => {
      const machine = createMachine({
        on: {
          FOO: {
            actions: () => {}
          }
        }
      });

      const persistedState = JSON.stringify(
        interpret(machine).start().getSnapshot()
      );
      const restoredState = JSON.parse(persistedState);
      const service = interpret(machine, { state: restoredState }).start();

      expect(service.getSnapshot().can({ type: 'FOO' })).toBe(true);
    });
  });

  describe('using state value', () => {
    it('should be able to use `hasTag` immediately', () => {
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

      const activeState = machine.resolveStateValue('active');
      const service = interpret(machine, { state: activeState });

      service.start();

      expect(service.getSnapshot().hasTag('foo')).toBe(true);
    });

    it('should call exit actions when machine gets stopped immediately', () => {
      const actual: string[] = [];
      const machine = createMachine({
        exit: () => actual.push('root'),
        initial: 'inactive',
        states: {
          inactive: {
            on: { NEXT: 'active' }
          },
          active: {
            exit: () => actual.push('active')
          }
        }
      });

      const activeState = machine.resolveStateValue('active');

      interpret(machine, { state: activeState }).start().stop();

      expect(actual).toEqual(['active', 'root']);
    });
  });

  // TODO: rethink how rehydration works, do we even need to go through `.start()` and thus through micro/macrostep procedures?
  it.skip('should not replay actions when starting from a persisted state', () => {
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
