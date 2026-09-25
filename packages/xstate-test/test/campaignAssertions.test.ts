import * as fc from 'fast-check';
import { createMachine, types } from 'xstate';
import {
  ModelTestFailure,
  TestCampaignError,
  formatTestCoverage,
  propertyTest,
  testPaths
} from '../src/index.ts';

const doorMachine = createMachine({
  id: 'door',
  schemas: {
    context: types<{ opened: number }>(),
    events: { OPEN: types<{}>(), CLOSE: types<{}>(), LOCK: types<{}>() }
  },
  context: { opened: 0 },
  initial: 'closed',
  states: {
    closed: {
      tags: ['shut'],
      on: {
        OPEN: ({ context }) => ({
          target: 'open',
          context: { opened: context.opened + 1 }
        }),
        LOCK: { target: 'locked' }
      }
    },
    open: { on: { CLOSE: { target: 'closed' } } },
    locked: { tags: ['shut'] },
    // Nothing transitions here.
    broken: {}
  }
});

const events = {
  OPEN: fc.constant({}),
  CLOSE: fc.constant({}),
  LOCK: fc.constant({})
};

async function catchError(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the campaign to fail');
}

describe('sometimes', () => {
  it('passes when one run satisfies it, and counts runs', async () => {
    const { coverage } = await propertyTest(doorMachine, {
      seed: 1,
      numRuns: 20,
      maxCommands: 4,
      events,
      temporal: [
        {
          type: 'sometimes',
          id: 'opened-twice',
          predicate: ({ snapshot }) => snapshot.context.opened >= 2
        }
      ]
    });
    const counts = coverage.temporal.counts['opened-twice'];
    expect(counts.satisfied).toBeGreaterThan(0);
    expect(counts.inconclusive).toBeGreaterThan(0);
    expect(counts.satisfied + counts.inconclusive).toBe(20);
    expect(coverage.temporal.satisfied).toEqual(['opened-twice']);
    expect(coverage.temporal.inconclusive).toEqual([]);
  });

  it('fails the campaign when no run satisfies it', async () => {
    const error = (await catchError(() =>
      propertyTest(doorMachine, {
        seed: 1,
        numRuns: 10,
        maxCommands: 3,
        events,
        temporal: [
          {
            type: 'sometimes',
            id: 'opened-five-times',
            predicate: ({ snapshot }) => snapshot.context.opened >= 5
          }
        ]
      })
    )) as TestCampaignError;
    expect(error).toBeInstanceOf(TestCampaignError);
    expect(error.message).toBe(
      'Campaign assertions failed:\n  - sometimes "opened-five-times" did not hold in 10 run(s)'
    );
    expect(error.coverage.temporal.failed).toEqual(['opened-five-times']);
    expect(error.coverage.temporal.inconclusive).toEqual([]);
    expect(error.coverage.temporal.counts['opened-five-times']).toEqual({
      satisfied: 0,
      failed: 0,
      inconclusive: 10
    });
    expect(formatTestCoverage(error.coverage)).toContain(
      '  - opened-five-times: 0 satisfied, 0 failed, 10 inconclusive (never held)'
    );
  });
});

describe('reachable', () => {
  it('accepts state values, state node ids, and tags', async () => {
    const { coverage } = await propertyTest(doorMachine, {
      seed: 1,
      numRuns: 20,
      maxCommands: 4,
      events,
      reachable: ['open', '#door.locked', 'shut']
    });
    expect(coverage.temporal.satisfied).toEqual([
      'reachable:#door.locked',
      'reachable:open',
      'reachable:shut'
    ]);
  });

  it('lists the targets no run entered, in both entry points', async () => {
    for (const run of [
      () =>
        propertyTest(doorMachine, {
          seed: 1,
          numRuns: 10,
          maxCommands: 4,
          events,
          reachable: ['open', '#door.broken']
        }),
      () =>
        testPaths(doorMachine, {
          events,
          stopWhen: (snapshot) => snapshot.context.opened >= 2,
          reachable: ['open', '#door.broken']
        })
    ]) {
      const error = (await catchError(run)) as TestCampaignError;
      expect(error).toBeInstanceOf(TestCampaignError);
      expect(error.failures).toEqual([
        expect.stringMatching(
          /^reachable "#door.broken" was not entered in \d+ run\(s\)$/
        )
      ]);
    }
  });
});

describe('respond', () => {
  it('fails when a trigger is not answered within the bound', async () => {
    const failure = (await catchError(() =>
      propertyTest(doorMachine, {
        seed: 1,
        numRuns: 50,
        maxCommands: 6,
        events,
        temporal: [
          {
            type: 'respond',
            id: 'closes-again',
            within: 1,
            trigger: ({ snapshot }) => snapshot.matches('open'),
            response: ({ snapshot }) => snapshot.matches('closed')
          }
        ]
      })
    )) as ModelTestFailure;
    expect(failure).toBeInstanceOf(ModelTestFailure);
    expect(failure.summary).toBe('Temporal property "closes-again" failed');
    expect(failure.fixture?.temporalFailure).toMatchObject({
      type: 'respond',
      id: 'closes-again',
      within: 1
    });
    // Shrunk to: open, then one step that does not close.
    expect(failure.trace.steps.map((step) => step.event.type)).toEqual([
      'OPEN',
      expect.stringMatching(/OPEN|LOCK/)
    ]);
  });

  it('counts the response on the trigger step, and is inconclusive when the run ends first', async () => {
    const { coverage } = await propertyTest(doorMachine, {
      seed: 1,
      numRuns: 30,
      maxCommands: 4,
      events: { OPEN: fc.constant({}), CLOSE: fc.constant({}) },
      temporal: [
        {
          type: 'respond',
          id: 'opened-counts',
          within: 0,
          trigger: ({ event }) => event?.type === 'OPEN',
          response: ({ snapshot }) => snapshot.context.opened > 0
        },
        {
          type: 'respond',
          id: 'closes-within-3',
          within: 3,
          trigger: ({ snapshot }) => snapshot.matches('open'),
          response: ({ snapshot }) => snapshot.matches('closed')
        }
      ]
    });
    expect(coverage.temporal.counts['opened-counts']).toMatchObject({
      satisfied: 30,
      failed: 0
    });
    expect(coverage.temporal.counts['closes-within-3'].failed).toBe(0);
  });

  it('fails at the end of the run without within', async () => {
    const failure = (await catchError(() =>
      propertyTest(doorMachine, {
        seed: 1,
        numRuns: 20,
        maxCommands: 3,
        events,
        temporal: [
          {
            type: 'respond',
            id: 'closes-eventually',
            trigger: ({ snapshot }) => snapshot.matches('open'),
            response: ({ snapshot }) => snapshot.matches('closed')
          }
        ]
      })
    )) as ModelTestFailure;
    expect(failure.summary).toBe(
      'Temporal property "closes-eventually" failed'
    );
    expect(failure.trace.steps.map((step) => step.event.type)).toEqual([
      'OPEN'
    ]);
  });
});

describe('vacuity warnings', () => {
  const eventually = {
    type: 'eventually' as const,
    id: 'opens',
    within: 50,
    predicate: ({
      snapshot
    }: {
      snapshot: { matches: (v: 'open') => boolean };
    }) => snapshot.matches('open')
  };

  it('warns when within exceeds maxCommands', async () => {
    const { coverage } = await propertyTest(doorMachine, {
      seed: 1,
      numRuns: 5,
      maxCommands: 4,
      events,
      temporal: [eventually]
    });
    expect(coverage.temporal.warnings).toEqual([
      'eventually "opens" has within 50, but the longest sequence is 4 steps, so it can never fail'
    ]);
    expect(formatTestCoverage(coverage)).toContain(
      '  warning: eventually "opens" has within 50'
    );
  });

  it('warns when within exceeds the longest path', async () => {
    const { coverage } = await testPaths(doorMachine, {
      events,
      stopWhen: (snapshot) => snapshot.context.opened >= 2,
      temporal: [
        { ...eventually, id: 'soon', within: 1, predicate: () => true },
        { ...eventually, id: 'late' }
      ]
    });
    expect(coverage.temporal.warnings).toEqual([
      expect.stringMatching(
        /^eventually "late" has within 50, but the longest sequence is \d steps/
      )
    ]);
  });

  it('reports an id inconclusive in every run as inconclusive', async () => {
    const { coverage } = await propertyTest(doorMachine, {
      seed: 1,
      numRuns: 5,
      maxCommands: 2,
      events: { LOCK: fc.constant({}) },
      temporal: [eventually]
    });
    expect(coverage.temporal.inconclusive).toEqual(['opens']);
    expect(coverage.temporal.counts.opens).toEqual({
      satisfied: 0,
      failed: 0,
      inconclusive: 5
    });
  });
});
