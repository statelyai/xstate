import { describe, expect, it } from 'vitest';
import { createMachine, setup } from '../src/index.ts';
import { createDurableSystem } from '../src/durable/system.ts';

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('durable actor system', () => {
  const notifier = createMachine({});
  const machine = createMachine({
    actors: { notifier },
    initial: 'running',
    states: {
      running: {
        invoke: { id: 'notifier', src: 'notifier' },
        on: {
          PING: ({ children, self }, enq) =>
            enq.sendTo(children.notifier, { type: 'PING', replyTo: self }),
          RESTART: { target: 'running', reenter: true }
        }
      }
    }
  });

  it('plans deterministic serializable effects using logical actor refs', () => {
    const durable = createDurableSystem(machine);

    const first = durable.initialTransition(undefined);
    const replay = durable.initialTransition(undefined);

    expect(first.effects).toEqual(replay.effects);
    expect(first.state.system).toEqual(replay.state.system);
    expect(roundTrip(durable.getPersistedSnapshot(first.state))).toEqual(
      roundTrip(durable.getPersistedSnapshot(replay.state))
    );
    expect(first.effects).toEqual([
      expect.objectContaining({
        id: '0:0',
        type: 'actor.spawn',
        source: { id: 'root:0', actorId: 'root' },
        actor: { id: 'notifier:1', actorId: 'notifier' },
        src: 'notifier'
      }),
      expect.objectContaining({
        id: '0:1',
        type: 'actor.start',
        actor: { id: 'notifier:1', actorId: 'notifier' }
      })
    ]);
    expect(roundTrip(first.effects)).toEqual(first.effects);
    expect(JSON.stringify(first.effects)).not.toContain('sessionId');
  });

  it('restores logical routing from an opt-in system snapshot', () => {
    const durable = createDurableSystem(machine);
    const initial = durable.initialTransition(undefined);
    const persisted = roundTrip(
      durable.getPersistedSystemSnapshot(initial.state)
    );
    const restored = durable.restoreSystemSnapshot(persisted);

    const pinged = durable.transition(restored, { type: 'PING' });

    expect(pinged.effects).toEqual([
      expect.objectContaining({
        id: '1:0',
        type: 'event.send',
        source: { id: 'root:0', actorId: 'root' },
        target: { id: 'notifier:1', actorId: 'notifier' },
        event: {
          type: 'PING',
          replyTo: { id: 'root:0', actorId: 'root' }
        }
      })
    ]);
  });

  it('assigns a new generation after stop and rejects stale completion', () => {
    const durable = createDurableSystem(machine);
    const initial = durable.initialTransition(undefined);
    const restarted = durable.transition(initial.state, { type: 'RESTART' });

    expect(
      restarted.effects.map((effect) => [
        effect.type,
        'actor' in effect ? effect.actor.id : undefined
      ])
    ).toEqual([
      ['actor.stop', 'notifier:1'],
      ['actor.spawn', 'notifier:2'],
      ['actor.start', 'notifier:2']
    ]);

    const stale = durable.transition(restarted.state, {
      type: 'xstate.done.actor',
      actorId: 'notifier',
      sessionId: 'notifier:1',
      output: undefined
    } as never);

    expect(stale.accepted).toBe(false);
    expect(stale.state).toBe(restarted.state);
    expect(stale.effects).toEqual([]);

    const current = durable.transition(restarted.state, {
      type: 'xstate.done.actor',
      actorId: 'notifier',
      sessionId: 'notifier:2',
      output: undefined
    } as never);
    expect(current.accepted).toBe(true);
  });

  it('accepts current logical completion without exposing runtime session IDs', () => {
    const child = createMachine({});
    const parent = createMachine({
      actors: { child },
      initial: 'waiting',
      states: {
        waiting: {
          invoke: {
            id: 'worker',
            src: 'child',
            onDone: { target: 'done' }
          }
        },
        done: { type: 'final' }
      }
    });
    const durable = createDurableSystem(parent);
    const initial = durable.initialTransition(undefined);
    const completed = durable.transition(initial.state, {
      type: 'xstate.done.actor',
      actorId: 'worker',
      sessionId: 'worker:1',
      output: undefined
    } as never);

    expect(completed.accepted).toBe(true);
    expect(completed.state.snapshot.status).toBe('done');
    expect(completed.effects.at(-1)).toMatchObject({
      type: 'actor.terminate',
      actor: { id: 'root:0', actorId: 'root' }
    });
    expect(JSON.stringify(completed.effects)).not.toContain(
      initial.state.snapshot.children.worker!.sessionId
    );
  });

  it('includes timer delivery intent and plans logical cancellation', () => {
    const timerMachine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          after: { 100: { target: 'done' } },
          on: { CANCEL: { target: 'cancelled' } }
        },
        done: {},
        cancelled: {}
      }
    });
    const durable = createDurableSystem(timerMachine);
    const initial = durable.initialTransition(undefined);

    expect(initial.effects).toEqual([
      expect.objectContaining({
        type: 'timer.schedule',
        source: { id: 'root:0', actorId: 'root' },
        target: { id: 'root:0', actorId: 'root' },
        timerId: expect.any(String),
        delay: 100,
        event: expect.objectContaining({
          type: expect.stringMatching(/^xstate\.after/)
        })
      })
    ]);

    const cancelled = durable.transition(initial.state, { type: 'CANCEL' });
    expect(cancelled.effects).toEqual([
      expect.objectContaining({
        type: 'timer.cancel',
        source: { id: 'root:0', actorId: 'root' },
        timerId:
          initial.effects[0]!.type === 'timer.schedule'
            ? initial.effects[0]!.timerId
            : undefined
      })
    ]);
  });

  it('keeps machine-only persistence easy when no actor topology is needed', () => {
    const single = createDurableSystem(
      createMachine({ initial: 'active', states: { active: {} } })
    );
    const initial = single.initialTransition(undefined);
    const persisted = roundTrip(single.getPersistedSnapshot(initial.state));
    const restored = single.restoreSnapshot(persisted, {
      transitionIndex: initial.state.nextTransitionIndex
    });

    expect(restored.snapshot.value).toBe('active');
    expect(restored.nextTransitionIndex).toBe(1);
    expect(restored.system.actors).toEqual({
      'root:0': { ref: { id: 'root:0', actorId: 'root' } }
    });
  });

  it('awaits host operations and local actions in plan order', async () => {
    const operations: string[] = [];
    const actionMachine = setup({
      actions: {
        first: () => {
          operations.push('action:first');
        },
        second: () => {
          operations.push('action:second');
        }
      }
    }).createMachine({
      entry: ({ actions }, enq) => {
        enq(actions.first);
        enq(actions.second);
      }
    });
    const durable = createDurableSystem(actionMachine);
    const initial = durable.initialTransition(undefined);

    await durable.executeEffects(initial.effects, {
      async execute(effect, executeAction) {
        operations.push(`before:${effect.id}`);
        await executeAction?.();
        operations.push(`after:${effect.id}`);
      }
    });

    expect(operations).toEqual([
      'before:0:0',
      'action:first',
      'after:0:0',
      'before:0:1',
      'action:second',
      'after:0:1'
    ]);
  });
});
