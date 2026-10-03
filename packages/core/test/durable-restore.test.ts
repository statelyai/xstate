import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAsyncLogic,
  createMachine,
  setup,
  stopActor,
  type AnyActor,
  type AnyActorLogic,
  type Snapshot
} from '../src/index.ts';
import {
  createDurable,
  type DurableExecutionAdapter
} from '../src/durable/index.ts';

function adapter(
  overrides: Partial<DurableExecutionAdapter<AnyActorLogic>> = {}
) {
  return {
    executeAction: vi.fn(),
    enqueueRootEvent: vi.fn(),
    waitForEvent: vi.fn(() => ({ type: 'CONTINUE' })),
    ...overrides
  };
}

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

afterEach(() => vi.useRealTimers());

describe('durable checkpoint restoration', () => {
  it('does not reuse a journaled event-wait ID when restoring without a saved index', async () => {
    const machine = createMachine({ on: { CONTINUE: {} } });
    const fresh = createDurable(machine, adapter());
    const [initial] = fresh.initialTransition();
    const host = adapter();
    const resumed = createDurable(machine, host);
    const [snapshot, effects] = resumed.restore(
      machine.getPersistedSnapshot(initial)
    );
    await resumed.executeEffects(effects);
    const event = await resumed.waitForEvent();
    resumed.transition(snapshot, event);
    await resumed.waitForEvent();
    expect(host.waitForEvent).toHaveBeenNthCalledWith(1, {
      id: 'event:restore:0',
      transitionIndex: 0
    });
    expect(host.waitForEvent).toHaveBeenNthCalledWith(2, {
      id: 'event:0',
      transitionIndex: 0
    });
  });
  it('restores without a machine event, entry actions, or a consumed transition index', async () => {
    const entry = vi.fn();
    const check = vi.fn();
    const machine = setup({ validator: { check } }).createMachine({
      id: 'workflow',
      initial: 'waiting',
      states: {
        waiting: {
          entry: (_, enq) => enq(entry),
          on: { '*': { target: 'done' } }
        },
        done: { type: 'final', entry: (_, enq) => enq(entry) }
      }
    });
    const fresh = createDurable(machine, adapter());
    const [initial] = fresh.initialTransition();
    const persisted = roundTrip(machine.getPersistedSnapshot(initial));
    check.mockClear();
    const host = adapter({ transitionIndex: 7 });
    const execution = createDurable(machine, host);

    const [snapshot, effects] = execution.restore(persisted);
    expect(snapshot.value).toBe('waiting');
    expect(effects).toEqual([]);
    expect(entry).not.toHaveBeenCalled();
    expect(check.mock.calls.some(([request]) => request.kind === 'event')).toBe(
      false
    );
    expect(execution.getActorRef(snapshot)?.address).toBe('workflow');
    expect(execution.nextTransitionIndex).toBe(7);
    await execution.executeEffects(effects);
    expect(await execution.waitForEvent()).toEqual({ type: 'CONTINUE' });
    expect(host.waitForEvent).toHaveBeenCalledWith({
      id: 'event:6',
      transitionIndex: 6
    });

    const [done, nextEffects] = execution.transition(snapshot, {
      type: 'CONTINUE'
    });
    expect(done.status).toBe('done');
    expect(nextEffects[0].id).toBe('7:0');
  });

  it('restarts a pending request only when its restoration effects execute', async () => {
    const run = vi.fn(async () => 'answer');
    const worker = createAsyncLogic({ run });
    const machine = createMachine({
      id: 'request',
      actors: { worker },
      initial: 'working',
      states: {
        working: {
          invoke: { id: 'worker', src: 'worker', onDone: { target: 'done' } }
        },
        done: { type: 'final' }
      }
    });
    const fresh = createDurable(machine, adapter());
    const [initial] = fresh.initialTransition();
    const execution = createDurable(machine, adapter());
    const [snapshot, effects] = execution.restore(
      roundTrip(machine.getPersistedSnapshot(initial))
    );

    expect(run).not.toHaveBeenCalled();
    expect(effects.map(({ id }) => id)).toEqual(['restore:0:0']);
    expect(effects[0].descriptor).toMatchObject({
      type: '@xstate.start',
      actor: 'request/worker'
    });
    await execution.executeEffects(effects);
    expect(run).toHaveBeenCalledOnce();
    const event = await execution.waitForEvent();
    expect(event).toMatchObject({
      type: 'xstate.done.actor',
      actorId: 'worker'
    });
    expect(execution.transition(snapshot, event)[0].status).toBe('done');
  });

  it('routes restored descendants and their timers through the adapter and cleans them up on stop', async () => {
    const leaf = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 100: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const child = createMachine({
      actors: { leaf },
      invoke: { id: 'leaf', src: 'leaf' }
    });
    const machine = createMachine({
      id: 'tree',
      actors: { child },
      invoke: { id: 'child', src: 'child' }
    });
    const fresh = createDurable(machine, adapter());
    const [initial] = fresh.initialTransition();
    const startActor = vi.fn((actor: AnyActor) => {
      actor.start();
    });
    const scheduleTimer = vi.fn();
    const cancelAllTimers = vi.fn();
    const execution = createDurable(
      machine,
      adapter({ startActor, scheduleTimer, cancelAllTimers })
    );
    const [snapshot, effects] = execution.restore(
      roundTrip(machine.getPersistedSnapshot(initial))
    );

    expect(startActor).not.toHaveBeenCalled();
    await execution.executeEffects(effects);
    expect(startActor.mock.calls.map(([actor]) => actor.address)).toEqual([
      'tree/child',
      'tree/child/leaf'
    ]);
    const leafRef = execution.getActorRef(snapshot, 'tree/child/leaf')!;
    expect(scheduleTimer).toHaveBeenCalledWith(
      leafRef,
      expect.any(String),
      100
    );
    await execution
      .getActorRef(snapshot, 'tree/child')!
      .system.stopActor(snapshot.children.child);
    expect(
      cancelAllTimers.mock.calls.map(([actor]) => actor.address)
    ).toContain('tree/child/leaf');
    expect(leafRef.getSnapshot().status).toBe('stopped');
  });

  it('restores root raises and delayed sends with stable IDs and current targets', async () => {
    const worker = createMachine({ on: { PING: {} } });
    const machine = createMachine({
      id: 'timers',
      actors: { worker },
      invoke: { id: 'worker', src: 'worker' },
      entry: ({ children }, enq) => {
        enq.sendTo(
          children.worker,
          { type: 'PING' },
          { id: 'ping', delay: 200 }
        );
      },
      initial: 'waiting',
      states: { waiting: { after: { 100: { target: 'done' } } }, done: {} }
    });
    const fresh = createDurable(machine, adapter());
    const [initial] = fresh.initialTransition();
    const persisted = roundTrip(machine.getPersistedSnapshot(initial));
    const scheduleTimer = vi.fn();
    const execution = createDurable(
      machine,
      adapter({ transitionIndex: 12, scheduleTimer })
    );
    const [snapshot, effects] = execution.restore(persisted);
    expect(scheduleTimer).not.toHaveBeenCalled();
    const timerEffects = effects.filter(
      ({ descriptor }) => descriptor.type !== '@xstate.start'
    );
    expect(timerEffects.map(({ descriptor }) => descriptor)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: '@xstate.sendTo',
          target: 'timers/worker',
          id: 'ping',
          delay: 200
        }),
        expect.objectContaining({ type: '@xstate.raise', delay: 100 })
      ])
    );
    await execution.executeEffects(effects);
    expect(scheduleTimer).toHaveBeenCalledWith(
      execution.getActorRef(snapshot),
      'ping',
      200
    );
    expect(scheduleTimer).toHaveBeenCalledWith(
      execution.getActorRef(snapshot),
      expect.any(String),
      100
    );
    const retry = createDurable(machine, adapter({ transitionIndex: 12 }));
    expect(
      retry
        .restore(persisted)[1]
        .map(({ id, descriptor }) => ({ id, descriptor }))
    ).toEqual(effects.map(({ id, descriptor }) => ({ id, descriptor })));
    expect(execution.nextTransitionIndex).toBe(12);
    stopActor(snapshot.children.worker);
  });

  it.each([
    [900, 400],
    [0, 0],
    [2000, 500]
  ])(
    'honors a persisted wall-clock start %s (remaining %s)',
    async (startedAt, remaining) => {
      vi.useFakeTimers();
      vi.setSystemTime(1000);
      const machine = createMachine({
        initial: 'waiting',
        states: { waiting: { after: { 500: { target: 'done' } } }, done: {} }
      });
      const fresh = createDurable(machine, adapter());
      const [initial] = fresh.initialTransition();
      const persisted = roundTrip(
        machine.getPersistedSnapshot(initial)
      ) as Snapshot<unknown> & {
        timers: Record<string, { startedAt?: number }>;
      };
      Object.values(persisted.timers)[0].startedAt = startedAt;
      const scheduleTimer = vi.fn();
      const execution = createDurable(machine, adapter({ scheduleTimer }));
      const [, effects] = execution.restore(persisted);
      await execution.executeEffects(effects);
      expect(scheduleTimer).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        remaining
      );
    }
  );

  it.each([false, true])(
    'preserves root timer deadlines through delayed execution, startup and retry (per-effect runtime: %s)',
    async (perEffectRuntime) => {
      vi.useFakeTimers();
      vi.setSystemTime(900);
      const worker = createMachine({ on: { PING: {} } });
      const machine = createMachine({
        actors: { worker },
        invoke: { id: 'worker', src: 'worker' },
        entry: ({ children }, enq) => {
          enq.sendTo(
            children.worker,
            { type: 'PING' },
            { id: 'ping', delay: 2000 }
          );
          enq.sendTo(
            children.worker,
            { type: 'PING' },
            { id: 'pure', delay: 3000 }
          );
        },
        initial: 'waiting',
        states: { waiting: { after: { 1000: { target: 'done' } } }, done: {} }
      });
      const fresh = createDurable(machine, adapter());
      const [initial] = fresh.initialTransition();
      const persisted = roundTrip(
        machine.getPersistedSnapshot(initial)
      ) as Snapshot<unknown> & {
        timers: Record<string, { startedAt?: number }>;
      };
      Object.entries(persisted.timers).forEach(([id, timer]) => {
        if (id !== 'pure') timer.startedAt = 0;
      });
      const scheduleTimer = vi.fn();
      const startActor = vi.fn(async (actor: AnyActor) => {
        // Startup initiates another host operation without awaiting it. That
        // operation sits ahead of the root timer on the runtime's queue.
        void actor.system.sendEvent(actor, actor, { type: 'PING' });
        await Promise.resolve();
        vi.setSystemTime(975);
      });
      const runtime = {
        startActor,
        scheduleTimer,
        sendEvent: async () => {
          await Promise.resolve();
          vi.setSystemTime(1100);
        }
      };
      const execution = createDurable(
        machine,
        adapter({
          transitionIndex: 12,
          sendEvent: runtime.sendEvent,
          ...(perEffectRuntime ? { runtime: () => runtime } : runtime)
        })
      );
      const [snapshot, effects] = execution.restore(persisted);
      const ids = effects.map(({ id }) => id);
      const descriptors = effects.map(({ descriptor }) => descriptor);
      expect(Object.values(snapshot.timers).map(({ delay }) => delay)).toEqual([
        2000, 3000, 1000
      ]);
      vi.setSystemTime(950);
      await execution.executeEffects(effects);
      expect(scheduleTimer).toHaveBeenCalledTimes(3);
      expect(scheduleTimer.mock.calls.map(([, , delay]) => delay)).toEqual([
        900, 3000, 0
      ]);

      vi.setSystemTime(1200);
      await execution.executeEffects(
        effects.filter(({ effect }) => effect.type !== '@xstate.start')
      );
      expect(scheduleTimer.mock.calls.map(([, , delay]) => delay)).toEqual([
        900, 3000, 0, 800, 2900, 0
      ]);
      expect(effects.map(({ id }) => id)).toEqual(ids);
      expect(effects.map(({ descriptor }) => descriptor)).toEqual(descriptors);
      expect(execution.nextTransitionIndex).toBe(12);
      const retry = createDurable(machine, adapter({ transitionIndex: 12 }));
      expect(
        retry
          .restore(persisted)[1]
          .map(({ id, descriptor }) => ({ id, descriptor }))
      ).toEqual(effects.map(({ id, descriptor }) => ({ id, descriptor })));
    }
  );

  it.each(['done', 'error', 'stopped'] as const)(
    'does not restart work in a terminal %s snapshot',
    (status) => {
      const worker = createAsyncLogic({ run: async () => 'done' });
      const machine = createMachine({
        actors: { worker },
        invoke: { id: 'worker', src: 'worker' }
      });
      const fresh = createDurable(machine, adapter());
      const [initial] = fresh.initialTransition();
      const persisted = roundTrip(machine.getPersistedSnapshot(initial));
      persisted.status = status;
      const execution = createDurable(machine, adapter());
      expect(execution.restore(persisted)[1]).toEqual([]);
    }
  );

  it('keeps address-only children remote and installs their routing without starting them', async () => {
    const worker = createMachine({});
    const machine = createMachine({
      id: 'remote',
      actors: { worker },
      invoke: { id: 'worker', src: 'worker' }
    });
    const fresh = createDurable(machine, adapter());
    const [initial] = fresh.initialTransition();
    const persisted = roundTrip(
      machine.getPersistedSnapshot(initial, { embedChildren: false })
    );
    const sendEvent = vi.fn();
    const execution = createDurable(machine, adapter({ sendEvent }));
    const [snapshot, effects] = execution.restore(persisted);
    expect(effects).toEqual([]);
    snapshot.children.worker.send({ type: 'PING' });
    expect(sendEvent).toHaveBeenCalledOnce();
    expect(sendEvent.mock.calls[0][1]).toBe(snapshot.children.worker);
    expect(sendEvent.mock.calls[0][2]).toEqual({ type: 'PING' });
  });

  it('propagates restoration errors without consuming a transition index', () => {
    const old = createMachine({
      id: 'versioned',
      version: '1',
      initial: 'waiting',
      states: { waiting: {} }
    });
    const fresh = createDurable(old, adapter());
    const [initial] = fresh.initialTransition();
    const machine = createMachine({
      id: 'versioned',
      version: '2',
      initial: 'waiting',
      states: { waiting: {} }
    });
    const execution = createDurable(machine, adapter({ transitionIndex: 3 }));
    expect(() => execution.restore(old.getPersistedSnapshot(initial))).toThrow(
      /version/
    );
    expect(execution.nextTransitionIndex).toBe(3);
  });

  it('does not restart a completed embedded child or a request on a retried batch', async () => {
    const run = vi.fn(async () => 'answer');
    const worker = createAsyncLogic({ run });
    const machine = createMachine({
      actors: { worker },
      invoke: { id: 'worker', src: 'worker' }
    });
    const fresh = createDurable(machine, adapter());
    const [initial] = fresh.initialTransition();
    const persisted = roundTrip(machine.getPersistedSnapshot(initial));
    const execution = createDurable(machine, adapter());
    const [, effects] = execution.restore(persisted);
    await execution.executeEffects(effects);
    await execution.executeEffects(effects);
    expect(run).toHaveBeenCalledOnce();

    const completed = roundTrip(persisted) as Snapshot<unknown> & {
      children: Record<string, { snapshot: Snapshot<unknown> }>;
    };
    completed.children.worker.snapshot = {
      status: 'done',
      output: 'answer',
      error: undefined
    };
    const restored = createDurable(machine, adapter());
    const [, completedEffects] = restored.restore(completed);
    expect(completedEffects).toEqual([]);
    await restored.executeEffects(completedEffects);
    expect(run).toHaveBeenCalledOnce();
  });

  it('cancels restored root timers on exit and ignores their stale firing inputs', async () => {
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          after: { 100: { target: 'expired' } },
          on: { CANCEL: { target: 'cancelled' } }
        },
        expired: {},
        cancelled: {}
      }
    });
    const fresh = createDurable(machine, adapter());
    const [initial] = fresh.initialTransition();
    const cancelTimer = vi.fn();
    const execution = createDurable(
      machine,
      adapter({ scheduleTimer: vi.fn(), cancelTimer })
    );
    const [snapshot, effects] = execution.restore(
      roundTrip(machine.getPersistedSnapshot(initial))
    );
    await execution.executeEffects(effects);
    const id = Object.keys(snapshot.timers)[0];
    const [cancelled, cancelEffects] = execution.transition(snapshot, {
      type: 'CANCEL'
    });
    await execution.executeEffects(cancelEffects);
    expect(cancelTimer.mock.calls[0][1]).toBe(id);
    expect(cancelled.timers).toEqual({});
    const staleFiring = { type: 'xstate.timer', id };
    expect(execution.transition(cancelled, staleFiring)[0].value).toBe(
      'cancelled'
    );
  });

  it('keeps a host-owned deadline when a pure checkpoint re-arms the same logical timer', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const deadlines = new Map<string, number>();
    const host = adapter({
      scheduleTimer: (source, id, delay) => {
        const key = `${source.address}:${id}`;
        if (!deadlines.has(key)) deadlines.set(key, Date.now() + delay);
      }
    });
    const machine = createMachine({
      id: 'deadline',
      initial: 'waiting',
      states: { waiting: { after: { 1000: { target: 'done' } } }, done: {} }
    });
    const fresh = createDurable(machine, host);
    const [initial, initialEffects] = fresh.initialTransition();
    await fresh.executeEffects(initialEffects);
    const checkpoint = roundTrip(machine.getPersistedSnapshot(initial));
    vi.setSystemTime(300);
    const resumed = createDurable(machine, {
      ...host,
      transitionIndex: fresh.nextTransitionIndex
    });
    const [, effects] = resumed.restore(checkpoint);
    await resumed.executeEffects(effects);
    expect([...deadlines.values()]).toEqual([1000]);
  });

  it('requires a fresh execution and keeps run() from initializing a restored checkpoint', async () => {
    const machine = createMachine({});
    const fresh = createDurable(machine, adapter());
    const [initial] = fresh.initialTransition();
    const checkpoint = machine.getPersistedSnapshot(initial);
    expect(() => fresh.restore(checkpoint)).toThrow(/fresh/);
    const resumed = createDurable(machine, adapter());
    resumed.restore(checkpoint);
    expect(() => resumed.restore(checkpoint)).toThrow(/fresh/);
    expect(() => resumed.initialTransition()).toThrow(/restored/);
    await expect(resumed.run()).rejects.toThrow(/fresh/);
    expect(resumed.nextTransitionIndex).toBe(0);
  });
});
