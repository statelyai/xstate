import { fromCallback } from '../src/actors/callback.js';
import { createMachine, interpret } from '../src/index.js';
import { createSystem } from '../src/system.js';

describe('system', () => {
  it('should create a system', () => {
    const system = createSystem();

    expect(system).toBeDefined();

    const machine = createMachine({
      entry: (ctx, ev, { system }) => {
        console.log('system', system);
      }
    });

    interpret(machine, { system }).start();
  });

  it('should register an actor (implicit system)', (done) => {
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
              key: 'receiver'
            },
            {
              src: createMachine({
                id: 'childmachine',
                entry: (ctx, ev, { system }) => {
                  const receiver = system?.get('receiver');

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

  it('should register an actor (explicit system)', (done) => {
    const system = createSystem();

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
              key: 'receiver'
            },
            {
              src: createMachine({
                id: 'childmachine',
                entry: (ctx, ev, { system }) => {
                  const receiver = system?.get('receiver');

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

    interpret(machine, { system }).start();
  });
});
