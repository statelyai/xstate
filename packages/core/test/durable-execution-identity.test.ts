import { createAsyncLogic, setup } from '../src/index.ts';
import { createDurable } from '../src/durable/index.ts';

const fraudCheck = createAsyncLogic({
  id: 'fraudCheck',
  run: async (_, enq) => {
    return enq.step('score', async () => 0.2);
  }
});

const machine = setup({ actors: { fraudCheck } }).createMachine({
  id: 'order',
  initial: 'verifying',
  states: {
    verifying: {
      invoke: { id: 'fraud', src: 'fraudCheck', onDone: { target: 'approved' } }
    },
    approved: {}
  }
});

/**
 * Takes the root events a settled batch retained: `waitForEvent()` hands them
 * out until it defers to the adapter, whose host-driven stub throws.
 */
async function takeRootEvents(execution: {
  waitForEvent(): Promise<unknown>;
}): Promise<any[]> {
  const events: any[] = [];
  for (;;) {
    try {
      events.push(await execution.waitForEvent());
    } catch {
      return events;
    }
  }
}

function createHost(steps: Map<string, unknown>, executionId?: string) {
  return createDurable(machine, {
    executionId,
    executeAction: () => {},
    startActor: (actor) => {
      actor.start();
    },
    runStep: async (actor, key, exec) => {
      const id = `${actor.address}:${key}`;
      if (steps.has(id)) {
        return steps.get(id);
      }
      const output = await exec();
      steps.set(id, output);
      return output;
    },
    waitForEvent: () => {
      throw new Error('host-driven loop');
    }
  });
}

describe('deterministic execution identity', () => {
  it('a replay re-creates the same session ids', async () => {
    const steps = new Map<string, unknown>();
    const first = createHost(steps, 'exec-1');
    const [s1, e1] = first.initialTransition();
    await first.executeEffects(e1);
    const events1 = await takeRootEvents(first);

    const second = createHost(steps, 'exec-1');
    const [s2, e2] = second.initialTransition();
    await second.executeEffects(e2);
    const events2 = await takeRootEvents(second);

    expect(events1).toEqual(events2);
    const sessionId = (events1[0] as { sessionId?: string }).sessionId;
    expect(sessionId).toMatch(/^exec-1:/);
    void s1;
    void s2;
  });

  it('a journaled completion event still matches the child a replay re-creates', async () => {
    const steps = new Map<string, unknown>();

    // Run 1: the invoked fraud check completes; its completion reaches the
    // root and a journaling host records the event verbatim.
    const first = createHost(steps, 'exec-1');
    const [snapshot1, effects1] = first.initialTransition();
    await first.executeEffects(effects1);
    const [journaled] = await takeRootEvents(first);
    expect(journaled.type).toMatch(/^xstate\.done\.actor/);

    // Crash. Replay from the beginning in a "fresh process": same journal,
    // same executionId. The replayed step returns its memoized result, and
    // the recorded completion event — carrying run 1's sessionId — must
    // match the child the replay just re-created.
    const second = createHost(steps, 'exec-1');
    const [snapshot2, effects2] = second.initialTransition();
    await second.executeEffects(effects2);
    const [replayed] = second.transition(snapshot2 as never, journaled);
    expect((replayed as { value?: unknown }).value).toBe('approved');
    void snapshot1;
  });

  it('without an executionId, journaled completions go stale across replays', async () => {
    const steps = new Map<string, unknown>();
    const first = createHost(steps);
    const [, effects1] = first.initialTransition();
    await first.executeEffects(effects1);
    const [journaled] = await takeRootEvents(first);

    const second = createHost(steps);
    const [snapshot2, effects2] = second.initialTransition();
    await second.executeEffects(effects2);
    const [replayed] = second.transition(snapshot2 as never, journaled);
    // The recorded sessionId embeds run 1's random system id, so the
    // completion is dropped as stale — the documented reason to pin
    // executionId on journaling hosts.
    expect((replayed as { value?: unknown }).value).toBe('verifying');
  });
});

describe('runLogic: the async actor as the durable unit', () => {
  const plainMachine = setup({
    actors: {
      score: createAsyncLogic({
        id: 'score',
        // A normal promise — no step vocabulary.
        run: async ({ input }: { input: { total: number } }) =>
          input.total > 1000 ? 0.9 : 0.1
      })
    }
  }).createMachine({
    id: 'order',
    initial: 'verifying',
    context: ({ input }: { input: { total: number } }) => ({
      total: input.total
    }),
    states: {
      verifying: {
        invoke: {
          id: 'fraud',
          src: 'score',
          input: ({ context }) => ({ total: context.total }),
          onDone: { target: 'approved' }
        }
      },
      approved: {}
    }
  });

  it('a journaling host wraps the body once and replays the result', async () => {
    const journal = new Map<string, unknown>();
    let executions = 0;
    const host = (executionId: string) =>
      createDurable(plainMachine, {
        executionId,
        executeAction: () => {},
        startActor: (actor) => {
          actor.start();
        },
        runLogic: async (actor, exec) => {
          if (journal.has(actor.address)) {
            return journal.get(actor.address);
          }
          executions++;
          const output = await exec();
          journal.set(actor.address, output);
          return output;
        },
        waitForEvent: () => {
          throw new Error('host-driven loop');
        }
      });

    const first = host('exec-1');
    const [, e1] = first.initialTransition({ total: 1500 });
    await first.executeEffects(e1);
    const [done1] = await takeRootEvents(first);
    expect(done1.type).toMatch(/^xstate\.done\.actor/);
    expect(executions).toBe(1);

    // Crash → replay: the body does not re-run, and the journaled
    // completion still matches the replayed child.
    const second = host('exec-1');
    const [s2, e2] = second.initialTransition({ total: 1500 });
    await second.executeEffects(e2);
    expect(executions).toBe(1);
    const [replayed] = second.transition(s2 as never, done1);
    expect((replayed as { value?: unknown }).value).toBe('approved');
  });

  it('a remote-executor host ignores the closure and re-runs from (src, input)', async () => {
    // The Temporal shape: the "activity worker" reconstructs the work from
    // the actor's serializable identity alone — no closure crosses over.
    const workerSide = {
      score: async (input: { total: number }) =>
        input.total > 1000 ? 0.9 : 0.1
    };
    const shipped: Array<{ src: unknown; input: unknown }> = [];
    const durable = createDurable(plainMachine, {
      executionId: 'exec-1',
      executeAction: () => {},
      startActor: (actor) => {
        actor.start();
      },
      runLogic: async (actor) => {
        const input = (actor.getSnapshot() as { input?: unknown }).input;
        shipped.push({ src: actor.src, input });
        expect(() => JSON.stringify({ src: actor.src, input })).not.toThrow();
        return workerSide[actor.src as keyof typeof workerSide](
          input as { total: number }
        );
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [snapshot, effects] = durable.initialTransition({ total: 1500 });
    await durable.executeEffects(effects);
    const [done] = await takeRootEvents(durable);
    expect(shipped).toEqual([{ src: 'score', input: { total: 1500 } }]);
    const [next] = durable.transition(snapshot as never, done);
    expect((next as { value?: unknown }).value).toBe('approved');
  });
});
