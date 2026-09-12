import * as fc from 'fast-check';
import { createMachine, types } from 'xstate';
import {
  PropertyTestFailure,
  propertyTest,
  replayPropertyTest,
  type PropertyTrace
} from 'xstate/graph';
import { fastCheckAdapter } from '../src/index.ts';

const counterMachine = createMachine({
  id: 'searchCounter',
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

const events = {
  INC: fc.constant({}),
  DEC: fc.constant({}),
  RESET: fc.constant({})
};

const noop = () => {};

describe('swarm testing with fast-check', () => {
  it('is deterministic and leaves cases out of individual runs', async () => {
    const run = async () => {
      const swarms: string[][] = [];
      const { coverage } = await propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 42, numRuns: 20, maxCommands: 5 }),
        events,
        swarm: { seed: 9 },
        invariant: noop,
        collect: (trace: PropertyTrace<any, any>) => {
          swarms.push([...(trace.swarm ?? [])]);
        }
      });
      return { swarms, coverage };
    };

    const first = await run();
    const second = await run();

    expect(first.swarms).toEqual(second.swarms);
    expect(first.swarms.every((swarm) => swarm.length >= 2)).toBe(true);
    expect(first.swarms.some((swarm) => swarm.length < 3)).toBe(true);
    expect(first.coverage.exploration.swarm!.runs).toBe(20);
    expect(first.coverage.exploration.swarm!.averageEnabled).toBeLessThan(3);
  });

  it('keeps shrinking to a minimal counterexample', async () => {
    const failure = await propertyTest(counterMachine, {
      adapter: fastCheckAdapter({ seed: 3, numRuns: 200, maxCommands: 12 }),
      events,
      swarm: true,
      invariant: ({ snapshot }) => {
        expect((snapshot as any).context.count).toBeLessThan(3);
      }
    }).then(
      () => undefined,
      (error) => error as PropertyTestFailure<any, any>
    );

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    const fixture = failure!.fixture!;
    // The shrunk counterexample is three increments and nothing else.
    expect(fixture.timeline).toHaveLength(3);
    expect(
      fixture.timeline.every(
        (entry) =>
          entry.command.type === 'event' && entry.command.event.type === 'INC'
      )
    ).toBe(true);
    // The run's swarm subset is recorded, and it kept `INC` enabled.
    expect(fixture.swarm!.some((caseId) => caseId.includes('INC'))).toBe(true);

    await expect(
      replayPropertyTest(counterMachine, fixture, {
        invariant: ({ snapshot }) => {
          expect((snapshot as any).context.count).toBeLessThan(3);
        }
      })
    ).rejects.toThrow(/count/);
  });
});

describe('targeted search with fast-check', () => {
  it('reaches a deeper counter value than random exploration', async () => {
    const campaign = (frontiers?: { strategy: 'target' }) =>
      propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 4, maxCommands: 6 }),
        events: { INC: fc.constant({}), DEC: fc.constant({}) },
        target: ({ snapshot }) => (snapshot as any).context.count,
        frontiers,
        invariant: noop,
        until: (coverage) => coverage.exploration.target.best >= 8,
        batchRuns: 10,
        maxRuns: 60
      });

    const random = await campaign();
    expect(random.coverage.exploration.target.best).toBeLessThan(8);

    const targeted = await campaign({ strategy: 'target' });
    expect(targeted.coverage.exploration.target.best).toBeGreaterThanOrEqual(8);
    expect(targeted.coverage.exploration.stoppedBecause).toBe('until');
  });
});
