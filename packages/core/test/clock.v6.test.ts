import { createActor, next_createMachine, SimulatedClock } from '../src';

describe('clock', () => {
  it('system clock should be default clock for actors (invoked from machine)', () => {
    const clock = new SimulatedClock();

    const machine = next_createMachine({
      invoke: {
        id: 'child',
        src: next_createMachine({
          initial: 'a',
          states: {
            a: {
              after: {
                10_000: 'b'
              }
            },
            b: {}
          }
        })
      }
    });

    const actor = createActor(machine, {
      clock
    }).start();

    expect(actor.getSnapshot().children.child.getSnapshot().value).toEqual('a');

    clock.increment(10_000);

    expect(actor.getSnapshot().children.child.getSnapshot().value).toEqual('b');
  });
});
