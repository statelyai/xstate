/**
 * Regression tests for open GitHub issues that are fixed (or made moot) in v6.
 * Each test reproduces the issue as originally reported, rewritten with v6
 * APIs, and asserts the fixed behavior.
 */
import {
  createActor,
  createAsyncLogic,
  createCallbackLogic,
  createMachine,
  setup,
  toPromise,
  types
} from '../src/index.ts';
import { createTestModel } from '../src/graph/index.ts';
import { z } from 'zod';

function roundTrip(persisted: unknown): any {
  return JSON.parse(JSON.stringify(persisted));
}

describe('persistence', () => {
  it('#4166 state meta is rehydrated after a JSON round-trip', () => {
    const machine = createMachine({
      schemas: {
        meta: z.object({ title: z.string() })
      },
      initial: 'a',
      states: {
        a: {
          meta: { title: 'A' },
          on: { NEXT: { target: 'b' } }
        },
        b: {
          meta: { title: 'B' }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'NEXT' });
    const persisted = roundTrip(actor.getPersistedSnapshot());
    actor.stop();

    const restored = createActor(machine, { snapshot: persisted }).start();

    expect(restored.getSnapshot().getMeta()).toEqual({
      '(machine).b': { title: 'B' }
    });
  });

  it('#5057 a spawned child can be persisted when spawned from a registered source', () => {
    const worker = createMachine({
      context: { count: 0 },
      on: {
        INC: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });
    const machine = createMachine({
      actors: { worker },
      on: {
        SPAWN: (_, enq) => {
          enq.spawn('worker', { id: 'w1' });
        },
        SPAWN_INLINE: (_, enq) => {
          enq.spawn(createMachine({}), { id: 'inline' });
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'SPAWN' });

    const persisted = roundTrip(actor.getPersistedSnapshot());
    expect(persisted.children.w1.src).toBe('worker');

    const restored = createActor(machine, { snapshot: persisted }).start();
    expect(restored.getSnapshot().children.w1).toBeDefined();

    // Raw inline logic has no source identity, so persisting it still throws
    restored.send({ type: 'SPAWN_INLINE' });
    expect(() => restored.getPersistedSnapshot()).toThrow(
      /inline child actor cannot be persisted/i
    );
  });
});

describe('lifecycle', () => {
  it('#5219 eventless source entry runs before the target state invoke starts', async () => {
    const log: string[] = [];
    const machine = setup({
      actors: {
        invoker: createAsyncLogic({
          run: async () => {
            log.push('next');
          }
        })
      }
    }).createMachine({
      id: 'myMachine',
      initial: 'start',
      states: {
        start: {
          entry: () => {
            log.push('start');
          },
          always: { target: 'next' }
        },
        next: {
          invoke: {
            id: 'next',
            src: 'invoker',
            onDone: { target: 'complete' }
          }
        },
        complete: { type: 'final' }
      }
    });

    const actor = createActor(machine).start();
    await toPromise(actor);

    expect(log).toEqual(['start', 'next']);
    expect(actor.getSnapshot().value).toBe('complete');
  });

  it('#5433 an invoked callback is cleaned up after onError leaves the state', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cleanup = vi.fn();
    let sendBackAfterStop: (() => void) | undefined;
    const { promise, reject } = Promise.withResolvers<never>();

    const machine = createMachine({
      initial: 'invoking',
      states: {
        invoking: {
          invoke: [
            {
              src: createCallbackLogic(({ sendBack }) => {
                sendBackAfterStop = () => sendBack({ type: 'UPDATE' });
                return cleanup;
              })
            },
            {
              src: createAsyncLogic({ run: () => promise }),
              onError: { target: '#failed' }
            }
          ]
        },
        failed: { id: 'failed' }
      }
    });

    const actor = createActor(machine).start();
    reject(new Error('refresh failed'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(actor.getSnapshot().value).toBe('failed');
    expect(cleanup).toHaveBeenCalledTimes(1);

    sendBackAfterStop?.();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('#4726 invoked callback cleanup runs when the machine errors', async () => {
    vi.useFakeTimers();
    try {
      let counter = 1;
      let isOver = false;
      const machine = setup({
        actors: {
          test: createCallbackLogic(({ sendBack }) => {
            const id = setInterval(() => {
              counter++;
              sendBack({ type: 'haha' + counter });
            }, 100);
            return () => {
              clearInterval(id);
              isOver = true;
            };
          })
        }
      }).createMachine({
        invoke: { src: 'test' },
        initial: 'idle',
        states: {
          idle: {
            on: {
              haha3: () => {
                throw new Error('haha');
              }
            }
          }
        }
      });

      const actor = createActor(machine);
      actor.start();
      const result = toPromise(actor);
      vi.advanceTimersByTime(300);

      await expect(result).rejects.toThrow('haha');
      expect(actor.getSnapshot().status).toBe('error');
      expect(counter).toBeGreaterThan(2);
      expect(isOver).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('#5120 sending to the parent of a root actor does not throw', () => {
    const machine = setup({}).createMachine({
      initial: 'init',
      states: {
        init: {
          entry: ({ parent }, enq) => {
            enq.sendTo(parent, { type: 'init' });
          }
        }
      }
    });

    const actor = createActor(machine);
    expect(() => actor.start()).not.toThrow();
    expect(actor.getSnapshot().status).toBe('active');
  });
});

describe('misc', () => {
  it('#2419 delay functions can see the state that declares the delay', () => {
    vi.useFakeTimers();
    try {
      const seen: string[] = [];
      const machine = createMachine({
        initial: 'start',
        context: { multiplier: 2 },
        delays: {
          dynamic: ({ context, stateNode }) => {
            seen.push(stateNode.key);
            return 100 * context.multiplier;
          }
        },
        states: {
          start: { on: { GO: { target: 'process' } } },
          process: { after: { dynamic: { target: 'done' } } },
          done: {}
        }
      });

      const actor = createActor(machine).start();
      actor.send({ type: 'GO' });

      expect(seen).toEqual(['process']);
      vi.advanceTimersByTime(200);
      expect(actor.getSnapshot().value).toBe('done');
    } finally {
      vi.useRealTimers();
    }
  });

  it('#4146 test model only takes a guarded transition while the guard passes', async () => {
    const cond = (context: { counter: number }) => context.counter === 0;
    const model = createTestModel(
      createMachine({
        initial: 'idle',
        schemas: {
          events: { INC: types<{}>() }
        },
        context: { counter: 0 },
        states: {
          idle: {
            on: {
              INC: ({ context }) =>
                cond(context)
                  ? { context: { counter: context.counter + 1 } }
                  : undefined
            }
          }
        }
      })
    );

    const paths = model.getShortestPaths();
    // INC is taken once: the second INC fails the guard and is not a step
    expect(paths.map((p) => p.steps.map((s) => s.event.type))).toEqual([
      ['@xstate.init', 'INC']
    ]);

    const incExecutor = vi.fn();
    for (const path of paths) {
      await path.test({
        events: {
          // `state` is the snapshot after INC was taken
          INC: ({ state }) => incExecutor(state.context.counter)
        }
      });
    }
    expect(incExecutor.mock.calls).toEqual([[1]]);
  });
});
