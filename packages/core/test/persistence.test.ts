import {
  createMachine,
  assign,
  forwardTo,
  interpret,
  spawn,
  sendParent,
  ActorRefFrom
} from '../src';

describe('persistence', () => {
  it('persists actor state', (done) => {
    const machine = createMachine({
      id: 'parent',
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
              context: { count: 40 },
              states: {
                counting: {
                  on: {
                    INC: {
                      target: 'checking',
                      actions: assign({ count: (ctx) => ctx.count + 1 })
                    }
                  }
                },
                checking: {
                  always: [
                    { target: 'success', cond: (ctx) => ctx.count === 42 },
                    { target: 'counting' }
                  ]
                },
                success: {
                  type: 'final'
                }
              }
            }),
            onDone: 'success'
          },
          on: {
            INC: { actions: forwardTo('counter') }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const service = interpret(machine).start();
    service.send('NEXT'); // counter invoked
    service.send('INC');

    const snapshot = service.getSnapshot();

    delete (snapshot as any).actions;

    service.stop();

    const restoredService = interpret(machine)
      .onDone(() => {
        done();
      })
      .start(snapshot);

    expect(
      restoredService.children.get('counter')?.getSnapshot().context
    ).toEqual({ count: 41 });

    restoredService.send('INC');
  });

  it.only('persists actor state from a spawned machine', (done) => {
    const countMachine = createMachine<{ count: number }>({
      initial: 'counting',
      context: { count: 40 },
      states: {
        counting: {
          on: {
            INC: {
              target: 'checking',
              actions: assign({ count: (ctx) => ctx.count + 1 })
            }
          }
        },
        checking: {
          always: [
            { target: 'success', cond: (ctx) => ctx.count === 42 },
            { target: 'counting' }
          ]
        },
        success: {
          entry: sendParent('REACHED')
        }
      }
    });

    const machine = createMachine<{
      ref: null | ActorRefFrom<typeof countMachine>;
    }>({
      id: 'parent',
      initial: 'inactive',
      context: {
        ref: null
      },
      states: {
        inactive: {
          on: {
            NEXT: {
              target: 'active',
              actions: assign({
                ref: () => spawn(countMachine, 'counter')
              })
            }
          }
        },
        active: {
          on: {
            INC: { actions: forwardTo('counter') },
            REACHED: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const service = interpret(machine).start();
    service.send('NEXT'); // counter spawned

    expect(service.getSnapshot()!.context.ref!.getSnapshot()).toEqual('ajis');

    service.send('INC');

    const snapshot = service.getSnapshot();

    delete (snapshot as any).actions;

    service.stop();

    const restoredService = interpret(machine)
      .onDone(() => {
        done();
      })
      .start(snapshot);

    // console.log(snapshot?.context);

    expect(
      restoredService.children.get('counter')?.getSnapshot()?.context
    ).toEqual({ count: 41 });

    console.log(restoredService.children.keys());

    restoredService.send('INC');
  });
});
