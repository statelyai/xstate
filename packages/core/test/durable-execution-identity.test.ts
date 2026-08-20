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
    const events1 = await first.executeEffects(e1);

    const second = createHost(steps, 'exec-1');
    const [s2, e2] = second.initialTransition();
    const events2 = await second.executeEffects(e2);

    expect(events1.map(({ event }) => event)).toEqual(
      events2.map(({ event }) => event)
    );
    const sessionId = (events1[0]!.event as { sessionId?: string }).sessionId;
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
    const [journaled] = await first.executeEffects(effects1);
    expect(journaled!.event.type).toMatch(/^xstate\.done\.actor/);

    // Crash. Replay from the beginning in a "fresh process": same journal,
    // same executionId. The replayed step returns its memoized result, and
    // the recorded completion event — carrying run 1's sessionId — must
    // match the child the replay just re-created.
    const second = createHost(steps, 'exec-1');
    const [snapshot2, effects2] = second.initialTransition();
    await second.executeEffects(effects2);
    const [replayed] = second.transition(snapshot2 as never, journaled!.event);
    expect((replayed as { value?: unknown }).value).toBe('approved');
    void snapshot1;
  });

  it('without an executionId, journaled completions go stale across replays', async () => {
    const steps = new Map<string, unknown>();
    const first = createHost(steps);
    const [, effects1] = first.initialTransition();
    const [journaled] = await first.executeEffects(effects1);

    const second = createHost(steps);
    const [snapshot2, effects2] = second.initialTransition();
    await second.executeEffects(effects2);
    const [replayed] = second.transition(snapshot2 as never, journaled!.event);
    // The recorded sessionId embeds run 1's random system id, so the
    // completion is dropped as stale — the documented reason to pin
    // executionId on journaling hosts.
    expect((replayed as { value?: unknown }).value).toBe('verifying');
  });
});
