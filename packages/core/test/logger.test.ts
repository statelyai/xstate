import { createActor, createMachine, log } from '../src';

describe('logger', () => {
  it('system logger should be default logger for actors', () => {
    expect.assertions(1);
    const machine = createMachine({
      invoke: {
        src: createMachine({
          entry: log('hello')
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
});
