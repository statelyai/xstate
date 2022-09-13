import { createMachine, interpret, State } from '../src';

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
      const restoredState = State.create(JSON.parse(persistedState));

      const service = interpret(machine).start(restoredState);

      expect(service.state.hasTag('foo')).toBe(true);
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
      const restoredState = State.create(JSON.parse(persistedState));

      interpret(machine).start(restoredState).stop();

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

      const persistedState = JSON.stringify(interpret(machine).start().state);
      const restoredState = JSON.parse(persistedState);
      const service = interpret(machine).start(restoredState);

      expect(service.state.can('FOO')).toBe(true);
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

      const service = interpret(machine);

      service.start('active');

      expect(service.state.hasTag('foo')).toBe(true);
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

      interpret(machine).start('active').stop();

      expect(actual).toEqual(['active', 'root']);
    });
  });
});
