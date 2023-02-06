import { fromCallback } from '../src/actors/callback.js';
import { createMachine, interpret } from '../src/index.js';
import { createSystem } from '../src/registry.js';

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

  it.only('should register an actor', () => {
    const machine = createMachine({
      id: 'parent',
      initial: 'a',
      states: {
        a: {
          invoke: [
            {
              src: fromCallback((cb, receive) => {
                receive((event) => {
                  console.log('received', event);
                });
              }),
              key: 'receiver'
            },
            {
              src: createMachine({
                id: 'childmachine',
                entry: (ctx, ev, { system }) => {
                  const receiver = system?.get('receiver');

                  console.log('receiver', receiver);
                }
              })
            }
          ]
        }
      }
    });

    interpret(machine).start();
  });
});
