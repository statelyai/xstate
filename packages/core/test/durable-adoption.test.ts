import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAsyncLogic,
  createCallbackLogic,
  createMachine,
  createActor,
  setup,
  serializeMachine,
  type AnyActorLogic,
  type AnyStateMachine,
  type Snapshot
} from '../src/index.ts';
import { createMachineFromConfig } from '../src/createMachineFromConfig.ts';
import {
  createDurable,
  type DurableExecutionAdapter
} from '../src/durable/index.ts';

function host(overrides: Partial<DurableExecutionAdapter<AnyActorLogic>> = {}) {
  return {
    executeAction: vi.fn(),
    waitForEvent: vi.fn(() => ({ type: 'CONTINUE' })),
    scheduleTimer: vi.fn(),
    ...overrides
  };
}

function persisted(machine: AnyStateMachine, snapshot: Snapshot<unknown>) {
  return JSON.parse(JSON.stringify(machine.getPersistedSnapshot(snapshot)));
}

afterEach(() => vi.useRealTimers());

describe('durable scheduling checkpoints', () => {
  const machine = createMachine({
    initial: 'waiting',
    states: {
      waiting: {
        after: { 1000: { target: 'expired' } },
        on: { CONTINUE: {}, RESET: { target: 'waiting', reenter: true } }
      },
      expired: { type: 'final' }
    }
  });

  it.each([false, true])(
    'persists accepted deadlines (per-effect runtime: %s)',
    async (perEffect) => {
      let time = 10_000;
      const scheduleTimer = vi.fn();
      const execution = createDurable(
        machine,
        host({
          now: () => time,
          ...(perEffect
            ? { runtime: () => ({ scheduleTimer }) }
            : { scheduleTimer })
        })
      );
      const [snapshot, effects] = execution.initialTransition();
      expect(
        Object.values(persisted(machine, snapshot).timers)[0]
      ).not.toHaveProperty('startedAt');
      await execution.executeEffects(effects);
      const saved = persisted(machine, snapshot);
      expect(Object.values(saved.timers)[0]).toHaveProperty(
        'startedAt',
        10_000
      );
      expect(Object.values(snapshot.timers)[0]).not.toHaveProperty('startedAt');

      time += 300;
      const resumedHost = host({ now: () => time });
      const resumed = createDurable(machine, resumedHost);
      const [restored, restoration] = resumed.restore(saved);
      await resumed.executeEffects(restoration);
      expect(resumedHost.scheduleTimer).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        700
      );
      const [unchanged] = resumed.transition(restored, { type: 'CONTINUE' });
      expect(
        Object.values(persisted(machine, unchanged).timers)[0]
      ).toHaveProperty('startedAt', 10_000);

      time += 300;
      const againHost = host({ now: () => time });
      const again = createDurable(machine, againHost);
      const [, againEffects] = again.restore(persisted(machine, unchanged));
      await again.executeEffects(againEffects);
      expect(againHost.scheduleTimer).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        400
      );
    }
  );

  it.each([false, true])(
    'records asynchronous timer acceptance (per-effect runtime: %s)',
    async (perEffect) => {
      let time = 1000;
      const scheduleTimer = vi.fn(async () => {
        await Promise.resolve();
        time += 500;
      });
      const execution = createDurable(
        machine,
        host({
          now: () => time,
          ...(perEffect
            ? { runtime: () => ({ scheduleTimer }) }
            : { scheduleTimer })
        })
      );
      const [snapshot, effects] = execution.initialTransition();
      await execution.executeEffects(effects);
      const saved = persisted(machine, snapshot);
      expect(Object.values(saved.timers)[0]).toHaveProperty('startedAt', 1500);

      time = 1600;
      const resumedHost = host({ now: () => time });
      const resumed = createDurable(machine, resumedHost);
      const [restored, restoration] = resumed.restore(saved);
      await resumed.executeEffects(restoration);
      expect(resumedHost.scheduleTimer).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        900
      );
      expect(
        Object.values(persisted(machine, restored).timers)[0]
      ).toHaveProperty('startedAt', 1500);

      await execution.executeEffects(effects);
      expect(scheduleTimer).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.any(String),
        900
      );
      expect(
        Object.values(persisted(machine, snapshot).timers)[0]
      ).toHaveProperty('startedAt', 1500);
    }
  );

  it('preserves elapsed wall-clock time without an adapter clock', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const execution = createDurable(machine, host());
    const [snapshot, effects] = execution.initialTransition();
    await execution.executeEffects(effects);
    const saved = persisted(machine, snapshot);
    vi.setSystemTime(1300);
    const resumedHost = host();
    const resumed = createDurable(machine, resumedHost);
    const [, restoration] = resumed.restore(saved);
    await resumed.executeEffects(restoration);
    expect(resumedHost.scheduleTimer).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      700
    );
  });

  it('preserves an accepted deadline when effects are retried', async () => {
    let time = 1000;
    const scheduleTimer = vi.fn();
    const execution = createDurable(
      machine,
      host({ now: () => time, scheduleTimer })
    );
    const [snapshot, effects] = execution.initialTransition();
    await execution.executeEffects(effects);
    time += 300;
    await execution.executeEffects(effects);
    expect(scheduleTimer).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.any(String),
      700
    );
    expect(
      Object.values(persisted(machine, snapshot).timers)[0]
    ).toHaveProperty('startedAt', 1000);
  });

  it('starts a new deadline when a state reenters', async () => {
    let time = 1000;
    const execution = createDurable(
      machine,
      host({ now: () => time, cancelTimer: vi.fn() })
    );
    const [snapshot, effects] = execution.initialTransition();
    await execution.executeEffects(effects);
    time += 300;
    const [reentered, nextEffects] = execution.transition(snapshot, {
      type: 'RESET'
    });
    await execution.executeEffects(nextEffects);
    expect(
      Object.values(persisted(machine, reentered).timers)[0]
    ).toHaveProperty('startedAt', 1300);
    expect(
      Object.values(persisted(machine, snapshot).timers)[0]
    ).toHaveProperty('startedAt', 1000);
  });

  it('records a start only after scheduling succeeds', async () => {
    const failure = new Error('scheduler unavailable');
    const execution = createDurable(
      machine,
      host({ scheduleTimer: () => Promise.reject(failure) })
    );
    const [snapshot, effects] = execution.initialTransition();
    await expect(execution.executeEffects(effects)).rejects.toBe(failure);
    expect(
      Object.values(persisted(machine, snapshot).timers)[0]
    ).not.toHaveProperty('startedAt');
  });

  it('does not read the host clock during pure transitions', () => {
    const now = vi.fn(() => 1234);
    const execution = createDurable(machine, host({ now }));
    const [snapshot] = execution.initialTransition();
    execution.transition(snapshot, { type: 'CONTINUE' });
    expect(now).not.toHaveBeenCalled();
  });

  it('stamps timers scheduled by live descendants', async () => {
    const child = createMachine({
      initial: 'w',
      states: {
        w: { after: { 1000: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const parent = setup({ actors: { child } }).createMachine({
      initial: 'w',
      states: { w: { invoke: { src: 'child', id: 'worker' } } }
    });
    const execution = createDurable(
      parent,
      host({
        now: () => 5000,
        startActor: (actor) => {
          actor.start();
        }
      })
    );
    const [snapshot, effects] = execution.initialTransition();
    await execution.executeEffects(effects);
    const saved = persisted(parent, snapshot);
    expect(
      Object.values(saved.children.worker.snapshot.timers)[0]
    ).toHaveProperty('startedAt', 5000);
    execution.getActorRef(snapshot)?.system.stopActor(snapshot.children.worker);
  });
});

describe('durable root errors', () => {
  it('returns a child rejection without scheduling an unhandled root throw', async () => {
    vi.useFakeTimers();
    const failure = new Error('boom');
    const machine = setup({
      actors: {
        boom: createAsyncLogic({
          run: async () => {
            throw failure;
          }
        })
      }
    }).createMachine({
      initial: 'waiting',
      states: { waiting: { invoke: { src: 'boom' } } }
    });
    const execution = createDurable(
      machine,
      host({
        startActor: (actor) => {
          actor.start();
        }
      })
    );
    const [snapshot, effects] = execution.initialTransition();
    await execution.executeEffects(effects);
    const event = await execution.waitForEvent();
    expect(event.type).toBe('xstate.error.actor');
    const [errored, termination] = execution.transition(snapshot, event);
    expect(errored.status).toBe('error');
    expect(errored.error).toBe(failure);
    await execution.executeEffects(termination);
    expect(() => vi.runAllTimers()).not.toThrow();
  });

  it('run rejects with the error once', async () => {
    vi.useFakeTimers();
    const failure = new Error('boom');
    const machine = createMachine({
      on: {
        FAIL: () => {
          throw failure;
        }
      }
    });
    const execution = createDurable(
      machine,
      host({ waitForEvent: () => ({ type: 'FAIL' }) })
    );
    await expect(execution.run()).rejects.toBe(failure);
    expect(() => vi.runAllTimers()).not.toThrow();
  });
});

describe('deserialized actor source rebinding', () => {
  it('uses provided sources for initialization and checkpoint restoration', async () => {
    const original = vi.fn();
    const replacement = vi.fn();
    const json = {
      initial: 'w',
      states: { w: { invoke: { src: 'worker', id: 'job' } } }
    };
    const machine = createMachineFromConfig(json, {
      actors: { worker: createCallbackLogic(original) }
    });
    const provided = machine.provide({
      actors: { worker: createCallbackLogic(replacement) }
    });
    const actor = createActor(provided).start();
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(actor.getSnapshot().children.job.src).toBe('worker');
    expect(original).not.toHaveBeenCalled();
    const saved = actor.getPersistedSnapshot();
    actor.stop();
    const restored = createActor(provided, { snapshot: saved }).start();
    expect(replacement).toHaveBeenCalledTimes(2);
    expect(serializeMachine(provided)).toEqual(json);
    restored.stop();
  });

  it('still rejects a missing actor implementation', () => {
    expect(() =>
      createMachineFromConfig({ invoke: { src: 'missing' } })
    ).toThrow('Missing actor source "missing"');
  });
});
