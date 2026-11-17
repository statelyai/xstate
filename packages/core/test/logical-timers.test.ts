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
import { restoreActor } from '../src/persist/index.ts';

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

  it.each(['outside', 'event-dependent'])(
    'takes an after transition before reevaluating an %s always guard',
    (guard) => {
      let ready = false;
      const machine = createMachine({
        initial: 'waiting',
        states: {
          waiting: {
            always: ({ event }) =>
              (guard === 'outside' ? ready : event.type !== 'xstate.init')
                ? { target: 'early' }
                : undefined,
            after: { 10: { target: 'elapsed' } }
          },
          early: {},
          elapsed: {}
        }
      });
      const clock = new SimulatedClock();
      const actor = createActor(machine, { clock }).start();

      try {
        expect(actor.getSnapshot().value).toBe('waiting');
        ready = true;
        clock.increment(9);
        expect(actor.getSnapshot().value).toBe('waiting');
        clock.increment(1);
        expect(actor.getSnapshot().value).toBe('elapsed');
      } finally {
        actor.stop();
      }
    }
  );

  it.each(['raise', 'sendTo'])(
    'handles a delayed %s before always and settles before raised events',
    (delivery) => {
      let ready = false;
      const machine = createMachine({
        initial: 'waiting',
        states: {
          waiting: {
            entry: ({ self }, enq) => {
              if (delivery === 'raise') {
                enq.raise({ type: 'EXPIRE' }, { delay: 10 });
              } else {
                enq.sendTo(self, { type: 'EXPIRE' }, { delay: 10 });
              }
            },
            always: () => (ready ? { target: 'early' } : undefined),
            on: { EXPIRE: { target: 'elapsed' } }
          },
          early: {},
          elapsed: {
            entry: (_, enq) => {
              enq.raise({ type: 'INTERNAL' });
            },
            always: ({ event }) =>
              event.type === 'EXPIRE' ? { target: 'settled' } : undefined,
            on: { INTERNAL: { target: 'early' } }
          },
          settled: {}
        }
      });
      const clock = new SimulatedClock();
      const actor = createActor(machine, { clock }).start();

      try {
        ready = true;
        clock.increment(10);
        expect(actor.getSnapshot().value).toBe('settled');
      } finally {
        actor.stop();
      }
    }
  );

  it('handles a state timeout before reevaluating always', () => {
    let ready = false;
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          always: () => (ready ? { target: 'early' } : undefined),
          timeout: 10,
          onTimeout: { target: 'elapsed' }
        },
        early: {},
        elapsed: {}
      }
    });
    const clock = new SimulatedClock();
    const actor = createActor(machine, { clock }).start();

    try {
      ready = true;
      clock.increment(10);
      expect(actor.getSnapshot().value).toBe('elapsed');
    } finally {
      actor.stop();
    }
  });

  it('reevaluates always after an unhandled delayed raise', () => {
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          entry: (_, enq) => {
            enq.raise({ type: 'IGNORED' }, { delay: 10 });
          },
          always: ({ event }) =>
            event.type === 'IGNORED' ? { target: 'settled' } : undefined
        },
        settled: {}
      }
    });
    const clock = new SimulatedClock();
    const actor = createActor(machine, { clock }).start();

    try {
      clock.increment(10);
      expect(actor.getSnapshot().value).toBe('settled');
    } finally {
      actor.stop();
    }
  });

  it('does not reevaluate the sender always transitions for a delayed send to a child', () => {
    let ready = false;
    const received = vi.fn();
    const child = createCallbackLogic(({ receive }) => {
      receive(received);
    });
    const machine = createMachine({
      actors: { child },
      invoke: { id: 'child', src: 'child' },
      initial: 'waiting',
      states: {
        waiting: {
          entry: ({ children }, enq) => {
            enq.sendTo(children.child, { type: 'PING' }, { delay: 10 });
          },
          always: () => (ready ? { target: 'early' } : undefined)
        },
        early: {}
      }
    });
    const clock = new SimulatedClock();
    const actor = createActor(machine, { clock }).start();

    try {
      ready = true;
      clock.increment(10);
      expect(actor.getSnapshot().value).toBe('waiting');
      expect(received).toHaveBeenCalledExactlyOnceWith({ type: 'PING' });
    } finally {
      actor.stop();
    }
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
        occurrence: 0,
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
    let ready = false;
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          always: () => (ready ? { target: 'early' } : undefined),
          after: { 10: { target: 'done' } }
        },
        early: {},
        done: {}
      }
    });
    const [waiting] = initialTransition(machine);
    const [{ event }] = waiting.timers;
    ready = true;

    const microsteps = getMicrosteps(machine, waiting, {
      type: 'xstate.timer',
      event
    } as any);

    expect(microsteps).toHaveLength(2);
    expect(microsteps[0][0].value).toBe('waiting');
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

  describe('stale timer notifications and replacement timers (#5919)', () => {
    function createStaleReproMachine(
      replacementId: string,
      fireWhileQueued: boolean
    ) {
      const clock = new SimulatedClock();
      let actor: any;
      const machine = createMachine({
        context: { expired: [] as string[] },
        on: {
          START: ({ event }: any, enq: any) => {
            enq.raise(
              { type: 'EXPIRE', label: event.label },
              { id: event.id, delay: 100 }
            );
          },
          CANCEL: (_: any, enq: any) => enq.cancel('shared'),
          EXPIRE: ({ context, event }: any) => ({
            context: { expired: [...context.expired, event.label] }
          }),
          REPLACE: (_: any, enq: any) =>
            enq(() => {
              // A running action keeps the actor's mailbox busy. The real native
              // scheduler callback queues its notification behind these two sends.
              actor.send({ type: 'CANCEL' });
              actor.send({
                type: 'START',
                id: replacementId,
                label: 'replacement'
              });
              if (fireWhileQueued) clock.increment(100);
            })
        }
      } as any);
      actor = createActor(machine, { clock }).start();
      return { actor, clock };
    }

    it('cancelling before firing permits reuse of the id', () => {
      const { actor, clock } = createStaleReproMachine('shared', false);
      actor.send({ type: 'START', id: 'shared', label: 'original' } as any);
      actor.send({ type: 'REPLACE' });
      const beforeDeadline = [...actor.getSnapshot().context.expired];
      expect(beforeDeadline).toEqual([]);
      clock.increment(99);
      expect(actor.getSnapshot().context.expired).toEqual([]);
      clock.increment(1);
      expect(actor.getSnapshot().context.expired).toEqual(['replacement']);
      actor.stop();
    });

    it('a queued notification cannot fire a replacement with a different id', () => {
      const { actor, clock } = createStaleReproMachine('different', true);
      actor.send({ type: 'START', id: 'shared', label: 'original' } as any);
      actor.send({ type: 'REPLACE' });
      const beforeDeadline = [...actor.getSnapshot().context.expired];
      expect(beforeDeadline).toEqual([]);
      clock.increment(99);
      expect(actor.getSnapshot().context.expired).toEqual([]);
      clock.increment(1);
      expect(actor.getSnapshot().context.expired).toEqual(['replacement']);
      actor.stop();
    });

    it('a queued notification must not fire a replacement with the same id prematurely', () => {
      const { actor, clock } = createStaleReproMachine('shared', true);
      actor.send({ type: 'START', id: 'shared', label: 'original' } as any);
      actor.send({ type: 'REPLACE' });
      // The old timer fired while REPLACE was being processed and was queued in mailbox.
      // After processing REPLACE, CANCEL and START, the stale timer event is dequeued.
      // It must be ignored, rather than firing the replacement timer at t=100.
      const beforeDeadline = [...actor.getSnapshot().context.expired];
      expect(beforeDeadline).toEqual([]);
      clock.increment(99);
      expect(actor.getSnapshot().context.expired).toEqual([]);
      // At t=200, the replacement timer's own deadline arrives.
      clock.increment(1);
      expect(actor.getSnapshot().context.expired).toEqual(['replacement']);
      actor.stop();
    });

    it('supports multiple rapid replacements under the same id', () => {
      const fired: string[] = [];
      const clock = new SimulatedClock();
      const machine = createMachine({
        on: {
          SCHEDULE: ({ event }: any, enq: any) => {
            enq.cancel('shared');
            enq.raise(
              { type: 'EXPIRE', label: event.label },
              { id: 'shared', delay: event.delay }
            );
          },
          EXPIRE: ({ event }: any) => {
            fired.push(event.label);
          }
        }
      } as any);
      const actor = createActor(machine, { clock }).start();
      actor.send({ type: 'SCHEDULE', label: 'first', delay: 100 } as any);
      clock.increment(30);
      actor.send({ type: 'SCHEDULE', label: 'second', delay: 100 } as any);
      clock.increment(30);
      actor.send({ type: 'SCHEDULE', label: 'third', delay: 100 } as any);
      clock.increment(30);
      actor.send({ type: 'SCHEDULE', label: 'fourth', delay: 100 } as any);

      // Total elapsed = 90ms. None of the timers should have fired yet.
      expect(fired).toEqual([]);

      // 99ms from the fourth schedule (at t=189ms), still nothing.
      clock.increment(99);
      expect(fired).toEqual([]);

      // At t=190ms (100ms from the fourth schedule), only fourth fires.
      clock.increment(1);
      expect(fired).toEqual(['fourth']);

      // Advance further; no extra firings occur.
      clock.increment(200);
      expect(fired).toEqual(['fourth']);
      actor.stop();
    });

    it('pure transition ignores stale occurrence and accepts matching occurrence or backward-compatible event', () => {
      const machine = createMachine({
        on: {
          SCHEDULE: (_, enq) => {
            enq.raise({ type: 'PING' }, { id: 'ping', delay: 100 });
          }
        }
      });
      const [initial] = initialTransition(machine);
      const [scheduled] = transition(machine, initial, { type: 'SCHEDULE' });
      expect(scheduled.timers).toHaveLength(1);
      expect(scheduled.timers[0].occurrence).toBe(0);

      // Stale occurrence does not consume the timer:
      const [staleIgnored] = transition(machine, scheduled, {
        type: 'xstate.timer',
        id: 'ping',
        occurrence: 999
      } as any);
      expect(staleIgnored.timers).toHaveLength(1);

      // Matching occurrence consumes the timer:
      const [matched] = transition(machine, scheduled, {
        type: 'xstate.timer',
        id: 'ping',
        occurrence: 0
      } as any);
      expect(matched.timers).toHaveLength(0);

      // Event without occurrence consumes the timer (backward compatibility):
      const [legacyMatched] = transition(machine, scheduled, {
        type: 'xstate.timer',
        id: 'ping'
      } as any);
      expect(legacyMatched.timers).toHaveLength(0);
    });

    it('restores and fires a legacy timer from a persisted snapshot without occurrence', () => {
      const clock = new SimulatedClock();
      const machine = createMachine({
        context: { count: 0 },
        on: {
          INC: ({ context }: any) => ({ context: { count: context.count + 1 } })
        }
      } as any);
      // Simulate a legacy snapshot where occurrence is not present on timers
      const legacySnapshot = {
        status: 'active',
        value: {},
        context: { count: 0 },
        children: {},
        timers: [
          {
            id: 'legacyTimer',
            delay: 100,
            type: '@xstate.raise',
            event: { type: 'INC' },
            target: 'self'
          }
        ]
      };
      const actor = restoreActor(machine, legacySnapshot as any, {
        clock
      }).start();

      expect((actor.getSnapshot().context as any).count).toBe(0);
      clock.increment(99);
      expect((actor.getSnapshot().context as any).count).toBe(0);
      clock.increment(1);
      expect((actor.getSnapshot().context as any).count).toBe(1);
      actor.stop();
    });

    it('survives cancellation and empty timer queue without resetting occurrence (exact #5919 scenario)', () => {
      const clock = new SimulatedClock();
      let actor: any;
      const expired: string[] = [];

      const machine = createMachine({
        context: { count: 0 },
        on: {
          START_A: (_: any, enq: any) => {
            enq.raise(
              { type: 'EXPIRE', label: 'A' },
              { id: 'shared', delay: 100 }
            );
          },
          CANCEL_AND_REPLACE: (_: any, enq: any) => {
            enq(() => {
              // A running action keeps the actor's mailbox busy.
              // 3. Cancel A and ensure no active timers remain.
              actor.send({ type: 'CANCEL_A' });
              // 4. Schedule timer B with the same ID "shared".
              actor.send({ type: 'START_B' });
              // 2. Let A's notification enter the actor mailbox behind CANCEL_A and START_B.
              clock.increment(100);
            });
          },
          CANCEL_A: (_: any, enq: any) => {
            enq.cancel('shared');
          },
          START_B: (_: any, enq: any) => {
            enq.raise(
              { type: 'EXPIRE', label: 'B' },
              { id: 'shared', delay: 100 }
            );
          },
          EXPIRE: ({ event }: any) => {
            expired.push(event.label);
          }
        }
      } as any);

      actor = createActor(machine, { clock }).start();

      // 1. Schedule timer A with explicit ID "shared" and occurrence 0.
      actor.send({ type: 'START_A' });
      expect(actor.getSnapshot().timers).toEqual([
        expect.objectContaining({ id: 'shared', occurrence: 0 })
      ]);

      // 2. Let A's notification enter the actor mailbox.
      // 3. Cancel A and ensure no active timers remain.
      // 4. Schedule timer B with the same ID "shared".
      actor.send({ type: 'CANCEL_AND_REPLACE' });

      // 5. Check whether B can receive occurrence 0 again.
      const snapshotAfterB = actor.getSnapshot();
      expect(snapshotAfterB.timers).toHaveLength(1);
      expect(snapshotAfterB.timers[0].id).toBe('shared');
      // B MUST have received occurrence 1 (not 0):
      expect(snapshotAfterB.timers[0].occurrence).toBe(1);

      // 6 & 7. Deliver A's previously queued notification.
      // A's queued notification (occurrence: 0) was dequeued behind CANCEL_A and START_B.
      // Verify that A's notification CANNOT fire B:
      expect(expired).toEqual([]);

      // Advance clock to B's own deadline:
      clock.increment(100);
      expect(expired).toEqual(['B']);
      actor.stop();
    });

    it('occurrence counter survives across snapshot persistence and restoration when no timers are active', () => {
      const clock = new SimulatedClock();
      const expired: string[] = [];

      const machine = createMachine({
        on: {
          START: ({ event }: any, enq: any) => {
            enq.raise(
              { type: 'EXPIRE', label: event.label },
              { id: 'shared', delay: 100 }
            );
          },
          CANCEL: (_: any, enq: any) => {
            enq.cancel('shared');
          },
          EXPIRE: ({ event }: any) => {
            expired.push(event.label);
          }
        }
      } as any);

      const actor = createActor(machine, { clock }).start();

      // 1. Schedule timer A with explicit ID "shared" (occurrence: 0)
      actor.send({ type: 'START', label: 'A' } as any);
      expect(actor.getSnapshot().timers[0].occurrence).toBe(0);

      // 2. Cancel A and ensure 0 active timers remain
      actor.send({ type: 'CANCEL' });
      expect(actor.getSnapshot().timers).toHaveLength(0);

      // 3. Persist snapshot when 0 timers are active
      const persisted = actor.getPersistedSnapshot() as any;
      expect(persisted.timers).toHaveLength(0);
      expect(persisted.nextTimerId).toBe(1);
      actor.stop();

      // 4. Restore actor from persisted snapshot
      const restoredActor = restoreActor(machine, persisted, { clock }).start();
      expect(restoredActor.getSnapshot().timers).toHaveLength(0);

      // 5. Schedule timer B with same ID "shared" on restored actor
      restoredActor.send({ type: 'START', label: 'B' } as any);
      const snapshot = restoredActor.getSnapshot();
      expect(snapshot.timers).toHaveLength(1);
      expect(snapshot.timers[0].id).toBe('shared');
      // B must receive occurrence 1, NOT 0!
      expect(snapshot.timers[0].occurrence).toBe(1);

      // 6. Deliver stale notification from A (occurrence: 0) via system relay
      (restoredActor.system as any)._relay(restoredActor, restoredActor, {
        type: 'xstate.timer',
        id: 'shared',
        occurrence: 0
      } as any);

      // 7. Verify stale notification from A does not fire B
      expect(expired).toEqual([]);

      // Advance to B's own deadline
      clock.increment(100);
      expect(expired).toEqual(['B']);
      restoredActor.stop();
    });
  });
});
