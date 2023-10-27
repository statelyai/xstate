import { createMachine, createActor, fromPromise } from '../src/index.ts';

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

    it('should not call exit actions when machine gets stopped immediately', () => {
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

      createActor(machine, { state: JSON.parse(persistedState) })
        .start()
        .stop();

      expect(actual).toEqual([]);
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

    it('should not call exit actions when machine gets stopped immediately', () => {
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

      expect(actual).toEqual([]);
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

  it('should be able to stop a rehydrated child', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: fromPromise(() => Promise.resolve(11)),
            onDone: 'b'
          },
          on: {
            NEXT: 'c'
          }
        },
        b: {},
        c: {}
      }
    });

    const actor = createActor(machine).start();
    const persistedState = actor.getPersistedState();
    actor.stop();

    const rehydratedActor = createActor(machine, {
      state: persistedState
    }).start();

    expect(() =>
      rehydratedActor.send({
        type: 'NEXT'
      })
    ).not.toThrow();

    expect(rehydratedActor.getSnapshot().value).toBe('c');
  });

  it('a rehydrated active child should be registered in the system', () => {
    const machine = createMachine(
      {
        context: ({ spawn }) => {
          spawn('foo', {
            systemId: 'mySystemId'
          });
          return {};
        }
      },
      {
        actors: {
          foo: createMachine({})
        }
      }
    );

    const actor = createActor(machine).start();
    const persistedState = actor.getPersistedState();
    actor.stop();

    const rehydratedActor = createActor(machine, {
      state: persistedState
    }).start();

    expect(rehydratedActor.system.get('mySystemId')).not.toBeUndefined();
  });

  it('a rehydrated done child should not be registered in the system', () => {
    const machine = createMachine(
      {
        context: ({ spawn }) => {
          spawn('foo', {
            systemId: 'mySystemId'
          });
          return {};
        }
      },
      {
        actors: {
          foo: createMachine({ type: 'final' })
        }
      }
    );

    const actor = createActor(machine).start();
    const persistedState = actor.getPersistedState();
    actor.stop();

    const rehydratedActor = createActor(machine, {
      state: persistedState
    }).start();

    expect(rehydratedActor.system.get('mySystemId')).toBeUndefined();
  });
});
