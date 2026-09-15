import * as fc from 'fast-check';
import { createMachine, types } from 'xstate';
import { propertyTest } from 'xstate/graph';
import { fastCheckAdapter } from '../src/index.ts';

const lightMachine = createMachine({
  id: 'p1-light',
  schemas: {
    events: {
      NEXT: types<{}>(),
      RESET: types<{}>()
    }
  },
  initial: 'green',
  states: {
    green: { on: { NEXT: { target: 'yellow' } } },
    yellow: { on: { NEXT: { target: 'red' } } },
    red: {
      on: {
        NEXT: { target: 'green' },
        RESET: { target: 'green' }
      }
    }
  }
});

function pairIds(covered: readonly string[]): string[] {
  return covered.filter((id) => id.includes(' -> '));
}

describe('transition pair coverage', () => {
  it('declares the statically possible pairs and reports which ran', async () => {
    const { coverage } = await propertyTest(lightMachine, {
      adapter: fastCheckAdapter({ seed: 7, numRuns: 40, maxCommands: 4 }),
      events: { NEXT: fc.constant({}) },
      invariant: () => {}
    });

    const pairs = coverage.transitionPairs;
    expect(pairs.truncated).toBe(false);
    // green -NEXT-> yellow followed by yellow -NEXT-> red.
    const greenNext = JSON.stringify([
      'transition',
      'p1-light.green',
      'NEXT',
      0
    ]);
    const yellowNext = JSON.stringify([
      'transition',
      'p1-light.yellow',
      'NEXT',
      0
    ]);
    const redReset = JSON.stringify(['transition', 'p1-light.red', 'RESET', 0]);
    expect(pairs.covered).toContain(`${greenNext} -> ${yellowNext}`);
    // `RESET` was never generated, so no pair leading out of it ran.
    expect(pairs.covered.some((id) => id.includes(redReset))).toBe(false);
    expect(pairs.uncovered.some((id) => id.includes(redReset))).toBe(true);
    // Impossible orderings are not part of the universe at all.
    const all = [
      ...pairs.covered,
      ...pairs.uncovered,
      ...pairs.unreachable,
      ...pairs.unknown
    ];
    expect(all).not.toContain(`${greenNext} -> ${greenNext}`);
    expect(pairIds(all).length).toBe(all.length);
  });

  it('counts pairs within a run only', async () => {
    const { coverage } = await propertyTest(lightMachine, {
      adapter: fastCheckAdapter({ seed: 3, numRuns: 5, maxCommands: 1 }),
      events: { NEXT: fc.constant({}) },
      invariant: () => {}
    });

    // With one generated command per run every run performs the initial
    // transition plus one event, so no run can chain two event transitions.
    const greenNext = JSON.stringify([
      'transition',
      'p1-light.green',
      'NEXT',
      0
    ]);
    const yellowNext = JSON.stringify([
      'transition',
      'p1-light.yellow',
      'NEXT',
      0
    ]);
    expect(
      coverage.transitionPairs.counts[`${greenNext} -> ${yellowNext}`]
    ).toBe(undefined);
  });
});

describe('requirement coverage', () => {
  const requirementMachine = createMachine({
    id: 'p1-req',
    schemas: {
      events: { GO: types<{}>(), SKIP: types<{}>() },
      meta: types<{ requirements: string | string[] }>()
    },
    initial: 'idle',
    states: {
      idle: {
        meta: { requirements: 'REQ-START' },
        on: {
          GO: {
            target: 'active',
            meta: { requirements: ['REQ-GO', 'REQ-ANY'] }
          },
          SKIP: { target: 'done', meta: { requirements: 'REQ-SKIP' } }
        }
      },
      active: { meta: { requirements: ['REQ-ACTIVE'] } },
      done: {}
    }
  });

  it('declares requirements from state node and transition meta', async () => {
    const { coverage } = await propertyTest(requirementMachine, {
      adapter: fastCheckAdapter({ seed: 11, numRuns: 20, maxCommands: 2 }),
      events: { GO: fc.constant({}) },
      invariant: () => {}
    });

    const requirements = coverage.requirements;
    expect(
      [
        ...requirements.covered,
        ...requirements.uncovered,
        ...requirements.unreachable,
        ...requirements.unknown
      ].sort()
    ).toEqual(['REQ-ACTIVE', 'REQ-ANY', 'REQ-GO', 'REQ-SKIP', 'REQ-START']);
    expect(requirements.covered).toContain('REQ-START');
    expect(requirements.covered).toContain('REQ-GO');
    expect(requirements.covered).toContain('REQ-ANY');
    expect(requirements.covered).toContain('REQ-ACTIVE');
    // `SKIP` was never generated.
    expect(requirements.uncovered).toContain('REQ-SKIP');
    expect(requirements.sources['REQ-START']).toEqual([
      'stateNode:p1-req.idle'
    ]);
    expect(requirements.sources['REQ-GO']).toEqual([
      `transition:${JSON.stringify(['transition', 'p1-req.idle', 'GO', 0])}`
    ]);
  });
});

describe('event weights', () => {
  const weightMachine = createMachine({
    id: 'p1-weight',
    schemas: {
      context: types<{ a: number; b: number }>(),
      events: { A: types<{}>(), B: types<{}>() }
    },
    context: { a: 0, b: 0 },
    on: {
      A: ({ context }) => ({ context: { ...context, a: context.a + 1 } }),
      B: ({ context }) => ({ context: { ...context, b: context.b + 1 } })
    }
  });

  it('skews generation toward heavier cases', async () => {
    const { coverage } = await propertyTest(weightMachine, {
      adapter: fastCheckAdapter({ seed: 99, numRuns: 50, maxCommands: 20 }),
      events: {
        A: { generate: fc.constant({}), weight: 0.01 },
        B: { generate: fc.constant({}), weight: 100 }
      },
      invariant: () => {}
    });

    const a =
      coverage.eventCases[JSON.stringify(['event-case', 'A', 'default'])]!;
    const b =
      coverage.eventCases[JSON.stringify(['event-case', 'B', 'default'])]!;
    expect(a.weight).toBe(0.01);
    expect(b.weight).toBe(100);
    expect(b.generated).toBeGreaterThan(a.generated * 10);
  });

  it('defaults to weight 1 and keeps the unweighted generation path', async () => {
    const run = (
      events: Parameters<typeof propertyTest>[1]['events']
    ): Promise<{ coverage: any }> =>
      propertyTest(weightMachine, {
        adapter: fastCheckAdapter({ seed: 5, numRuns: 25, maxCommands: 10 }),
        events: events as any,
        invariant: () => {}
      });

    const bare = await run({ A: fc.constant({}), B: fc.constant({}) } as any);
    const explicit = await run({
      A: { generate: fc.constant({}), weight: 1 },
      B: { generate: fc.constant({}), weight: 1 }
    } as any);

    expect(bare.coverage.eventCases).toEqual(explicit.coverage.eventCases);
    expect(bare.coverage.steps).toBe(explicit.coverage.steps);
  });

  it('rejects non-positive weights', async () => {
    await expect(
      propertyTest(weightMachine, {
        adapter: fastCheckAdapter({ seed: 1, numRuns: 1 }),
        events: { A: { generate: fc.constant({}), weight: 0 } },
        invariant: () => {}
      })
    ).rejects.toThrow(/weight/);
  });
});
