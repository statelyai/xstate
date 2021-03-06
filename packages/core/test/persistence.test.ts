import { assign, createMachine, forwardTo, interpret } from '../src';

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
            id: 'counter',
            src: createMachine<{ count: number }>({
              initial: 'counting',
              context: { count: 42 },
              states: {
                counting: {
                  on: {
                    INC: {
                      actions: assign({ count: (ctx) => ctx.count + 1 })
                    }
                  }
                }
              }
            })
          },
          on: {
            INC: { actions: forwardTo('counter') }
          }
        }
      }
    });

    const service = interpret(machine).start();
    service.send('NEXT');
    service.send('INC');

    const snapshot = service.getSnapshot();

    service.stop();

    const restoredService = interpret(machine).start(snapshot);

    console.log(restoredService.children);

    expect(restoredService.children['counter'].getSnapshot()).toEqual(42);
  });
});
