import { fromCallback } from '../src/actors/callback.js';
import {
  ActorRef,
  ActorSystem,
  assign,
  createMachine,
  interpret,
  sendTo
} from '../src/index.js';

describe('system', () => {
  it('should register an actor (implicit system)', (done) => {
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
                entry: ({ meta: { system } }) => {
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

  it('system can be immediatelly accessed outside the actor', () => {
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

  it('should remove actor from receptionist if stopped', () => {
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
      entry: ({ meta: { system } }) => {
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
          myAction: ({ meta: { system } }) => {
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
      entry: assign((_, __, { system }) => {
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
        ({ meta: { system } }) => {
          expect(system!.get('test')).toBeDefined();
          return system!.get('test');
        },
        { type: 'FOO' }
      )
    });

    interpret(machine).start();
  });
});
