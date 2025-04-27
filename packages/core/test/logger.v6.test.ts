import { createActor, createMachine } from '../src';

describe('logger', () => {
  it('system logger should be default logger for actors (invoked from machine)', () => {
    expect.assertions(1);
    const machine = createMachine({
      invoke: {
        src: createMachine({
          entry2: (_, enq) => {
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
      entry2: (_, enq) =>
        void enq.spawn(
          createMachine({
            entry2: (_, enq) => {
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
