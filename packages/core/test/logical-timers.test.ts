import { describe, expect, it, vi } from 'vitest';
import {
  createCallbackLogic,
  createActor,
  createMachine,
  getMicrosteps,
  initialTransition,
  isBuiltInExecutableEffect,
  transition,
  SimulatedClock,
  type ActorSystemRuntime
} from '../src/index.ts';

describe('logical snapshot timers', () => {
  it('declares a pending timer in the pure initial snapshot', async () => {
    const machine = createMachine({
      initial: 'red',
      states: {
        red: { after: { 100: { target: 'green' } } },
        green: {}
      }
    });

    const [snapshot, effects] = initialTransition(machine);
    const schedule = effects.find(
      (effect) =>
        isBuiltInExecutableEffect(effect) && effect.type === '@xstate.raise'
    )!;
    const [timer] = snapshot.timers;

    // Built-in timers have no id; their event identifies them.
    expect(schedule.id).toBeUndefined();
    expect(timer).toEqual({
      delay: 100,
      type: '@xstate.raise',
      event: { type: 'xstate.after', delay: 100, stateId: 'red' },
      target: 'self'
    });
    expect(schedule.event).toEqual(timer.event);
    expect(timer).not.toHaveProperty('scheduledAt');
    expect(timer).not.toHaveProperty('dueAt');
    expect(timer).not.toHaveProperty('elapsed');

    const scheduleTimer = vi.fn<ActorSystemRuntime['scheduleTimer']>();
    await schedule.exec({ scheduleTimer });

    expect(scheduleTimer).toHaveBeenCalledWith(
      schedule.source,
      { event: timer.event },
      100
    );
  });

  it('keeps wall-clock bookkeeping in the runtime', () => {
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 100: { target: 'done' } } },
        done: {}
      }
    });
    const actor = createActor(machine, {
      clock: new SimulatedClock()
    }).start();
    const [timer] = Object.values(actor.system.getSnapshot()._scheduledTimers);

    expect(timer).toMatchObject({
      key: {
        event: {
          type: 'xstate.after',
          delay: 100,
          stateId: 'waiting'
        }
      },
      delay: 100,
      scheduledAt: expect.any(Number),
      dueAt: expect.any(Number)
    });
    expect(actor.getSnapshot().timers[0]).not.toHaveProperty('scheduledAt');
    expect(actor.getSnapshot().timers[0]).not.toHaveProperty('dueAt');
  });

  it('consumes a delayed raise in the same macrostep', () => {
    const machine = createMachine({
      initial: 'red',
      states: {
        red: { after: { 100: { target: 'green' } } },
        green: {}
      }
    });
    const [red] = initialTransition(machine);
    const event = {
      type: 'xstate.after',
      delay: 100,
      stateId: 'red'
    };

    const [timerConsumed, effects] = transition(machine, red, {
      type: 'xstate.timer',
      event
    } as any);

    expect(timerConsumed.value).toBe('green');
    expect(timerConsumed.timers).toEqual([]);
    expect(effects).toEqual([
      expect.objectContaining({
        type: '@xstate.cancel',
        event
      })
    ]);
    expect(effects[0]).not.toHaveProperty('id');
  });

  it('removes cancelled timers and ignores stale timer inputs', () => {
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          after: { 100: { target: 'late' } },
          on: { EXIT: { target: 'done' } }
        },
        late: {},
        done: {}
      }
    });
    const [waiting] = initialTransition(machine);
    const [{ event }] = waiting.timers;

    const [done, exitEffects] = transition(machine, waiting, { type: 'EXIT' });
    expect(done.timers).toEqual([]);
    expect(exitEffects.map((effect) => effect.type)).toEqual([
      '@xstate.cancel'
    ]);

    const [unchanged, staleEffects] = transition(machine, done, {
      type: 'xstate.timer',
      event
    } as any);
    expect(unchanged).toBe(done);
    expect(staleEffects).toEqual([]);
  });

  it('uses the same timer mechanism for delayed sends to children', () => {
    const childLogic = createCallbackLogic(() => {});
    const machine = createMachine({
      actors: { childLogic },
      invoke: { id: 'child', src: 'childLogic' },
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
    const [active] = initialTransition(machine);

    const [scheduled, scheduleEffects] = transition(machine, active, {
      type: 'SCHEDULE'
    });
    expect(scheduled.timers).toEqual([
      {
        id: 'ping',
        delay: 100,
        type: '@xstate.sendTo',
        event: { type: 'PING' },
        target: active.children.child
      }
    ]);
    expect(scheduleEffects).toEqual([
      expect.objectContaining({
        type: '@xstate.sendTo',
        id: 'ping',
        delay: 100
      })
    ]);

    const [consumed, deliveryEffects] = transition(machine, scheduled, {
      type: 'xstate.timer',
      id: 'ping'
    } as any);
    expect(consumed.timers).toEqual([]);
    expect(deliveryEffects).toEqual([
      expect.objectContaining({
        type: '@xstate.sendTo',
        id: undefined,
        delay: undefined,
        target: active.children.child,
        event: { type: 'PING' }
      })
    ]);
  });

  it('numbers anonymous delayed effects deterministically', () => {
    const machine = createMachine({
      on: {
        SCHEDULE: (_, enq) => {
          enq.raise({ type: 'FIRST' }, { delay: 10 });
          enq.raise({ type: 'SECOND' }, { delay: 20 });
        }
      }
    });
    const [initial] = initialTransition(machine);

    const [left, leftEffects] = transition(machine, initial, {
      type: 'SCHEDULE'
    });
    const [right, rightEffects] = transition(machine, initial, {
      type: 'SCHEDULE'
    });

    expect(left.timers).toEqual([
      expect.objectContaining({ seq: 0, event: { type: 'FIRST' } }),
      expect.objectContaining({ seq: 1, event: { type: 'SECOND' } })
    ]);
    expect(left.timers.some((timer) => 'id' in timer)).toBe(false);
    expect(right.timers).toEqual(left.timers);
    expect(leftEffects.map((effect) => (effect as any).seq)).toEqual([0, 1]);
    expect(rightEffects.map((effect) => (effect as any).seq)).toEqual([0, 1]);

    const [fired] = transition(machine, left, {
      type: 'xstate.timer',
      seq: 1
    } as any);
    expect(fired.timers).toEqual([left.timers[0]]);
  });

  it('exposes timer consumption as its own microstep', () => {
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 10: { target: 'done' } } },
        done: {}
      }
    });
    const [waiting] = initialTransition(machine);
    const [{ event }] = waiting.timers;

    const microsteps = getMicrosteps(machine, waiting, {
      type: 'xstate.timer',
      event
    } as any);

    expect(microsteps).toHaveLength(2);
    expect(microsteps[0][0].timers).toEqual([]);
    expect(microsteps[0][1]).toEqual([]);
    expect(microsteps[1][0].value).toBe('done');
    expect(microsteps[1][1]).toEqual([
      expect.objectContaining({ type: '@xstate.cancel', event })
    ]);
  });

  it('cancels remaining timers after child stops when reaching final', () => {
    const child = createCallbackLogic(() => {});
    const machine = createMachine({
      actors: { child },
      initial: 'active',
      states: {
        active: {
          invoke: { id: 'child', src: 'child' },
          on: {
            FINISH: (_, enq) => {
              enq.raise({ type: 'LATE' }, { id: 'late', delay: 100 });
              return { target: 'done' };
            }
          }
        },
        done: { type: 'final' }
      }
    });
    const [active] = initialTransition(machine);

    const [done, effects] = transition(machine, active, { type: 'FINISH' });

    expect(done.status).toBe('done');
    expect(done.children).toEqual({});
    expect(done.timers).toEqual([]);
    expect(effects.map(({ type }) => type)).toEqual([
      '@xstate.stop',
      '@xstate.raise',
      '@xstate.cancel',
      '@xstate.terminate'
    ]);
  });

  it('cancels remaining timers after child stops when explicitly stopped', () => {
    const child = createCallbackLogic(() => {});
    const machine = createMachine({
      actors: { child },
      invoke: { id: 'child', src: 'child' },
      on: {
        SCHEDULE: (_, enq) =>
          enq.raise({ type: 'LATE' }, { id: 'late', delay: 100 })
      }
    });
    const [active] = initialTransition(machine);
    const [scheduled] = transition(machine, active, { type: 'SCHEDULE' });

    const [stopped, effects] = transition(machine, scheduled, {
      type: 'xstate.stop'
    } as any);

    expect(stopped.status).toBe('stopped');
    expect(stopped.children).toEqual({});
    expect(stopped.timers).toEqual([]);
    expect(effects.map(({ type }) => type)).toEqual([
      '@xstate.stop',
      '@xstate.cancel'
    ]);
  });
});
