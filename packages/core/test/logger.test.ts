import { createActor, createMachine } from '../src';

describe('logger', () => {
  it('system logger should be default logger for actors (invoked from machine)', () => {
    expect.assertions(1);
    const machine = createMachine({
      invoke: {
        src: createMachine({
          entry: (_, enq) => {
            enq.log('hello');
          }
        })
      }
    });

    const actor = createActor(machine, {
      logger: (arg) => {
        expect(arg).toEqual('hello');
      }
    }).start();

    actor.start();
  });

  it('system logger should be default logger for actors (spawned from machine)', () => {
    expect.assertions(1);
    const machine = createMachine({
      entry: (_, enq) =>
        void enq.spawn(
          createMachine({
            entry: (_, enq) => {
              enq.log('hello');
            }
          })
        )
    });

    const actor = createActor(machine, {
      logger: (arg) => {
        expect(arg).toEqual('hello');
      }
    }).start();

    actor.start();
  });
});
