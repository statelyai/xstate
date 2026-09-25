import { createAsyncLogic, createMachine, types } from '../../index.ts';
import {
  ModelTestFailure,
  replayTest,
  testPaths,
  type TestCoverage
} from '../index.ts';
import { constant } from './propertyTestAdapter.ts';

/**
 * Stands in for a payment call. Executed mode stubs every invoke source a path
 * resolves, so this must never run: if it does, the test fails with its own
 * error rather than silently passing on a real service call.
 */
const pay = createAsyncLogic({
  run: async () => {
    throw new Error('the real `pay` actor ran');
  }
});

const checkoutMachine = createMachine({
  id: 'checkout',
  schemas: {
    context: types<{ receipt: unknown; failure: string | null }>(),
    events: { CHECKOUT: types<{}>() }
  },
  actors: { pay },
  context: { receipt: null, failure: null },
  initial: 'shopping',
  states: {
    shopping: { on: { CHECKOUT: { target: 'paying' } } },
    paying: {
      invoke: {
        src: 'pay',
        onDone: ({ context, event }) => ({
          target: 'done',
          context: { ...context, receipt: event.output }
        }),
        onError: ({ context, event }) => ({
          target: 'shopping',
          context: { ...context, failure: String(event.error) }
        })
      }
    },
    done: { type: 'final' }
  }
});

const timerMachine = createMachine({
  id: 'timer',
  initial: 'waiting',
  states: {
    waiting: { after: { 5000: { target: 'expired' } } },
    expired: {}
  }
});

const namedDelayMachine = createMachine({
  id: 'namedTimer',
  initial: 'waiting',
  delays: { long: 1000 },
  states: {
    waiting: { after: { long: { target: 'expired' } } },
    expired: {}
  }
});

const computedDelayMachine = createMachine({
  id: 'computedTimer',
  initial: 'waiting',
  delays: { later: () => 1000 },
  states: {
    waiting: { after: { later: { target: 'expired' } } },
    expired: {}
  }
});

const events = { CHECKOUT: constant({}) };

function covered(coverage: TestCoverage, fragment: string): boolean {
  return coverage.transitions.covered.some((id) => id.includes(fragment));
}

describe('testPaths with invoke and `after` branches', () => {
  it('covers both invoke branches in executed mode', async () => {
    const { coverage, results } = await testPaths(checkoutMachine, {
      mode: 'executed',
      events
    });

    expect(results.every(({ passed }) => passed)).toBe(true);
    expect(covered(coverage, 'xstate.done.actor')).toBe(true);
    expect(covered(coverage, 'xstate.error.actor')).toBe(true);
    expect(coverage.transitions.uncovered).toEqual([]);
    // Every `outcome` command resolved a stub, so the clock never moved.
    expect(coverage.clockAdvances).toBe(0);
  });

  it('routes sampled `outcomes` through the branch that took them', async () => {
    const receipts: unknown[] = [];
    const failures: string[] = [];
    const { coverage } = await testPaths(checkoutMachine, {
      mode: 'executed',
      samples: 1,
      events,
      outcomes: {
        pay: () => ({ ok: true, output: { receiptId: 'rcpt_1' } })
      },
      invariant: ({ snapshot }) => {
        const { receipt, failure } = (
          snapshot as unknown as {
            context: { receipt: unknown; failure: string | null };
          }
        ).context;
        if (receipt !== null) {
          receipts.push(receipt);
        }
        if (failure !== null) {
          failures.push(failure);
        }
      }
    });

    expect(receipts).toContainEqual({ receiptId: 'rcpt_1' });
    // No failing outcome was declared, so the error branch is synthesized.
    expect(failures.some((failure) => /generated failure/.test(failure))).toBe(
      true
    );
    expect(coverage.transitions.uncovered).toEqual([]);
  });

  it('sends the internal events directly in pure mode', async () => {
    const sent: string[] = [];
    const { coverage } = await testPaths(checkoutMachine, {
      events,
      outcomes: {
        pay: () => ({ ok: true, output: { receiptId: 'rcpt_2' } })
      },
      sut: {
        create: () => ({
          send: (event) => {
            sent.push(event.type);
          }
        })
      }
    });

    expect(sent).toContain('xstate.done.actor');
    expect(sent).toContain('xstate.error.actor');
    expect(coverage.transitions.uncovered).toEqual([]);
    expect(coverage.clockAdvances).toBe(0);
  });

  it('rejects an `outcomes` generator that does not produce an outcome', async () => {
    await expect(
      testPaths(checkoutMachine, {
        events,
        outcomes: { pay: () => ({ output: 1 }) }
      } as never)
    ).rejects.toThrow(/instead of an actor outcome/);
  });

  it('reaches an `after` transition with a generated advance', async () => {
    const { coverage } = await testPaths(timerMachine, { mode: 'executed' });

    expect(covered(coverage, 'xstate.after')).toBe(true);
    expect(coverage.transitions.uncovered).toEqual([]);
    expect(coverage.clockAdvances).toBe(1);
  });

  it('resolves a named delay from the machine', async () => {
    const { coverage } = await testPaths(namedDelayMachine, {
      mode: 'executed'
    });

    expect(covered(coverage, 'xstate.after')).toBe(true);
    expect(coverage.transitions.uncovered).toEqual([]);
  });

  it('advances to a delay computed at runtime', async () => {
    // Executed mode reads the due time off the actor's scheduled timer, so
    // the delay does not have to be a number in the machine config.
    const { coverage, results } = await testPaths(computedDelayMachine, {
      mode: 'executed'
    });

    expect(results.every(({ passed }) => passed)).toBe(true);
    expect(covered(coverage, 'xstate.after')).toBe(true);
  });

  it('replays an executed path fixture without the real service', async () => {
    const failing = {
      mode: 'executed' as const,
      events,
      sut: {
        create: () => ({
          send: () => {},
          read: () => 'wrong',
          states: undefined
        }),
        projectModel: () => 'right'
      }
    };
    const failure = (await testPaths(checkoutMachine, failing).catch(
      (error) => error
    )) as ModelTestFailure;

    expect(failure).toBeInstanceOf(ModelTestFailure);
    expect(failure.fixture).toBeDefined();
    expect(failure.coverage?.exploration.strategy).toBe('paths');

    await expect(
      replayTest(checkoutMachine, failure.fixture!, {
        sut: failing.sut
      })
    ).rejects.toBeInstanceOf(ModelTestFailure);
  });
});
