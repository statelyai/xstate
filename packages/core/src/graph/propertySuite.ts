/**
 * Offline property suites.
 *
 * A property suite is a deterministic, coverage-preserving set of replay
 * fixtures recorded from a passing `propertyTest()` campaign. It can be
 * committed and replayed in CI with `replayPropertySuite()` (or registered as
 * individual test cases with `describePropertySuite()`) without the generator
 * adapter — and therefore without `fast-check` — being installed.
 */
import type {
  ActorLogic,
  EventObject,
  InputFrom,
  Snapshot,
  SnapshotFrom
} from '../index.ts';
import type { TestModel } from './TestModel.ts';
import {
  propertyCoverageToJSON,
  type PropertyCoverageJSON
} from './propertyReport.ts';
import {
  propertyTest,
  replayPropertyTest,
  type PortablePropertyReplayFixture,
  type PortablePropertyTimelineEntry,
  type PropertyGeneratorKind,
  type PropertyInvariant,
  type PropertyReferenceOracle,
  type PropertySut,
  type PropertyTemporal,
  type PropertyTestModelExecution,
  type PropertyTestOptions,
  type PropertyTrace
} from './propertyTest.ts';

export interface PropertySuite {
  readonly formatVersion: 1;
  readonly machineId?: string;
  readonly machineVersion?: string;
  /** ISO timestamp, only present when `generatedAt` was supplied. */
  readonly generatedAt?: string;
  readonly fixtures: readonly PortablePropertyReplayFixture[];
  readonly coverage: PropertyCoverageJSON;
}

type LogicFromSource<TSource> =
  TSource extends TestModel<infer TSnapshot, infer TEvent, infer TInput>
    ? ActorLogic<TSnapshot, TEvent, TInput>
    : TSource;

type SnapshotFromSource<TSource> = SnapshotFrom<LogicFromSource<TSource>>;
type EventFromSource<TSource> =
  LogicFromSource<TSource> extends ActorLogic<any, infer TEvent, any>
    ? TEvent
    : never;
type InputFromSource<TSource> = InputFrom<LogicFromSource<TSource>>;

export interface GeneratePropertySuiteOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TKind extends PropertyGeneratorKind
> extends PropertyTestOptions<TSnapshot, TEvent, TInput, TKind> {
  /**
   * `'minimal'` (the default) keeps the smallest greedy subset of recorded
   * traces that preserves the campaign's covered set. `'all'` keeps every
   * distinct trace.
   */
  readonly select?: 'minimal' | 'all';
  /** Upper bound on the number of fixtures kept. */
  readonly maxFixtures?: number;
  /** Recorded verbatim as `generatedAt`. Omit to keep the suite byte-stable. */
  readonly generatedAt?: string;
}

interface Candidate {
  readonly fixture: PortablePropertyReplayFixture;
  readonly elements: readonly string[];
  readonly key: string;
  readonly length: number;
}

/** The transition, state node and guard ids a single trace exercised. */
function getTraceElements<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(trace: PropertyTrace<TSnapshot, TEvent>): string[] {
  const elements = new Set<string>();
  for (const id of trace.initialTransitionIds) {
    elements.add(`transition:${id}`);
  }
  for (const id of trace.initialGuardIds) {
    elements.add(`guard:${id}`);
  }
  for (const entry of trace.timeline) {
    for (const id of entry.transitionIds) {
      elements.add(`transition:${id}`);
    }
    for (const id of entry.guardIds) {
      elements.add(`guard:${id}`);
    }
    if (entry.kind === 'event') {
      for (const id of entry.activeStateIds) {
        elements.add(`stateNode:${id}`);
      }
    }
  }
  return [...elements].sort();
}

function toSuiteFixture<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  trace: PropertyTrace<TSnapshot, TEvent>,
  machine: { readonly id?: string; readonly version?: string } | undefined,
  serializeStartingSnapshot: ((snapshot: TSnapshot) => unknown) | undefined
): PortablePropertyReplayFixture {
  if (trace.start.type === 'snapshot' && !serializeStartingSnapshot) {
    throw new Error(
      'Property suites starting from a snapshot require start.serializeSnapshot'
    );
  }
  return {
    formatVersion: 2,
    machine,
    start:
      trace.start.type === 'snapshot'
        ? {
            type: 'snapshot',
            snapshot: serializeStartingSnapshot!(trace.start.snapshot)
          }
        : trace.start,
    // Only entries carrying a replayable command are portable.
    timeline: trace.timeline.flatMap(
      (entry): PortablePropertyTimelineEntry[] =>
        entry.kind === 'event' || entry.kind === 'command'
          ? [{ kind: entry.kind, command: entry.command }]
          : []
    )
  };
}

/** Greedy maximum-coverage selection with deterministic tie-breaking. */
function selectFixtures(
  candidates: readonly Candidate[],
  maxFixtures: number | undefined
): PortablePropertyReplayFixture[] {
  const covered = new Set<string>();
  const remaining = candidates.slice();
  const selected: Candidate[] = [];
  const limit = maxFixtures ?? Infinity;
  while (remaining.length && selected.length < limit) {
    let bestIndex = -1;
    let bestGain = 0;
    for (let index = 0; index < remaining.length; index++) {
      const gain = remaining[index].elements.filter(
        (element) => !covered.has(element)
      ).length;
      // `remaining` is already sorted, so `>` keeps the best tie-break.
      if (gain > bestGain) {
        bestGain = gain;
        bestIndex = index;
      }
    }
    if (bestIndex === -1) {
      break;
    }
    const [candidate] = remaining.splice(bestIndex, 1);
    selected.push(candidate);
    for (const element of candidate.elements) {
      covered.add(element);
    }
  }
  return selected
    .sort((left, right) => (left.key < right.key ? -1 : 1))
    .map((candidate) => candidate.fixture);
}

/**
 * Runs a `propertyTest()` campaign and exports the traces it explored as an
 * offline suite.
 *
 * Only passing runs are recorded: a campaign that finds a counterexample
 * throws, as `propertyTest()` does.
 */
export async function generatePropertySuite<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>,
  TKind extends PropertyGeneratorKind
>(
  source: TSource,
  options: GeneratePropertySuiteOptions<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>,
    InputFromSource<TSource>,
    TKind
  >
): Promise<PropertySuite> {
  type TSnapshot = SnapshotFromSource<TSource>;
  type TEvent = EventFromSource<TSource>;

  const traces: PropertyTrace<TSnapshot, TEvent>[] = [];
  const { select, maxFixtures, generatedAt, collect, ...rest } = options;

  const { coverage } = await propertyTest(source, {
    ...rest,
    // Only passing runs make regression fixtures.
    collect: (trace, info) => {
      collect?.(trace, info);
      if (info.passed) {
        traces.push(trace);
      }
    }
  });

  const logic = (
    'testLogic' in (source as any) ? (source as any).testLogic : (source as any)
  ) as { id?: string; version?: string };
  const machine =
    logic.id || logic.version
      ? { id: logic.id, version: logic.version }
      : undefined;
  const serializeStartingSnapshot = options.start?.serializeSnapshot;

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const trace of traces) {
    const fixture = toSuiteFixture(trace, machine, serializeStartingSnapshot);
    const key = JSON.stringify([fixture.start, fixture.timeline]);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push({
      fixture,
      elements: getTraceElements(trace),
      key,
      length: fixture.timeline.length
    });
  }
  candidates.sort(
    (left, right) =>
      left.length - right.length || (left.key < right.key ? -1 : 1)
  );

  const fixtures =
    (select ?? 'minimal') === 'all'
      ? candidates
          .slice(0, maxFixtures ?? candidates.length)
          .map((candidate) => candidate.fixture)
      : selectFixtures(candidates, maxFixtures);

  return {
    formatVersion: 1,
    machineId: machine?.id,
    machineVersion: machine?.version,
    generatedAt,
    fixtures,
    coverage: propertyCoverageToJSON(coverage)
  };
}

export interface ReplayPropertySuiteOptions<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
> {
  readonly invariant: PropertyInvariant<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>
  >;
  readonly temporal?: readonly PropertyTemporal<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>
  >[];
  readonly reference?: PropertyReferenceOracle<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>
  >;
  readonly sut?: PropertySut<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>
  >;
  readonly test?: PropertyTestModelExecution<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>
  >;
  readonly restoreSnapshot?: (snapshot: unknown) => SnapshotFromSource<TSource>;
}

export interface PropertySuiteReplayFailure {
  readonly fixture: PortablePropertyReplayFixture;
  readonly index: number;
  readonly title: string;
  readonly error: unknown;
}

export interface PropertySuiteReplayResult {
  readonly passed: number;
  readonly failed: readonly PropertySuiteReplayFailure[];
}

/**
 * Replays one suite fixture. Resolves when the fixture still passes and
 * rejects with the underlying failure when it does not.
 */
export async function replayPropertySuiteFixture<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
>(
  source: TSource,
  fixture: PortablePropertyReplayFixture,
  options: ReplayPropertySuiteOptions<TSource>
): Promise<void> {
  await replayPropertyTest(source, fixture, {
    ...(options as any),
    expect: 'pass'
  });
}

/** Replays every fixture in a suite. Each fixture is expected to pass. */
export async function replayPropertySuite<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
>(
  source: TSource,
  suite: PropertySuite,
  options: ReplayPropertySuiteOptions<TSource>
): Promise<PropertySuiteReplayResult> {
  let passed = 0;
  const failed: PropertySuiteReplayFailure[] = [];
  for (let index = 0; index < suite.fixtures.length; index++) {
    const fixture = suite.fixtures[index];
    try {
      await replayPropertySuiteFixture(source, fixture, options);
      passed++;
    } catch (error) {
      failed.push({
        fixture,
        index,
        title: formatPropertySuiteFixtureTitle(fixture, index),
        error
      });
    }
  }
  return { passed, failed };
}

/** A stable, human-readable one-line title for a fixture. */
export function formatPropertySuiteFixtureTitle(
  fixture: PortablePropertyReplayFixture,
  index: number
): string {
  const steps = fixture.timeline.map((entry) => {
    const command = entry.command;
    switch (command.type) {
      case 'event':
        return command.event.type;
      case 'advance':
        return `@advance(${command.milliseconds})`;
      case 'checkpoint':
        return '@checkpoint';
      default:
        return '@stop';
    }
  });
  return `fixture ${index + 1}: ${steps.join(' -> ') || '(no events)'}`;
}

export interface DescribePropertySuiteOptions<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
> extends ReplayPropertySuiteOptions<TSource> {
  /** Defaults to the ambient `it`. */
  readonly it?: (name: string, fn: () => Promise<void> | void) => unknown;
  /** Defaults to the ambient `describe`, when one exists. */
  readonly describe?: (name: string, fn: () => void) => unknown;
  /** The `describe` block name. Defaults to the suite's machine id. */
  readonly name?: string;
}

/**
 * Registers one test per suite fixture with a vitest/jest-compatible
 * `it`/`describe` pair.
 */
export function describePropertySuite<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
>(
  suite: PropertySuite,
  source: TSource,
  options: DescribePropertySuiteOptions<TSource>
): void {
  const globals = globalThis as {
    it?: (name: string, fn: () => Promise<void> | void) => unknown;
    describe?: (name: string, fn: () => void) => unknown;
  };
  const it = options.it ?? globals.it;
  if (!it) {
    throw new Error(
      'describePropertySuite() requires an `it` function when none is global'
    );
  }
  const register = () => {
    suite.fixtures.forEach((fixture, index) => {
      it(formatPropertySuiteFixtureTitle(fixture, index), async () => {
        await replayPropertySuiteFixture(source, fixture, options);
      });
    });
  };
  const describe = options.describe ?? globals.describe;
  const name =
    options.name ??
    `property suite${suite.machineId ? ` (${suite.machineId})` : ''}`;
  if (describe) {
    describe(name, register);
    return;
  }
  register();
}

/** Serializes a suite with stable key ordering. */
export function serializePropertySuite(suite: PropertySuite): string {
  return JSON.stringify(
    {
      formatVersion: suite.formatVersion,
      machineId: suite.machineId,
      machineVersion: suite.machineVersion,
      generatedAt: suite.generatedAt,
      fixtures: suite.fixtures,
      coverage: suite.coverage
    },
    null,
    2
  );
}

/** Parses a serialized suite, rejecting unknown format versions. */
export function parsePropertySuite(json: string): PropertySuite {
  const parsed = JSON.parse(json) as PropertySuite;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Property suite JSON must be an object');
  }
  if (parsed.formatVersion !== 1) {
    throw new Error(
      `Unsupported property suite format version: ${String(parsed.formatVersion)}`
    );
  }
  if (!Array.isArray(parsed.fixtures)) {
    throw new Error('Property suite JSON must contain a `fixtures` array');
  }
  return parsed;
}
