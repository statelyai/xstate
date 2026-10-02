import { vi } from 'vitest';
import { createActor, createMachine, SimulatedClock } from '../src';

describe('clock', () => {
  it('runs callbacks at their deadlines and includes newly scheduled intermediate timers', () => {
    const clock = new SimulatedClock();
    const times: number[] = [];
    clock.setTimeout(() => {
      times.push(clock.now());
      clock.setTimeout(() => times.push(clock.now()), 1000);
    }, 2000);
    clock.setTimeout(() => times.push(clock.now()), 6000);
    clock.set(6000);
    expect(times).toEqual([2000, 3000, 6000]);
    expect(clock.now()).toBe(6000);
  });

  it('reconsiders cancellation and equal-deadline ordering after each callback', () => {
    const clock = new SimulatedClock();
    const trace: string[] = [];
    clock.setTimeout(() => {
      trace.push('first');
      clock.clearTimeout(late);
      clock.setTimeout(() => trace.push('new'), 0);
    }, 2000);
    clock.setTimeout(() => trace.push('second'), 2000);
    const late = clock.setTimeout(() => trace.push('canceled'), 6000);
    clock.increment(6000);
    expect(trace).toEqual(['first', 'second', 'new']);
    expect(() => clock.increment(-1)).toThrow('back in time');
    expect(() => clock.set(NaN)).toThrow('finite');
  });
  it('orders large mixed batches while removing cancelled entries and inserting callback timers', () => {
    const clock = new SimulatedClock();
    const trace: { index: number; time: number }[] = [];
    const ids: number[] = [];
    const records = Array.from({ length: 1000 }, (_, index) => ({
      index,
      time: (index * 7919) % 200
    }));
    clock.setTimeout(() => {
      clock.clearTimeout(ids[555]);
      clock.clearTimeout(ids[556]);
      clock.setTimeout(() => trace.push({ index: 1000, time: clock.now() }), 0);
    }, 0);
    for (const record of records)
      ids.push(
        clock.setTimeout(
          () => trace.push({ index: record.index, time: clock.now() }),
          record.time
        )
      );
    for (let index = 0; index < ids.length; index += 7)
      clock.clearTimeout(ids[index]);
    clock.set(200);
    const expected = [
      ...records.filter(
        ({ index }) => index % 7 !== 0 && index !== 555 && index !== 556
      ),
      { index: 1000, time: 0 }
    ].sort((a, b) => a.time - b.time || a.index - b.index);
    expect(trace).toEqual(expected);
    expect(clock.now()).toBe(200);
  });

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

  it('uses the injected clock time when restoring scheduled timers', () => {
    const clock = new SimulatedClock();
    clock.set(1_000);
    const setTimeoutSpy = vi.spyOn(clock, 'setTimeout');
    const actor = createActor(createMachine({}), { clock });

    actor.system._snapshot._scheduledTimers = {
      restored: {
        source: actor,
        id: 'restored',
        delay: 100,
        scheduledAt: 950,
        dueAt: 1_050
      }
    } as any;

    actor.start();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 50);
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

it('continues flushing future timers after a callback throws', () => {
  const clock = new SimulatedClock();
  const fired = vi.fn();
  clock.setTimeout(() => {
    throw new Error('timer failed');
  }, 0);
  expect(() => clock.increment(1)).toThrow('timer failed');
  clock.setTimeout(fired, 0);
  clock.increment(1);
  expect(fired).toHaveBeenCalledTimes(1);
});
