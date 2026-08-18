import { describe, expect, it, vi } from 'vitest';
import {
  createLogic,
  createMachine,
  type ActorLogic,
  type Snapshot
} from '../src/index.ts';
import {
  DurableExecutionCancelledError,
  DurableExecutionResumeError,
  createDurable,
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
    const d = createDurable(machine, {
      runtime: (metadata) => ({
        terminateActor: () => {
          executed.push(metadata);
        }
      }),
      executeAction: async (effect, metadata) => {
        executed.push(metadata);
        await effect.exec();
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
    const d = createDurable(machine, {
      executeAction: (_effect, { id }) => {
        ids.push(id);
      },
      waitForEvent: () => ({ type: 'unused' as const })
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
      const d = createDurable(machine, {
        executeAction: () => {},
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
    const seenEffects: unknown[] = [];
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 100: { target: 'done' } } },
        done: {}
      }
    });
    const d = createDurable(machine, {
      runtime: (_metadata, effect) => {
        seenEffects.push(effect);
        return { scheduleTimer };
      },
      executeAction: () => {},
      waitForEvent: () => ({ type: 'unused' as const })
    });
    const [, effects] = d.initialTransition(undefined);

    await d.executeEffects(effects);

    expect(scheduleTimer).toHaveBeenCalledOnce();
    expect(scheduleTimer.mock.calls[0]?.slice(1)).toEqual([
      expect.any(String),
      100
    ]);
    expect(seenEffects).toEqual([
      expect.objectContaining({
        type: '@xstate.raise',
        delay: 100,
        event: expect.objectContaining({ type: expect.stringMatching('after') })
      })
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
    const d = createDurable(machine, {
      executeAction: () => {},
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
    const d = createDurable(machine, {
      transitionIndex: 12,
      executeAction: () => {},
      waitForEvent: () => ({ type: 'unused' })
    });

    const [state, initialEffects] = d.initialTransition(undefined);

    expect(initialEffects).toEqual([]);
    expect(d.nextTransitionIndex).toBe(13);

    const checkpoint = d.nextTransitionIndex;
    const restored = createDurable(machine, {
      transitionIndex: checkpoint,
      executeAction: () => {},
      waitForEvent: () => ({ type: 'unused' })
    });
    const [, effects] = restored.transition(state, { type: 'EFFECT' });

    expect(effects[0]?.id).toBe('13:0');
    expect(restored.nextTransitionIndex).toBe(14);
  });

  it('rejects an invalid starting transition index', () => {
    const machine = createMachine({});

    expect(() =>
      createDurable(machine, {
        transitionIndex: -1,
        executeAction: () => {},
        waitForEvent: () => ({ type: 'unused' })
      })
    ).toThrow('transitionIndex must be a non-negative safe integer');
  });

  it('rejects run() when configured to resume from a checkpoint', async () => {
    const action = vi.fn();
    const machine = createMachine({
      entry: (_, enq) => enq(action)
    });
    const durable = createDurable(machine, {
      transitionIndex: 12,
      executeAction: async (effect, _metadata, runtime) => {
        await effect.exec(runtime);
      },
      waitForEvent: () => ({ type: 'unused' })
    });

    await expect(durable.run(undefined)).rejects.toBeInstanceOf(
      DurableExecutionResumeError
    );
    expect(action).not.toHaveBeenCalled();
  });

  it('rejects run() after lower-level transition methods were used', async () => {
    const machine = createMachine({});
    const durable = createDurable(machine, {
      executeAction: () => {},
      waitForEvent: () => ({ type: 'unused' })
    });

    durable.initialTransition(undefined);

    await expect(durable.run(undefined)).rejects.toBeInstanceOf(
      DurableExecutionResumeError
    );
  });

  it('forwards the host runtime to createLogic effects', async () => {
    const sendEvent = vi.fn();
    const runtime = { sendEvent };
    let providedRuntime: unknown;
    const logic = createLogic({
      context: undefined,
      run: ({ event }, enq) => {
        if (event.type === '@xstate.init') {
          enq.effect((effectRuntime) => {
            providedRuntime = effectRuntime;
          });
        }
      }
    });
    const durable = createDurable(logic, {
      executeAction: async (effect, _metadata, effectRuntime) => {
        await effect.exec(effectRuntime);
      },
      runtime: () => runtime,
      waitForEvent: () => ({ type: 'unused' })
    });
    const [, effects] = durable.initialTransition(undefined);

    await durable.executeEffects(effects);

    const target = { address: 'elsewhere' } as never;
    const event = { type: 'X' };
    await (
      providedRuntime as { sendEvent(...args: unknown[]): PromiseLike<void> }
    ).sendEvent(undefined, target, event);
    expect(runtime.sendEvent).toHaveBeenCalledWith(undefined, target, event);
  });

  it('runs to completion and assigns stable IDs to event waits', async () => {
    const waits: Array<{ id: string; transitionIndex: number }> = [];
    const machine = createMachine({
      output: 42,
      initial: 'active',
      states: {
        active: { on: { FINISH: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const durable = createDurable(machine, {
      executeAction: () => {},
      runtime: () => ({ terminateActor: () => {} }),
      waitForEvent: (metadata) => {
        waits.push(metadata);
        return { type: 'FINISH' };
      }
    });

    await expect(durable.run(undefined)).resolves.toBe(42);
    expect(waits).toEqual([{ id: 'event:0', transitionIndex: 0 }]);
  });

  it('throws the machine error when execution ends with an error', async () => {
    const error = new Error('failed');
    const snapshot: Snapshot<never> = {
      status: 'error',
      output: undefined,
      error
    };
    const logic: ActorLogic<Snapshot<never>, { type: 'unused' }, undefined> = {
      initialTransition: () => [snapshot, []],
      transition: () => [snapshot, []],
      getInitialSnapshot: () => snapshot,
      getPersistedSnapshot: (value) => value
    };
    const durable = createDurable(logic, {
      executeAction: () => {},
      runtime: () => ({ terminateActor: () => {} }),
      waitForEvent: () => ({ type: 'unused' as const })
    });

    await expect(durable.run(undefined)).rejects.toBe(error);
  });

  it('treats a stopped machine as cancellation', async () => {
    const snapshot: Snapshot<never> = {
      status: 'stopped',
      output: undefined,
      error: undefined
    };
    const logic: ActorLogic<Snapshot<never>, { type: 'unused' }, undefined> = {
      initialTransition: () => [snapshot, []],
      transition: () => [snapshot, []],
      getInitialSnapshot: () => snapshot,
      getPersistedSnapshot: (value) => value
    };
    const durable = createDurable(logic, {
      executeAction: () => {},
      waitForEvent: () => ({ type: 'unused' as const })
    });

    await expect(durable.run(undefined)).rejects.toBeInstanceOf(
      DurableExecutionCancelledError
    );
  });
});
