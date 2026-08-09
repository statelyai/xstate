import { createActor, createMachine, SimulatedClock } from '../src';

describe('clock', () => {
  it('uses the injected clock time for scheduled timer metadata', () => {
    const clock = new SimulatedClock();
    clock.set(1_000);
    const actor = createActor(
      createMachine({
        initial: 'waiting',
        states: {
          waiting: { after: { 100: { target: 'done' } } },
          done: {}
        }
      }),
      { clock }
    ).start();

    expect(
      Object.values(actor.system.getSnapshot()._scheduledTimers)[0]
    ).toMatchObject({ scheduledAt: 1_000, dueAt: 1_100 });
  });

  it('system clock should be default clock for actors (invoked from machine)', () => {
    const clock = new SimulatedClock();

    const machine = createMachine({
      invoke: {
        id: 'child',
        src: createMachine({
          initial: 'a',
          states: {
            a: {
              after: {
                10_000: { target: 'b' }
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
