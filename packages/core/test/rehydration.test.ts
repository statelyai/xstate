import { createMachine, createActor } from '../src/index.ts';

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

      const actorRef = createActor(machine).start();
      const persistedState = JSON.stringify(actorRef.getPersistedState());
      actorRef.stop();

      const service = createActor(machine, {
        state: JSON.parse(persistedState)
      }).start();

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

      const actorRef = createActor(machine).start();
      const persistedState = JSON.stringify(actorRef.getPersistedState());
      actorRef.stop();

      actual.length = 0;
      createActor(machine, { state: JSON.parse(persistedState) })
        .start()
        .stop();

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
        createActor(machine).start().getSnapshot()
      );
      const restoredState = JSON.parse(persistedState);
      const service = createActor(machine, {
        state: restoredState
      }).start();

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
      const service = createActor(machine, {
        state: activeState
      });

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

      createActor(machine, {
        state: machine.resolveStateValue('active')
      })
        .start()
        .stop();

      expect(actual).toEqual(['active', 'root']);
    });
  });

  it('should not replay actions when starting from a persisted state', () => {
    const entrySpy = jest.fn();
    const machine = createMachine({
      entry: entrySpy
    });

    const actor = createActor(machine).start();

    expect(entrySpy).toHaveBeenCalledTimes(1);

    const persistedState = actor.getPersistedState();

    actor.stop();

    createActor(machine, { state: persistedState }).start();

    expect(entrySpy).toHaveBeenCalledTimes(1);
  });
});
