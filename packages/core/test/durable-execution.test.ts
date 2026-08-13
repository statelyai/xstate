import { describe, expect, it, vi } from 'vitest';
import { createMachine } from '../src/index.ts';
import {
  createDurableExecution,
  type DurableEffectMetadata
} from '../src/durable/index.ts';

describe('durable execution', () => {
  it('tags and executes effects in deterministic transition order', async () => {
    const operations: string[] = [];
    const executed: DurableEffectMetadata[] = [];
    const machine = createMachine({
      initial: 'active',
      entry: (_, enq) => {
        enq(() => operations.push('initial:first'));
        enq(() => operations.push('initial:second'));
      },
      states: {
        active: {
          on: {
            FINISH: { target: 'done' }
          }
        },
        done: {
          type: 'final',
          entry: (_, enq) => enq(() => operations.push('finish'))
        }
      }
    });
    const d = createDurableExecution(machine, {
      runtime: { terminateActor: vi.fn() },
      executeEffect: async (effect, metadata, runtime) => {
        executed.push(metadata);
        await effect.exec(runtime);
      },
      waitForEvent: () => ({ type: 'FINISH' })
    });

    let [state, effects] = d.initialTransition(undefined);
    expect(effects.map(({ id }) => id)).toEqual(['0:0', '0:1']);
    await d.executeEffects(effects);

    [state, effects] = d.transition(state, await d.waitForEvent());
    expect(effects.map(({ id }) => id)).toEqual(['1:0', '1:1']);
    await d.executeEffects(effects);

    expect(state.status).toBe('done');
    expect(operations).toEqual(['initial:first', 'initial:second', 'finish']);
    expect(executed).toEqual([
      { id: '0:0', transitionIndex: 0, effectIndex: 0 },
      { id: '0:1', transitionIndex: 0, effectIndex: 1 },
      { id: '1:0', transitionIndex: 1, effectIndex: 0 },
      { id: '1:1', transitionIndex: 1, effectIndex: 1 }
    ]);
  });

  it('keeps effect IDs stable when a durable host retries a batch', async () => {
    const ids: string[] = [];
    const machine = createMachine({
      entry: (_, enq) => enq(() => {})
    });
    const d = createDurableExecution(machine, {
      executeEffect: (_effect, { id }) => {
        ids.push(id);
      },
      waitForEvent: () => ({ type: 'unused' })
    });
    const [, effects] = d.initialTransition(undefined);

    await d.executeEffects(effects);
    await d.executeEffects(effects);

    expect(ids).toEqual(['0:0', '0:0']);
  });

  it('reconstructs the same IDs during replay', () => {
    const machine = createMachine({
      initial: 'one',
      entry: (_, enq) => enq(() => {}),
      states: {
        one: {
          on: {
            NEXT: (_, enq) => {
              enq(() => {});
              return { target: 'two' };
            }
          }
        },
        two: {}
      }
    });
    const replay = () => {
      const d = createDurableExecution(machine, {
        executeEffect: () => {},
        waitForEvent: () => ({ type: 'NEXT' })
      });
      let [state, initialEffects] = d.initialTransition(undefined);
      const [, nextEffects] = d.transition(state, { type: 'NEXT' });
      return [...initialEffects, ...nextEffects].map(({ id }) => id);
    };

    expect(replay()).toEqual(replay());
    expect(replay()).toEqual(['0:0', '1:0']);
  });

  it('delegates timers to the host runtime without awaiting the delay', async () => {
    const scheduleTimer = vi.fn();
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 100: { target: 'done' } } },
        done: {}
      }
    });
    const d = createDurableExecution(machine, {
      runtime: { scheduleTimer },
      executeEffect: (effect, _metadata, runtime) => effect.exec(runtime),
      waitForEvent: () => ({ type: 'unused' })
    });
    const [, effects] = d.initialTransition(undefined);

    await d.executeEffects(effects);

    expect(scheduleTimer).toHaveBeenCalledOnce();
    expect(scheduleTimer.mock.calls[0]?.slice(1)).toEqual([
      expect.any(String),
      100
    ]);
  });

  it('fails when the host does not support a required runtime operation', async () => {
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 100: { target: 'done' } } },
        done: {}
      }
    });
    const d = createDurableExecution(machine, {
      executeEffect: (effect, _metadata, runtime) => effect.exec(runtime),
      waitForEvent: () => ({ type: 'unused' })
    });
    const [, effects] = d.initialTransition(undefined);

    await expect(d.executeEffects(effects)).rejects.toBeInstanceOf(TypeError);
  });

  it('exposes the next transition index for host-managed checkpoints', () => {
    const machine = createMachine({
      on: {
        EFFECT: (_, enq) => enq(() => {})
      }
    });
    const d = createDurableExecution(machine, {
      transitionIndex: 12,
      executeEffect: () => {},
      waitForEvent: () => ({ type: 'unused' })
    });

    const [state, initialEffects] = d.initialTransition(undefined);

    expect(initialEffects).toEqual([]);
    expect(d.nextTransitionIndex).toBe(13);

    const checkpoint = d.nextTransitionIndex;
    const restored = createDurableExecution(machine, {
      transitionIndex: checkpoint,
      executeEffect: () => {},
      waitForEvent: () => ({ type: 'unused' })
    });
    const [, effects] = restored.transition(state, { type: 'EFFECT' });

    expect(effects[0]?.id).toBe('13:0');
    expect(restored.nextTransitionIndex).toBe(14);
  });

  it('rejects an invalid starting transition index', () => {
    const machine = createMachine({});

    expect(() =>
      createDurableExecution(machine, {
        transitionIndex: -1,
        executeEffect: () => {},
        waitForEvent: () => ({ type: 'unused' })
      })
    ).toThrow('transitionIndex must be a non-negative safe integer');
  });
});
