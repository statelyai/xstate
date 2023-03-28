import { fromCallback } from '../src/actors/callback.js';
import {
  ActorRef,
  ActorSystem,
  createMachine,
  interpret
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
                entry: (_ctx, _ev, { system }) => {
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

  it('system can be accessed outside the actor', () => {
    const machine = createMachine({});
    const actor = interpret(machine, { systemId: 'test' });
    const system = actor.system;
    const retrievedActor = system.get('test');

    expect(actor).toBe(retrievedActor);
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
});
