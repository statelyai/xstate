import { createMachine, interpret } from '../src';

describe('persistence', () => {
  it('persists actor state', () => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: { NEXT: 'active' }
        },
        active: {
          invoke: {
            src: createMachine({
              initial: 'counting',
              context: { count: 42 },
              states: {
                counting: {}
              }
            })
          }
        }
      }
    });

    const service = interpret(machine).start();
    service.send('NEXT');

    console.log(JSON.stringify(service.getSnapshot(), null, 2));
  });
});
