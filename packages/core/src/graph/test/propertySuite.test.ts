import { createMachine } from '../../index.ts';
import {
  describePropertySuite,
  generatePropertySuite,
  parsePropertySuite,
  replayPropertySuite,
  serializePropertySuite
} from '../index.ts';
import { constant, randomAdapter } from './propertyTestAdapter.ts';

const trafficMachine = createMachine({
  id: 'traffic',
  initial: 'red',
  states: {
    red: { on: { NEXT: { target: 'green' }, STOP: { target: 'red' } } },
    green: { on: { NEXT: { target: 'yellow' }, STOP: { target: 'red' } } },
    yellow: { on: { NEXT: { target: 'red' }, STOP: { target: 'red' } } }
  }
});

/** The same machine with `green -> STOP -> red` removed. */
const mutatedMachine = createMachine({
  id: 'traffic',
  initial: 'red',
  states: {
    red: { on: { NEXT: { target: 'green' }, STOP: { target: 'red' } } },
    green: { on: { NEXT: { target: 'yellow' } } },
    yellow: { on: { NEXT: { target: 'red' }, STOP: { target: 'red' } } }
  }
});

/** `STOP` always parks the light on red. */
const invariant = ({ snapshot, event }: { snapshot: any; event: any }) => {
  expect(typeof snapshot.value).toBe('string');
  if (event?.type === 'STOP') {
    expect(snapshot.value).toBe('red');
  }
};

const generate = () =>
  generatePropertySuite(trafficMachine, {
    adapter: randomAdapter({ seed: 7, numRuns: 20, maxCommands: 6 }),
    events: {
      NEXT: constant({}),
      STOP: constant({})
    },
    invariant
  });

describe('generatePropertySuite', () => {
  it('covers every reachable transition with few fixtures', async () => {
    const suite = await generate();

    expect(suite.formatVersion).toBe(1);
    expect(suite.machineId).toBe('traffic');
    expect(suite.generatedAt).toBeUndefined();
    expect(suite.coverage.dimensions.transitions.uncovered).toEqual([]);
    expect(suite.fixtures.length).toBeLessThanOrEqual(4);
    expect(suite.fixtures.length).toBeGreaterThan(0);

    const eventTypes = new Set(
      suite.fixtures.flatMap((fixture) =>
        fixture.timeline.map((entry) =>
          entry.command.type === 'event' ? entry.command.event.type : ''
        )
      )
    );
    expect(eventTypes).toContain('NEXT');
    expect(eventTypes).toContain('STOP');
  });

  it('is deterministic', async () => {
    expect(serializePropertySuite(await generate())).toBe(
      serializePropertySuite(await generate())
    );
  });

  it('keeps every distinct trace with `select: "all"`', async () => {
    const minimal = await generate();
    const all = await generatePropertySuite(trafficMachine, {
      adapter: randomAdapter({ seed: 7, numRuns: 20, maxCommands: 6 }),
      events: { NEXT: constant({}), STOP: constant({}) },
      invariant,
      select: 'all'
    });

    expect(all.fixtures.length).toBeGreaterThan(minimal.fixtures.length);
  });

  it('respects `maxFixtures`', async () => {
    const suite = await generatePropertySuite(trafficMachine, {
      adapter: randomAdapter({ seed: 7, numRuns: 20, maxCommands: 6 }),
      events: { NEXT: constant({}), STOP: constant({}) },
      invariant,
      maxFixtures: 1
    });

    expect(suite.fixtures).toHaveLength(1);
  });

  it('records `generatedAt` when supplied', async () => {
    const suite = await generatePropertySuite(trafficMachine, {
      adapter: randomAdapter({ seed: 7, numRuns: 5, maxCommands: 4 }),
      events: { NEXT: constant({}) },
      invariant,
      generatedAt: '2026-01-01T00:00:00.000Z'
    });

    expect(suite.generatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('replayPropertySuite', () => {
  it('passes against the machine it was generated from', async () => {
    const suite = await generate();
    const result = await replayPropertySuite(trafficMachine, suite, {
      invariant
    });

    expect(result.failed).toEqual([]);
    expect(result.passed).toBe(suite.fixtures.length);
  });

  it('reports failures naming the fixture when the machine changes', async () => {
    const suite = await generate();
    const result = await replayPropertySuite(mutatedMachine, suite, {
      invariant
    });

    expect(result.failed.length).toBeGreaterThan(0);
    expect(result.passed + result.failed.length).toBe(suite.fixtures.length);
    expect(result.failed[0].title).toMatch(/^fixture \d+: /);
    expect(result.failed[0].fixture).toBe(
      suite.fixtures[result.failed[0].index]
    );
  });
});

describe('serializePropertySuite', () => {
  it('round-trips through JSON', async () => {
    const suite = await generate();
    const parsed = parsePropertySuite(serializePropertySuite(suite));

    expect(parsed.fixtures).toEqual(suite.fixtures);
    expect(parsed.machineId).toBe('traffic');

    const result = await replayPropertySuite(trafficMachine, parsed, {
      invariant
    });
    expect(result.failed).toEqual([]);
  });

  it('rejects unknown format versions', () => {
    expect(() =>
      parsePropertySuite(JSON.stringify({ formatVersion: 99, fixtures: [] }))
    ).toThrow(/Unsupported property suite format version: 99/);
  });
});

describe('describePropertySuite', () => {
  it('registers one test per fixture', async () => {
    const suite = await generate();
    const registered: string[] = [];
    const blocks: string[] = [];

    describePropertySuite(suite, trafficMachine, {
      invariant,
      describe: (name, fn) => {
        blocks.push(name);
        fn();
      },
      it: (name) => {
        registered.push(name);
      }
    });

    expect(blocks).toEqual(['property suite (traffic)']);
    expect(registered).toHaveLength(suite.fixtures.length);
    expect(registered[0]).toMatch(/^fixture 1: /);
  });
});

describe('describePropertySuite (vitest globals)', () => {
  it('runs the generated fixtures', async () => {
    const suite = await generate();
    const results: Promise<void>[] = [];

    describePropertySuite(suite, trafficMachine, {
      invariant,
      describe,
      it: (_name, fn) => {
        results.push(Promise.resolve(fn() as Promise<void>));
      }
    });

    await expect(Promise.all(results)).resolves.toBeDefined();
  });
});
