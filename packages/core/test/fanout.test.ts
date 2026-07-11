import { createAsyncLogic } from '../src/actors/index.ts';
import { createMachine, createActor, SimulatedClock } from '../src/index.ts';
import { setTimeout as sleep } from 'node:timers/promises';
import z from 'zod';

describe('fanout invoke', () => {
  it('joins all item outputs in item order', async () => {
    const { promise, resolve } = Promise.withResolvers<number[]>();
    const worker = createAsyncLogic<number, number>({
      run: async ({ input }) => input * 2
    });
    const machine = createMachine({
      actorSources: {
        worker
      },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'worker',
            items: [3, 1, 2],
            onDone: ({ output }) => {
              resolve(output as unknown as number[]);
              return { target: 'success' };
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    createActor(machine).start();

    await expect(promise).resolves.toEqual([6, 2, 4]);
  });

  it('resolves race with the first completed item output', async () => {
    const { promise, resolve } = Promise.withResolvers<number>();
    const worker = createAsyncLogic<number, number>({
      run: async ({ input }) => {
        await sleep(input);
        return input;
      }
    });
    const machine = createMachine({
      actorSources: {
        worker
      },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'worker',
            items: [30, 5, 20],
            join: 'race',
            onDone: ({ output }) => {
              resolve(output);
              return { target: 'success' };
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    createActor(machine).start();

    await expect(promise).resolves.toBe(5);
  });

  it('joins allSettled item outputs and errors', async () => {
    const { promise, resolve } =
      Promise.withResolvers<
        Array<
          | { status: 'fulfilled'; output: number; key: string; index: number }
          | { status: 'rejected'; error: unknown; key: string; index: number }
        >
      >();
    const worker = createAsyncLogic<number, number>({
      run: async ({ input }) => {
        if (input === 2) {
          throw new Error('nope');
        }
        return input * 2;
      }
    });
    const machine = createMachine({
      actorSources: {
        worker
      },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'worker',
            items: [1, 2, 3],
            join: 'allSettled',
            onDone: ({ output }) => {
              resolve(
                output as unknown as Array<
                  | {
                      status: 'fulfilled';
                      output: number;
                      key: string;
                      index: number;
                    }
                  | {
                      status: 'rejected';
                      error: unknown;
                      key: string;
                      index: number;
                    }
                >
              );
              return { target: 'success' };
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    createActor(machine).start();

    const output = await promise;
    expect(output[0]).toEqual({
      status: 'fulfilled',
      output: 2,
      key: '0',
      index: 0
    });
    expect(output[1]?.status).toBe('rejected');
    expect(output[1]).toMatchObject({
      status: 'rejected',
      key: '1',
      index: 1
    });
    expect(output[2]).toEqual({
      status: 'fulfilled',
      output: 6,
      key: '2',
      index: 2
    });
  });

  it('limits started item actors with concurrency', async () => {
    const { promise, resolve } = Promise.withResolvers<number>();
    let active = 0;
    let maxActive = 0;
    const worker = createAsyncLogic<number, number>({
      run: async ({ input }) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await sleep(10);
        active--;
        return input;
      }
    });
    const machine = createMachine({
      actorSources: {
        worker
      },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'worker',
            items: [1, 2, 3, 4, 5],
            concurrency: 2,
            onDone: () => {
              resolve(maxActive);
              return { target: 'success' };
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    createActor(machine).start();

    await expect(promise).resolves.toBe(2);
  });

  it('errors on duplicate item keys', async () => {
    const { promise, resolve } = Promise.withResolvers<unknown>();
    const worker = createAsyncLogic<number, number>({
      run: async ({ input }) => input
    });
    const machine = createMachine({
      actorSources: { worker },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'worker',
            items: [1, 2, 3],
            key: () => 'same',
            onError: ({ event }) => {
              resolve(event.error);
              return { target: 'failure' };
            }
          }
        },
        failure: { type: 'final' }
      }
    });

    const actor = createActor(machine).start();

    const error = (await promise) as Error;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/Duplicate fanout item key "same"/);
    expect(actor.getSnapshot().value).toBe('failure');
  });

  it("join 'any' resolves with the first fulfilled item despite earlier rejections", async () => {
    const { promise, resolve } = Promise.withResolvers<number>();
    const worker = createAsyncLogic<number, number>({
      run: async ({ input }) => {
        if (input === 1) {
          throw new Error('one failed');
        }
        await sleep(input);
        return input;
      }
    });
    const machine = createMachine({
      actorSources: { worker },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'worker',
            items: [1, 50, 20],
            join: 'any',
            onDone: ({ output }) => {
              resolve(output as number);
              return { target: 'success' };
            }
          }
        },
        success: { type: 'final' }
      }
    });

    createActor(machine).start();

    await expect(promise).resolves.toBe(20);
  });

  it("join 'any' errors with an aggregated error when all items reject", async () => {
    const { promise, resolve } = Promise.withResolvers<unknown>();
    const worker = createAsyncLogic<number, number>({
      run: async ({ input }) => {
        throw new Error(`fail ${input}`);
      }
    });
    const machine = createMachine({
      actorSources: { worker },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'worker',
            items: [1, 2, 3],
            join: 'any',
            onError: ({ event }) => {
              resolve(event.error);
              return { target: 'failure' };
            }
          }
        },
        failure: { type: 'final' }
      }
    });

    createActor(machine).start();

    const error = (await promise) as AggregateError;
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.message).toBe('All fanout items rejected');
    expect(error.errors).toHaveLength(3);
    expect(error.errors.map((e: unknown) => (e as Error).message)).toEqual([
      'fail 1',
      'fail 2',
      'fail 3'
    ]);
  });

  describe('empty items', () => {
    const makeMachine = (join: 'all' | 'allSettled' | 'race' | 'any') => {
      const worker = createAsyncLogic<number, number>({
        run: async ({ input }) => input
      });
      return createMachine({
        actorSources: { worker },
        initial: 'pending',
        states: {
          pending: {
            invoke: {
              src: 'worker',
              items: [],
              join,
              onDone: ({ output }) => ({
                target: 'success',
                context: { output }
              }),
              onError: ({ event }) => ({
                target: 'failure',
                context: { error: event.error }
              })
            }
          },
          success: { type: 'final' },
          failure: { type: 'final' }
        },
        context: {} as { output?: unknown; error?: unknown }
      });
    };

    it("'all' completes immediately with []", () => {
      const actor = createActor(makeMachine('all')).start();
      expect(actor.getSnapshot().value).toBe('success');
      expect(actor.getSnapshot().context.output).toEqual([]);
    });

    it("'allSettled' completes immediately with []", () => {
      const actor = createActor(makeMachine('allSettled')).start();
      expect(actor.getSnapshot().value).toBe('success');
      expect(actor.getSnapshot().context.output).toEqual([]);
    });

    it("'race' errors", () => {
      const actor = createActor(makeMachine('race')).start();
      expect(actor.getSnapshot().value).toBe('failure');
      expect((actor.getSnapshot().context.error as Error).message).toMatch(
        /empty list/
      );
    });

    it("'any' errors", () => {
      const actor = createActor(makeMachine('any')).start();
      expect(actor.getSnapshot().value).toBe('failure');
      expect((actor.getSnapshot().context.error as Error).message).toMatch(
        /empty list/
      );
    });
  });

  it("'allSettled' with concurrency launches later items as rejections free capacity", async () => {
    const { promise, resolve } = Promise.withResolvers<FanOutSettledType[]>();
    type FanOutSettledType =
      | { status: 'fulfilled'; output: number; key: string; index: number }
      | { status: 'rejected'; error: unknown; key: string; index: number };
    const worker = createAsyncLogic<number, number>({
      run: async ({ input }) => {
        await sleep(input);
        if (input % 2 === 0) {
          throw new Error(`even ${input}`);
        }
        return input * 2;
      }
    });
    const machine = createMachine({
      actorSources: { worker },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'worker',
            items: [1, 2, 3, 4, 5],
            join: 'allSettled',
            concurrency: 2,
            onDone: ({ output }) => {
              resolve(output as unknown as FanOutSettledType[]);
              return { target: 'success' };
            }
          }
        },
        success: { type: 'final' }
      }
    });

    createActor(machine).start();

    const output = await promise;
    expect(output).toHaveLength(5);
    expect(output[0]).toEqual({
      status: 'fulfilled',
      output: 2,
      key: '0',
      index: 0
    });
    expect(output[1]?.status).toBe('rejected');
    expect(output[2]).toEqual({
      status: 'fulfilled',
      output: 6,
      key: '2',
      index: 2
    });
    expect(output[3]?.status).toBe('rejected');
    expect(output[4]).toEqual({
      status: 'fulfilled',
      output: 10,
      key: '4',
      index: 4
    });
  });

  it('reports live progress to the parent via onSnapshot as items settle', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    // Records every settledCount the parent observes through onSnapshot.
    const observedProgress: number[] = [];
    const worker = createAsyncLogic<number, number>({
      run: async ({ input }) => {
        await sleep(input);
        return input;
      }
    });
    const machine = createMachine({
      actorSources: { worker },
      schemas: {
        context: z.object({ settledCount: z.number() })
      },
      context: { settledCount: 0 },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'worker',
            items: [10, 20, 30],
            join: 'allSettled',
            onSnapshot: ({ event }) => {
              const snapshot = event.snapshot as {
                context: { settledCount: number };
              };
              observedProgress.push(snapshot.context.settledCount);
              return {
                context: { settledCount: snapshot.context.settledCount }
              };
            },
            onDone: () => {
              resolve();
              return { target: 'success' };
            }
          }
        },
        success: { type: 'final' }
      }
    });

    const actor = createActor(machine).start();

    await promise;

    // The parent observed intermediate progress: after the first item settled
    // (settledCount 1) and the second (settledCount 2), before all completed.
    expect(observedProgress).toContain(1);
    expect(observedProgress).toContain(2);
    // Progress is monotonically non-decreasing.
    for (let i = 1; i < observedProgress.length; i++) {
      expect(observedProgress[i]).toBeGreaterThanOrEqual(
        observedProgress[i - 1]
      );
    }
    // Final done output still delivers all settled entries.
    expect(actor.getSnapshot().value).toBe('success');
  });

  it("forwards children's emitted events to the parent with fanout item identity", async () => {
    const child = createMachine({
      schemas: {
        input: z.object({ n: z.number() }),
        context: z.object({ n: z.number() }),
        emitted: {
          itemEmit: z.object({ n: z.number() })
        }
      },
      context: ({ input }) => ({ n: input.n }),
      initial: 'waiting',
      states: {
        // A real-timer delay so the parent can attach its listener before the
        // children emit.
        waiting: { after: { 5: { target: 'emitting' } } },
        emitting: {
          entry: ({ context }, enq) => {
            enq.emit({ type: 'itemEmit', n: context.n });
          },
          type: 'final'
        }
      },
      output: ({ context }) => context.n
    });

    const machine = createMachine({
      actorSources: { child },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            id: 'fanoutItems',
            src: 'child',
            items: [{ n: 10 }, { n: 20 }],
            key: ({ item }) => String((item as { n: number }).n),
            onDone: () => ({ target: 'success' })
          }
        },
        success: { type: 'final' }
      }
    });

    const actor = createActor(machine).start();

    const received: Array<{
      type: string;
      n: number;
      fanout: { key: string; index: number };
    }> = [];
    const fanoutRef = actor.getSnapshot().children.fanoutItems!;
    fanoutRef.on('*', (event) => {
      received.push(event as any);
    });

    await sleep(50);

    expect(actor.getSnapshot().value).toBe('success');
    // Both children's emitted events reached the parent-side listener.
    expect(received).toHaveLength(2);
    // Each carries the original event shape plus the item identity.
    expect(received).toContainEqual({
      type: 'itemEmit',
      n: 10,
      fanout: { key: '10', index: 0 }
    });
    expect(received).toContainEqual({
      type: 'itemEmit',
      n: 20,
      fanout: { key: '20', index: 1 }
    });
  });

  it('resumes a mid-flight fanout from a persisted snapshot without re-executing settled items', () => {
    const executions: string[] = [];
    let finalOutput: unknown;

    const child = createMachine({
      schemas: {
        context: z.object({ id: z.string(), delay: z.number() }),
        input: z.object({ id: z.string(), delay: z.number() })
      },
      context: ({ input }) => ({ id: input.id, delay: input.delay }),
      entry: ({ context }) => {
        executions.push(context.id);
      },
      initial: 'stepOne',
      delays: {
        itemDelay: ({ context }) => context.delay
      },
      states: {
        stepOne: { after: { 5: { target: 'stepTwo' } } },
        stepTwo: { after: { itemDelay: { target: 'complete' } } },
        complete: { type: 'final' }
      },
      output: ({ context }) => context.id
    });

    const makeMachine = () =>
      createMachine({
        actorSources: { child },
        initial: 'pending',
        states: {
          pending: {
            invoke: {
              id: 'fanoutItems',
              src: 'child',
              items: [
                { id: 'a', delay: 5 },
                { id: 'b', delay: 5 },
                { id: 'c', delay: 1000 }
              ],
              key: ({ item }) => (item as { id: string }).id,
              onDone: ({ output }) => {
                finalOutput = output;
                return { target: 'success' };
              }
            }
          },
          success: { type: 'final' }
        }
      });

    const clock = new SimulatedClock();
    const actor = createActor(makeMachine(), { clock }).start();

    // All three items start and run their entry once.
    expect(executions).toEqual(['a', 'b', 'c']);

    clock.increment(5); // stepOne -> stepTwo for all
    clock.increment(5); // a, b (delay 5) complete; c still in stepTwo

    const persisted: any = actor.getPersistedSnapshot();
    // The in-flight child machine 'c' persisted in its second state.
    expect(
      persisted.children.fanoutItems.snapshot.children.c.snapshot.value
    ).toBe('stepTwo');
    // Settled children a, b are no longer tracked as live children.
    expect(
      Object.keys(persisted.children.fanoutItems.snapshot.children)
    ).toEqual(['c']);

    actor.stop();

    const clock2 = new SimulatedClock();
    const restored = createActor(makeMachine(), {
      clock: clock2,
      snapshot: persisted
    }).start();

    // Restoring must NOT re-run a, b, or c (c resumes from stepTwo).
    expect(executions).toEqual(['a', 'b', 'c']);
    expect(restored.getSnapshot().value).toBe('pending');

    // A second persist round-trip keeps the fan-out marker (the restored
    // child's re-wrapped logic carries it).
    const persistedAgain: any = restored.getPersistedSnapshot();
    expect(persistedAgain.children.fanoutItems.fanout).toEqual({
      join: 'all'
    });

    clock2.increment(2000); // c completes

    expect(executions).toEqual(['a', 'b', 'c']);
    expect(restored.getSnapshot().value).toBe('success');
    expect(finalOutput).toEqual(['a', 'b', 'c']);
  });

  it('respects the concurrency limit after restore', () => {
    const executions: string[] = [];
    let finalOutput: unknown;

    const child = createMachine({
      schemas: {
        context: z.object({ id: z.string(), delay: z.number() }),
        input: z.object({ id: z.string(), delay: z.number() })
      },
      context: ({ input }) => ({ id: input.id, delay: input.delay }),
      entry: ({ context }) => {
        executions.push(context.id);
      },
      initial: 'working',
      delays: {
        itemDelay: ({ context }) => context.delay
      },
      states: {
        working: { after: { itemDelay: { target: 'complete' } } },
        complete: { type: 'final' }
      },
      output: ({ context }) => context.id
    });

    const makeMachine = () =>
      createMachine({
        actorSources: { child },
        initial: 'pending',
        states: {
          pending: {
            invoke: {
              id: 'fanoutItems',
              src: 'child',
              items: [
                { id: 'a', delay: 10 },
                { id: 'b', delay: 10 },
                { id: 'c', delay: 10 }
              ],
              concurrency: 1,
              key: ({ item }) => (item as { id: string }).id,
              onDone: ({ output }) => {
                finalOutput = output;
                return { target: 'success' };
              }
            }
          },
          success: { type: 'final' }
        }
      });

    const clock = new SimulatedClock();
    const actor = createActor(makeMachine(), { clock }).start();

    // concurrency 1 -> only the first item started.
    expect(executions).toEqual(['a']);

    clock.increment(10); // a completes, b launches
    expect(executions).toEqual(['a', 'b']);

    const persisted: any = actor.getPersistedSnapshot();
    // c has not launched yet.
    expect(
      Object.keys(persisted.children.fanoutItems.snapshot.children)
    ).toEqual(['b']);

    actor.stop();

    const clock2 = new SimulatedClock();
    const restored = createActor(makeMachine(), {
      clock: clock2,
      snapshot: persisted
    }).start();

    // Restore must not exceed concurrency: c stays unlaunched while b runs.
    expect(executions).toEqual(['a', 'b']);

    clock2.increment(50); // b completes, c launches
    expect(executions).toEqual(['a', 'b', 'c']);
    clock2.increment(50); // c completes

    expect(restored.getSnapshot().value).toBe('success');
    expect(finalOutput).toEqual(['a', 'b', 'c']);
  });
});
