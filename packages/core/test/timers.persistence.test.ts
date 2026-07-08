import { createActor, createMachine, SimulatedClock } from '../src';
import type { PendingEffect } from '../src';

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

function getTimers(persisted: unknown): PendingEffect[] {
  return (persisted as any)._pendingEffects;
}

describe('persisted timers', () => {
  it('persists pending delayed transitions with restoration info', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createLightMachine(), { clock }).start();

    const persisted = actor.getPersistedSnapshot();
    const timers = getTimers(persisted);

    expect(timers).toHaveLength(1);
    expect(timers[0]).toEqual(
      expect.objectContaining({
        type: '@xstate.raise',
        delay: 1000,
        startedAt: expect.any(Number),
        elapsed: expect.any(Number)
      })
    );
    expect(timers[0].event.type).toMatch(/^xstate\.after/);
    // JSON-safe
    expect(() => JSON.stringify(persisted)).not.toThrow();
  });

  it('does not persist timers that were cancelled (state exited)', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createLightMachine(), { clock }).start();
    actor.send({ type: 'STOP' });

    expect(getTimers(actor.getPersistedSnapshot())).toBeUndefined();
  });

  it('resumes timers based on elapsed time by default', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createLightMachine(), { clock }).start();
    const persisted: any = actor.getPersistedSnapshot();
    actor.stop();

    // pretend 400ms had elapsed before persisting
    persisted._pendingEffects[0].elapsed = 400;

    const clock2 = new SimulatedClock();
    const restored = createActor(createLightMachine(), {
      clock: clock2,
      snapshot: persisted
    }).start();

    clock2.increment(599);
    expect(restored.getSnapshot().value).toBe('green');
    clock2.increment(1); // 600ms = 1000 - 400 elapsed
    expect(restored.getSnapshot().value).toBe('yellow');
  });

  it('restarts timers with their full delay with `timers: "restart"`', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createLightMachine(), { clock }).start();
    const persisted: any = actor.getPersistedSnapshot();
    actor.stop();

    persisted._pendingEffects[0].elapsed = 400;

    const clock2 = new SimulatedClock();
    const restored = createActor(createLightMachine(), {
      clock: clock2,
      snapshot: persisted,
      timers: 'restart'
    }).start();

    clock2.increment(999);
    expect(restored.getSnapshot().value).toBe('green');
    clock2.increment(1); // full 1000ms again
    expect(restored.getSnapshot().value).toBe('yellow');
  });

  it('fires an already-expired timer immediately with `timers: "absolute"`', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createLightMachine(), { clock }).start();
    const persisted: any = actor.getPersistedSnapshot();
    actor.stop();

    // expiry (startedAt + delay) is in the past
    persisted._pendingEffects[0].startedAt = Date.now() - 5000;

    const clock2 = new SimulatedClock();
    const restored = createActor(createLightMachine(), {
      clock: clock2,
      snapshot: persisted,
      timers: 'absolute'
    }).start();

    clock2.increment(0);
    expect(restored.getSnapshot().value).toBe('yellow');
  });

  it('honors the original wall-clock expiry with `timers: "absolute"`', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createLightMachine(), { clock }).start();
    const persisted: any = actor.getPersistedSnapshot();
    actor.stop();

    // 300ms of the 1000ms delay had passed; ~700ms remain
    persisted._pendingEffects[0].startedAt = Date.now() - 300;

    const clock2 = new SimulatedClock();
    const restored = createActor(createLightMachine(), {
      clock: clock2,
      snapshot: persisted,
      timers: 'absolute'
    }).start();

    clock2.increment(600);
    expect(restored.getSnapshot().value).toBe('green');
    clock2.increment(200);
    expect(restored.getSnapshot().value).toBe('yellow');
  });

  it('supports a custom restore strategy function', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createLightMachine(), { clock }).start();
    const persisted: any = actor.getPersistedSnapshot();
    actor.stop();

    const strategy = vi.fn((timer: PendingEffect) => {
      expect(timer.delay).toBe(1000);
      return 50;
    });

    const clock2 = new SimulatedClock();
    const restored = createActor(createLightMachine(), {
      clock: clock2,
      snapshot: persisted,
      timers: strategy
    }).start();

    expect(strategy).toHaveBeenCalledTimes(1);
    clock2.increment(49);
    expect(restored.getSnapshot().value).toBe('green');
    clock2.increment(1);
    expect(restored.getSnapshot().value).toBe('yellow');
  });

  it('restored timers are cancelled when their state is exited', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createLightMachine(), { clock }).start();
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const clock2 = new SimulatedClock();
    const restored = createActor(createLightMachine(), {
      clock: clock2,
      snapshot: persisted
    }).start();

    restored.send({ type: 'STOP' });
    clock2.increment(2000);
    expect(restored.getSnapshot().value).toBe('red');
  });

  it('round-trips timers through a restored-but-never-started actor', () => {
    const clock = new SimulatedClock();
    const actor = createActor(createLightMachine(), { clock }).start();
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    // restore without starting, then persist again
    const idle = createActor(createLightMachine(), { snapshot: persisted });
    const rePersisted = idle.getPersistedSnapshot();

    expect(getTimers(rePersisted)).toHaveLength(1);
    expect(getTimers(rePersisted)[0].delay).toBe(1000);
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

    const clock = new SimulatedClock();
    const actor = createActor(parent, { clock }).start();
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    // child's pending timer is persisted inside its child snapshot
    const [childEntry] = Object.values((persisted as any).children) as any[];
    expect(getTimers(childEntry.snapshot)).toHaveLength(1);

    const clock2 = new SimulatedClock();
    const restored = createActor(parent, {
      clock: clock2,
      snapshot: persisted
    }).start();

    expect(restored.getSnapshot().value).toBe('working');
    clock2.increment(1000);
    expect(restored.getSnapshot().value).toBe('finished');
  });
});
