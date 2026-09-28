import * as fc from 'fast-check';
import { createMachine, types } from 'xstate';
import {
  ModelTestFailure,
  formatTestStatistics,
  propertyTest,
  testPaths
} from '../src/index.ts';

const counterMachine = createMachine({
  schemas: {
    context: types<{ count: number }>(),
    events: { INC: types<{}>(), RESET: types<{}>() }
  },
  context: { count: 0 },
  on: {
    INC: ({ context }) => ({ context: { count: context.count + 1 } }),
    RESET: () => ({ context: { count: 0 } })
  }
});

const events = { INC: fc.constant({}), RESET: fc.constant({}) };

/** Fails once the count reaches 3, so fast-check has something to shrink. */
const failingOptions = {
  seed: 1,
  numRuns: 50,
  maxCommands: 8,
  events,
  invariant: ({ snapshot }: { snapshot: { context: { count: number } } }) => {
    if (snapshot.context.count >= 3) {
      throw new Error('count reached 3');
    }
  }
};

async function catchFailure(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error as ModelTestFailure;
  }
  throw new Error('Expected the campaign to fail');
}

describe('fast-check reporting options', () => {
  it('calls reporter with the run details', async () => {
    const reports: fc.RunDetails<unknown>[] = [];
    await propertyTest(counterMachine, {
      seed: 1,
      numRuns: 7,
      events,
      reporter: (details) => {
        reports.push(details);
      }
    });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ failed: false, numRuns: 7 });
  });

  it('awaits asyncReporter with the failing run details', async () => {
    const reports: fc.RunDetails<unknown>[] = [];
    await catchFailure(() =>
      propertyTest(counterMachine, {
        ...failingOptions,
        asyncReporter: async (details) => {
          reports.push(details);
        }
      })
    );
    expect(reports).toHaveLength(1);
    expect(reports[0].failed).toBe(true);
  });

  it('appends the fast-check report to the message when verbose is set', async () => {
    const quiet = await catchFailure(() =>
      propertyTest(counterMachine, failingOptions)
    );
    const verbose = await catchFailure(() =>
      propertyTest(counterMachine, { ...failingOptions, verbose: 1 })
    );
    expect(quiet.message).not.toContain('Counterexample:');
    expect(verbose.message).toContain('Counterexample:');
    expect(verbose.message).toContain('Encountered failures were:');
  });
});

describe('statistics', () => {
  it('prints event-case and label distributions after a passing campaign', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { coverage } = await propertyTest(counterMachine, {
        seed: 1,
        numRuns: 20,
        maxCommands: 4,
        events,
        statistics: true,
        invariant: ({ snapshot, classify }) => {
          classify(snapshot.context.count >= 2, 'reached two');
        }
      });
      expect(log).toHaveBeenCalledWith(formatTestStatistics(coverage));
    } finally {
      log.mockRestore();
    }
  });

  it('formats shares of executed events and of runs', async () => {
    const { coverage } = await testPaths(counterMachine, {
      events,
      fromEvents: [{ type: 'INC' }, { type: 'INC' }, { type: 'RESET' }],
      stopWhen: (snapshot) => snapshot.context.count >= 3,
      invariant: ({ label, step }) => label('step', step % 2 ? 'odd' : 'even')
    });
    expect(formatTestStatistics(coverage)).toBe(
      [
        'Test statistics (1 run)',
        '',
        'event cases (share of executed events):',
        '   66.7%  INC / default: 2 executed, 0 ignored',
        '   33.3%  RESET / default: 1 executed, 0 ignored',
        '',
        'labels (share of runs):',
        '  100.0%  step: 4 recorded (even=2, odd=2)'
      ].join('\n')
    );
  });

  it('leaves shrink attempts out of labels and event cases', async () => {
    let created = 0;
    const failure = await catchFailure(() =>
      propertyTest(counterMachine, {
        ...failingOptions,
        sut: {
          create: ({ label }) => {
            created++;
            label('run');
            return { send: () => {} };
          }
        }
      })
    );
    const { exploration, labels, eventCases } = failure.coverage!;
    expect(exploration.shrinkRuns).toBeGreaterThan(0);
    expect(exploration.attemptedRuns).toBe(created);
    expect(labels.run.count).toBe(created - exploration.shrinkRuns);
    expect(labels.run.share).toBe(1);
    const executed = Object.values(eventCases).reduce(
      (total, counts) => total + counts.executed,
      0
    );
    expect(executed).toBeLessThan(failure.coverage!.generatedSteps);
  });
});
