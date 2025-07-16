import { createActor, next_createMachine } from '../src';

describe('logger', () => {
  it('system logger should be default logger for actors (invoked from machine)', () => {
    expect.assertions(1);
    const machine = next_createMachine({
      invoke: {
        src: next_createMachine({
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
    const machine = next_createMachine({
      entry: (_, enq) =>
        void enq.spawn(
          next_createMachine({
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
