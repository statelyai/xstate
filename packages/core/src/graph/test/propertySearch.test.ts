import { createMachine, types } from '../../index.ts';
import { propertyTest, type PropertyTrace } from '../index.ts';
import { constant, randomAdapter } from './propertyTestAdapter.ts';

const counterMachine = createMachine({
  id: 'counter',
  schemas: {
    context: types<{ count: number }>(),
    events: {
      INC: types<{}>(),
      DEC: types<{}>(),
      RESET: types<{}>()
    }
  },
  context: { count: 0 },
  on: {
    INC: ({ context }) => ({ context: { count: context.count + 1 } }),
    DEC: ({ context }) => ({ context: { count: context.count - 1 } }),
    RESET: () => ({ context: { count: 0 } })
  }
});

const noop = () => {};

async function collectSwarmSets(seed: number): Promise<string[][]> {
  const swarms: string[][] = [];
  await propertyTest(counterMachine, {
    adapter: randomAdapter({ seed: 7, numRuns: 12, maxCommands: 4 }),
    events: {
      INC: constant({}),
      DEC: constant({}),
      RESET: constant({})
    },
    swarm: { seed },
    invariant: noop,
    collect: (trace: PropertyTrace<any, any>) => {
      swarms.push([...(trace.swarm ?? [])]);
    }
  });
  return swarms;
}

describe('swarm testing', () => {
  it('picks the same enabled sets for the same seed', async () => {
    const first = await collectSwarmSets(3);
    const second = await collectSwarmSets(3);
    const other = await collectSwarmSets(11);

    expect(first).toHaveLength(12);
    expect(first).toEqual(second);
    expect(other).not.toEqual(first);
  });

  it('excludes event cases from individual runs', async () => {
    const swarms: string[][] = [];
    const { coverage } = await propertyTest(counterMachine, {
      adapter: randomAdapter({ seed: 5, numRuns: 20, maxCommands: 6 }),
      events: {
        INC: constant({}),
        DEC: constant({}),
        RESET: constant({})
      },
      swarm: true,
      invariant: noop,
      collect: (trace: PropertyTrace<any, any>) => {
        swarms.push([...(trace.swarm ?? [])]);
      }
    });

    // `minCases` defaults to half of the three declared cases, rounded up.
    expect(swarms.every((swarm) => swarm.length >= 2)).toBe(true);
    expect(swarms.some((swarm) => swarm.length < 3)).toBe(true);
    expect(coverage.exploration.swarm).toEqual({
      runs: 20,
      averageEnabled: expect.any(Number)
    });
    expect(coverage.exploration.swarm!.averageEnabled).toBeLessThan(3);
    expect(coverage.exploration.swarm!.averageEnabled).toBeGreaterThanOrEqual(
      2
    );

    // Excluded cases are generated but never applicable in those runs.
    const cases = Object.values(coverage.eventCases);
    expect(cases.some((counts) => counts.applicable < counts.generated)).toBe(
      true
    );
  });

  it('reports no swarm statistics when it is not enabled', async () => {
    const { coverage } = await propertyTest(counterMachine, {
      adapter: randomAdapter({ seed: 5, numRuns: 4, maxCommands: 4 }),
      events: { INC: constant({}) },
      invariant: noop
    });

    expect(coverage.exploration.swarm).toBeNull();
  });
});

describe('targeted search', () => {
  const MAX_COMMANDS = 6;
  const events = {
    INC: constant({}),
    DEC: constant({})
  };
  const target = ({ snapshot }: { snapshot: any }): number =>
    snapshot.context.count;

  it('records the best observed value', async () => {
    const { coverage } = await propertyTest(counterMachine, {
      adapter: randomAdapter({ seed: 2, numRuns: 10, maxCommands: 4 }),
      events,
      invariant: ({ snapshot, target: observe }) => {
        observe((snapshot as any).context.count, 'count');
      }
    });

    expect(coverage.exploration.target.improvements).toBeGreaterThan(0);
    expect(coverage.exploration.target.label).toBe('count');
    expect(coverage.exploration.target.best).toBeGreaterThan(0);
  });

  it('climbs deeper than random exploration on the same budget', async () => {
    const randomCampaign = await propertyTest(counterMachine, {
      adapter: randomAdapter({ seed: 1, maxCommands: MAX_COMMANDS }),
      events,
      target,
      invariant: noop,
      until: (coverage) => coverage.exploration.target.best >= 8,
      batchRuns: 10,
      maxRuns: 60
    });

    // No single random run can reach 8 with at most 6 commands.
    expect(randomCampaign.coverage.exploration.target.best).toBeLessThan(8);
    expect(randomCampaign.coverage.exploration.stoppedBecause).toBe('budget');

    const targeted = await propertyTest(counterMachine, {
      adapter: randomAdapter({ seed: 1, maxCommands: MAX_COMMANDS }),
      events,
      target,
      frontiers: { strategy: 'target' },
      invariant: noop,
      until: (coverage) => coverage.exploration.target.best >= 8,
      batchRuns: 10,
      maxRuns: 60
    });

    expect(targeted.coverage.exploration.target.best).toBeGreaterThanOrEqual(8);
    expect(targeted.coverage.exploration.stoppedBecause).toBe('until');
    expect(targeted.coverage.exploration.completedRuns).toBeLessThanOrEqual(60);
  });
});
