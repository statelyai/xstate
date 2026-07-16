import { expect, vi } from 'vitest';
import { createActor, createMachine, SimulatedClock } from '../src';

const createLightMachine = () =>
  createMachine({
    initial: 'green',
    states: {
      green: {
        after: { 1000: { target: 'yellow' } },
        on: { STOP: { target: 'red' } }
      },
      yellow: {},
      red: {}
    }
  });

function getTimers(persisted: unknown): Record<string, any> {
  return (persisted as any).timers;
}

describe('persisted logical timers', () => {
  it('persists timer intent without runtime clock bookkeeping', () => {
    const actor = createActor(createLightMachine(), {
      clock: new SimulatedClock()
    }).start();

    const persisted = actor.getPersistedSnapshot();
    const [timer] = Object.values(getTimers(persisted));

    expect(timer).toEqual({
      id: expect.stringMatching(/^xstate\.after/),
      delay: 1000,
      type: '@xstate.raise',
      event: { type: expect.stringMatching(/^xstate\.after/) },
      target: 'self'
    });
    expect(timer).not.toHaveProperty('scheduledAt');
    expect(timer).not.toHaveProperty('dueAt');
    expect(timer).not.toHaveProperty('elapsed');
    expect(() => JSON.stringify(persisted)).not.toThrow();
  });

  it('does not persist timers that were cancelled', () => {
    const actor = createActor(createLightMachine(), {
      clock: new SimulatedClock()
    }).start();
    actor.send({ type: 'STOP' });

    expect(getTimers(actor.getPersistedSnapshot())).toEqual({});
  });

  it('restarts logical timers with their declared delay when locally restored', () => {
    const actor = createActor(createLightMachine(), {
      clock: new SimulatedClock()
    }).start();
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const clock = new SimulatedClock();
    const restored = createActor(createLightMachine(), {
      clock,
      snapshot: persisted
    }).start();

    clock.increment(999);
    expect(restored.getSnapshot().value).toBe('green');
    clock.increment(1);
    expect(restored.getSnapshot().value).toBe('yellow');
  });

  it('cancels a restored timer when its declaring state exits', () => {
    const actor = createActor(createLightMachine(), {
      clock: new SimulatedClock()
    }).start();
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const clock = new SimulatedClock();
    const restored = createActor(createLightMachine(), {
      clock,
      snapshot: persisted
    }).start();

    restored.send({ type: 'STOP' });
    clock.increment(2000);
    expect(restored.getSnapshot().value).toBe('red');
  });

  it('round-trips timers through a restored-but-never-started actor', () => {
    const actor = createActor(createLightMachine(), {
      clock: new SimulatedClock()
    }).start();
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const idle = createActor(createLightMachine(), { snapshot: persisted });
    const rePersisted = idle.getPersistedSnapshot();
    const [timer] = Object.values(getTimers(rePersisted));

    expect(timer).toMatchObject({ delay: 1000, target: 'self' });
  });

  it('restores timers of rehydrated child actors', () => {
    const child = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 1000: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const parent = createMachine({
      actorSources: { child },
      initial: 'working',
      states: {
        working: {
          invoke: {
            src: 'child',
            onDone: { target: 'finished' }
          }
        },
        finished: {}
      }
    });

    const actor = createActor(parent, {
      clock: new SimulatedClock()
    }).start();
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const [childEntry] = Object.values((persisted as any).children) as any[];
    expect(Object.values(getTimers(childEntry.snapshot))).toHaveLength(1);

    const clock = new SimulatedClock();
    const restored = createActor(parent, {
      clock,
      snapshot: persisted
    }).start();

    expect(restored.getSnapshot().value).toBe('working');
    clock.increment(1000);
    expect(restored.getSnapshot().value).toBe('finished');
  });

  it('restores the logical target of a delayed child send', () => {
    const received = vi.fn();
    const child = createMachine({
      on: { PING: ({ event }, enq) => enq(received, event) }
    });
    const parent = createMachine({
      actorSources: { child },
      invoke: { id: 'child', src: 'child' },
      on: {
        SCHEDULE: ({ children }, enq) => {
          enq.sendTo(
            children.child,
            { type: 'PING' },
            {
              id: 'ping',
              delay: 100
            }
          );
        }
      }
    });
    const actor = createActor(parent, {
      clock: new SimulatedClock()
    }).start();
    actor.send({ type: 'SCHEDULE' });
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    expect(getTimers(persisted).ping).toMatchObject({
      type: '@xstate.sendTo',
      target: 'child',
      event: { type: 'PING' }
    });

    const clock = new SimulatedClock();
    createActor(parent, { clock, snapshot: persisted }).start();
    clock.increment(100);

    expect(received).toHaveBeenCalledWith({ type: 'PING' });
  });

  it('restores the logical parent target of a delayed child send', () => {
    const received = vi.fn();
    const child = createMachine({
      on: {
        SCHEDULE: ({ parent }, enq) =>
          enq.sendTo(
            parent,
            { type: 'PING' },
            { id: 'ping-parent', delay: 100 }
          )
      }
    });
    const parent = createMachine({
      actorSources: { child },
      invoke: { id: 'child', src: 'child' },
      on: {
        START: ({ children }, enq) =>
          enq.sendTo(children.child, { type: 'SCHEDULE' }),
        PING: ({ event }, enq) => enq(received, event)
      }
    });
    const actor = createActor(parent).start();
    actor.send({ type: 'START' });
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const [childEntry] = Object.values((persisted as any).children) as any[];
    expect(childEntry.snapshot.timers['ping-parent'].target).toEqual({
      type: 'parent'
    });

    const clock = new SimulatedClock();
    createActor(parent, { clock, snapshot: persisted }).start();
    clock.increment(100);

    expect(received).toHaveBeenCalledWith({ type: 'PING' });
  });

  it('does not rebind a delayed send to a replacement child with the same id', () => {
    const child = createMachine({});
    const parent = createMachine({
      actorSources: { child },
      initial: 'active',
      states: {
        active: {
          invoke: { id: 'child', src: 'child' },
          on: {
            SCHEDULE: ({ children }, enq) =>
              enq.sendTo(
                children.child,
                { type: 'PING' },
                { id: 'ping', delay: 100 }
              ),
            REENTER: { target: 'active', reenter: true }
          }
        }
      }
    });
    const actor = createActor(parent).start();
    actor.send({ type: 'SCHEDULE' });
    actor.send({ type: 'REENTER' });

    expect(() => actor.getPersistedSnapshot()).toThrow(
      "Unable to persist timer 'ping'"
    );
  });
});
