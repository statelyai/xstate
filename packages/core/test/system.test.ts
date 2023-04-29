import { fromCallback } from '../src/actors/callback.ts';
import {
  ActorRef,
  ActorSystem,
  assign,
  createMachine,
  interpret,
  sendTo,
  stop
} from '../src/index.ts';

describe('system', () => {
  it('should register an invoked actor', (done) => {
    type MySystem = ActorSystem<{
      actors: {
        receiver: ActorRef<{ type: 'HELLO' }>;
      };
    }>;

    const machine = createMachine({
      id: 'parent',
      initial: 'a',
      states: {
        a: {
          invoke: [
            {
              src: fromCallback((_, receive) => {
                receive((event) => {
                  expect(event.type).toBe('HELLO');
                  done();
                });
              }),
              systemId: 'receiver'
            },
            {
              src: createMachine({
                id: 'childmachine',
                entry: ({ system }) => {
                  const receiver = (system as MySystem)?.get('receiver');

                  if (receiver) {
                    receiver.send({ type: 'HELLO' });
                  }
                }
              })
            }
          ]
        }
      }
    });

    interpret(machine).start();
  });

  it('should register a spawned actor', (done) => {
    type MySystem = ActorSystem<{
      actors: {
        receiver: ActorRef<{ type: 'HELLO' }>;
      };
    }>;

    const machine = createMachine({
      id: 'parent',
      context: ({ spawn }) => ({
        ref: spawn(
          fromCallback((_, receive) => {
            receive((event) => {
              expect(event.type).toBe('HELLO');
              done();
            });
          }),
          { systemId: 'receiver' }
        )
      }),
      on: {
        toggle: {
          actions: assign({
            machineRef: ({ spawn }) => {
              return spawn(
                createMachine({
                  id: 'childmachine',
                  entry: ({ system }) => {
                    const receiver = (system as MySystem)?.get('receiver');

                    if (receiver) {
                      receiver.send({ type: 'HELLO' });
                    } else {
                      throw new Error('no');
                    }
                  }
                })
              );
            }
          })
        }
      }
    });

    const actor = interpret(machine).start();

    actor.send({ type: 'toggle' });
  });

  it('system can be immediately accessed outside the actor', () => {
    const machine = createMachine({
      invoke: {
        systemId: 'someChild',
        src: createMachine({})
      }
    });

    // no .start() here is important for the test
    const actor = interpret(machine);

    expect(actor.system.get('someChild')).toBeDefined();
  });

  it('root actor can be given the systemId', () => {
    const machine = createMachine({});
    const actor = interpret(machine, { systemId: 'test' });
    expect(actor.system.get('test')).toBe(actor);
  });

  it('should remove invoked actor from receptionist if stopped', () => {
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            src: createMachine({}),
            systemId: 'test'
          },
          on: {
            toggle: 'inactive'
          }
        },
        inactive: {}
      }
    });

    const actor = interpret(machine).start();

    expect(actor.system.get('test')).toBeDefined();

    actor.send({ type: 'toggle' });

    expect(actor.system.get('test')).toBeUndefined();
  });

  it('should remove spawned actor from receptionist if stopped', () => {
    const machine = createMachine({
      context: ({ spawn }) => ({
        ref: spawn(createMachine({}), {
          systemId: 'test'
        })
      }),
      on: {
        toggle: {
          actions: stop(({ context }) => context.ref)
        }
      }
    });

    const actor = interpret(machine).start();

    expect(actor.system.get('test')).toBeDefined();

    actor.send({ type: 'toggle' });

    expect(actor.system.get('test')).toBeUndefined();
  });

  it('should throw an error if an actor with the system ID already exists', () => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            toggle: 'active'
          }
        },
        active: {
          invoke: [
            {
              src: createMachine({}),
              systemId: 'test'
            },
            {
              src: createMachine({}),
              systemId: 'test'
            }
          ]
        }
      }
    });

    const actor = interpret(machine, { systemId: 'test' }).start();

    expect(() => {
      actor.send({ type: 'toggle' });
    }).toThrowErrorMatchingInlineSnapshot(
      `"Actor with system ID 'test' already exists."`
    );
  });

  it('should be accessible in inline custom actions', () => {
    const machine = createMachine({
      invoke: {
        src: createMachine({}),
        systemId: 'test'
      },
      entry: ({ system }) => {
        expect(system!.get('test')).toBeDefined();
      }
    });

    interpret(machine).start();
  });

  it('should be accessible in referenced custom actions', () => {
    const machine = createMachine(
      {
        invoke: {
          src: createMachine({}),
          systemId: 'test'
        },
        entry: 'myAction'
      },
      {
        actions: {
          myAction: ({ system }) => {
            expect(system!.get('test')).toBeDefined();
          }
        }
      }
    );

    interpret(machine).start();
  });

  it('should be accessible in assign actions', () => {
    const machine = createMachine({
      invoke: {
        src: createMachine({}),
        systemId: 'test'
      },
      entry: assign(({ system }) => {
        expect(system!.get('test')).toBeDefined();
      })
    });

    interpret(machine).start();
  });

  it('should be accessible in sendTo actions', () => {
    const machine = createMachine({
      invoke: {
        src: createMachine({}),
        systemId: 'test'
      },
      entry: sendTo(
        ({ system }) => {
          expect(system!.get('test')).toBeDefined();
          return system!.get('test');
        },
        { type: 'FOO' }
      )
    });

    interpret(machine).start();
  });
});
