import { createMachine } from '../../index.ts';
import {
  assertPropertyCoverage,
  formatPropertyCoverage,
  formatPropertyCoverageHTML,
  formatPropertyCoverageJUnit,
  propertyCoverageToJSON,
  propertyTest,
  type PropertyCoverage
} from '../index.ts';
import { constant, randomAdapter } from './propertyTestAdapter.ts';

const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      on: { NEXT: { target: 'yellow' } }
    },
    yellow: {
      on: { NEXT: { target: 'green' } }
    },
    // Never targeted: reported as unreachable.
    broken: {
      on: { NEXT: { target: 'green' } }
    }
  }
});

async function getCoverage(): Promise<PropertyCoverage> {
  const { coverage } = await propertyTest(lightMachine, {
    adapter: randomAdapter({ seed: 1, numRuns: 3, maxCommands: 3 }),
    events: { NEXT: constant({}) },
    invariant: () => {}
  });
  return coverage;
}

describe('property coverage reports', () => {
  it('formats coverage as text', async () => {
    const text = formatPropertyCoverage(await getCoverage());

    expect(text).toContain('Property coverage');
    expect(text).toMatch(/stateNodes: \d+\/\d+ covered \(\d+\.\d%\)/);
    expect(text).toContain('unreachable stateNodes:');
    expect(text).toContain('light.broken');
    expect(text).toContain('exploration:');
    expect(text).toContain('runs: configured 3, completed 3, attempted 3');
  });

  it('formats coverage as markdown tables', async () => {
    const markdown = formatPropertyCoverage(await getCoverage(), {
      format: 'markdown'
    });

    expect(markdown).toContain('# Property coverage');
    expect(markdown).toContain(
      '| Dimension | Covered | Total | Ratio | Uncovered | Unreachable | Unknown |'
    );
    expect(markdown).toContain('## Outstanding');
    expect(markdown).toContain('| stateNodes | unreachable | light.broken |');
    expect(markdown).toContain('## Exploration');
  });

  it('renders transition ids readably', async () => {
    const text = formatPropertyCoverage(await getCoverage());

    expect(text).toContain('--NEXT--> #0');
  });

  it('produces stable JSON that round-trips', async () => {
    const coverage = await getCoverage();
    const json = propertyCoverageToJSON(coverage);

    expect(json.formatVersion).toBe(1);
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
    expect(json.totals.runs).toBe(coverage.runs);
    expect(json.dimensions.stateNodes.total).toBe(
      coverage.stateNodes.covered.length +
        coverage.stateNodes.uncovered.length +
        coverage.stateNodes.unreachable.length +
        coverage.stateNodes.unknown.length
    );
    expect(json.dimensions.stateNodes.unreachable).toContain('light.broken');
    expect(json.exploration.completedRuns).toBe(3);
  });

  it('produces JUnit XML with one testcase per transition and state node', async () => {
    const coverage = await getCoverage();
    const xml = formatPropertyCoverageJUnit(coverage, { suiteName: 'light' });

    const expectedTests = [coverage.transitions, coverage.stateNodes].reduce(
      (total, dimension) =>
        total +
        dimension.covered.length +
        dimension.uncovered.length +
        dimension.unreachable.length +
        dimension.unknown.length,
      0
    );
    const expectedFailures =
      coverage.transitions.uncovered.length +
      coverage.stateNodes.uncovered.length;
    const expectedSkipped =
      coverage.transitions.unreachable.length +
      coverage.transitions.unknown.length +
      coverage.stateNodes.unreachable.length +
      coverage.stateNodes.unknown.length;

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      `<testsuite name="light" tests="${expectedTests}" failures="${expectedFailures}" skipped="${expectedSkipped}">`
    );
    expect(xml.match(/<testcase /g)!.length).toBe(expectedTests);
    expect(xml.match(/<failure /g)?.length ?? 0).toBe(expectedFailures);
    expect(xml.match(/<skipped /g)?.length ?? 0).toBe(expectedSkipped);
    expect(xml).toContain('classname="stateNodes"');
    expect(xml).toContain('<property name="exploration.0"');
    // `>` in a transition id must be XML-escaped.
    expect(xml).toContain('--NEXT--&gt; #0');
    expect(xml).not.toContain('--NEXT--> #0');
  });

  it('produces self-contained HTML', async () => {
    const html = formatPropertyCoverageHTML(await getCoverage(), {
      title: 'Light coverage'
    });

    expect(html).toContain('<title>Light coverage</title>');
    expect(html).toContain('<h1>Light coverage</h1>');
    expect(html).toContain('3 runs');
    expect(html).toContain('light.broken');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('http://');
  });

  it('passes and fails coverage thresholds', async () => {
    const coverage = await getCoverage();

    expect(() =>
      assertPropertyCoverage(coverage, { stateNodes: 1, transitions: 1 })
    ).not.toThrow();

    const starved: PropertyCoverage = {
      ...coverage,
      stateNodes: {
        ...coverage.stateNodes,
        covered: [],
        uncovered: [...coverage.stateNodes.covered]
      }
    };

    expect(() => assertPropertyCoverage(starved, { stateNodes: 0.5 })).toThrow(
      /stateNodes: 0\.0% covered, below the 50\.0% threshold/
    );
    expect(() => assertPropertyCoverage(starved, { stateNodes: 0.5 })).toThrow(
      /Property coverage/
    );
  });
});
