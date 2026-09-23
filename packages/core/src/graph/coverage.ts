import type {
  AnyStateMachine,
  AnyStateNode,
  AnyTransitionDefinition,
  EventObject,
  Snapshot
} from '../types.ts';
import type { GuardEvaluation } from '../transition.ts';
import { getStateNodeByPath } from '../stateUtils.ts';
import { normalizeTarget } from '../utils.ts';
import { getStateNodes } from './graph.ts';

export type TestCoverageStatus =
  | 'covered'
  | 'uncovered'
  | 'unreachable'
  | 'unknown';

/** One coverage dimension, with its ids grouped by status. */
export interface TestCoverageDimension {
  /** Hits per id. */
  readonly counts: Readonly<Record<string, number>>;
  /** Ids hit at least once. */
  readonly covered: readonly string[];
  /** Reachable ids that were never hit. */
  readonly uncovered: readonly string[];
  /** Ids that cannot be reached from the start state. */
  readonly unreachable: readonly string[];
  /** Ids whose reachability cannot be decided statically. */
  readonly unknown: readonly string[];
}

interface TestTransitionPairCoverageDimension extends TestCoverageDimension {
  /**
   * `true` when the statically enumerable pair universe exceeded
   * `TRANSITION_PAIR_UNIVERSE_LIMIT` and was cut short. Pairs observed at
   * runtime are still reported as covered.
   */
  readonly truncated: boolean;
}

interface TestRequirementCoverageDimension extends TestCoverageDimension {
  /** Requirement id to the state nodes and transitions that declare it. */
  readonly sources: Readonly<Record<string, readonly string[]>>;
}

interface TestGuardCoverageDimension extends TestCoverageDimension {
  readonly outcomes: Readonly<
    Record<string, { readonly passed: number; readonly failed: number }>
  >;
}

export type TestEventCaseStage =
  | 'generated'
  | 'applicable'
  | 'executed'
  | 'ignored';

export interface TestEventCaseCounts {
  /** Effective relative generation weight for this case. Defaults to `1`. */
  readonly weight: number;
  readonly generated: number;
  readonly applicable: number;
  readonly executed: number;
  readonly ignored: number;
}

export interface TestDynamicTransitionCoverage {
  readonly hits: number;
  readonly observedTargetIds: readonly string[];
  readonly outcomeCompleteness: 'unknown';
}

export interface TestExplorationFrontier {
  readonly id: string;
  readonly prefixLength: number;
  readonly runBudget: number | null;
  readonly configuredRuns: number | null;
  readonly completedRuns: number;
  /** Runner creations, including shrink attempts. */
  readonly attemptedRuns: number;
}

export interface TestExplorationSeed {
  readonly frontierId: string;
  readonly engine?: string;
  readonly seed?: number;
  readonly path?: string;
}

/** Swarm testing statistics. Only present when `swarm` was enabled. */
export interface TestExplorationSwarm {
  /** Runs that were given a swarm subset of the event cases. */
  readonly runs: number;
  /** Mean number of event cases enabled per swarm run. */
  readonly averageEnabled: number;
}

/** Targeted-search statistics. Only present when `target` was used. */
export interface TestExplorationTarget {
  /** The best (highest) observed target value, `-Infinity` when none. */
  readonly best: number;
  /** The label recorded alongside the best value, when one was given. */
  readonly label?: string;
  /** How many times the best value improved during the campaign. */
  readonly improvements: number;
}

/** Why a property campaign stopped running batches. */
export type TestStoppedBecause =
  | 'until'
  | 'budget'
  | 'failure'
  | 'paths'
  | 'replay';

export interface TestExplorationBounds {
  /**
   * `'property'` when the campaign generated command sequences,
   * `'paths'` when it executed paths produced by graph traversal.
   */
  readonly strategy: 'property' | 'paths';
  /** Paths executed. Only present for `strategy: 'paths'`. */
  readonly pathCount?: number;
  /** How the paths were produced. Only present for `strategy: 'paths'`. */
  readonly pathGenerator?: 'shortest' | 'simple' | 'events' | 'custom';
  /**
   * `'pure'` when the campaign stepped the machine through `transition()`,
   * `'executed'` when it drove a real actor on a simulated clock.
   */
  readonly mode: 'pure' | 'executed';
  readonly configuredRuns: number | null;
  readonly completedRuns: number;
  /** Runner creations, including shrink attempts. */
  readonly attemptedRuns: number;
  /**
   * Runs started after the first failing run, while the adapter shrank the
   * counterexample. Included in `attemptedRuns`; excluded from `labels` and
   * `eventCases`.
   */
  readonly shrinkRuns: number;
  readonly maximumSequenceLength: number | null;
  readonly maximumObservedSequenceLength: number;
  readonly frontiers: readonly TestExplorationFrontier[];
  readonly seeds: readonly TestExplorationSeed[];
  /** Swarm testing statistics, or `null` when `swarm` was not enabled. */
  readonly swarm: TestExplorationSwarm | null;
  /** Targeted-search statistics. `best` is `-Infinity` when unused. */
  readonly target: TestExplorationTarget;
  readonly truncated: boolean;
  readonly truncationReasons: readonly string[];
  /**
   * `'until'` when a stop condition was met, `'failure'` when a
   * counterexample ended the campaign, `'budget'` when the configured runs
   * were exhausted, `'paths'` when `testPaths()` executed every path, and
   * `'replay'` when `failures.replay` was `'only'` and no campaign ran.
   */
  readonly stoppedBecause: TestStoppedBecause;
  /**
   * Executed-mode steps that settled while an invoked or spawned actor's
   * asynchronous work was still in flight. Each such timeline entry lists the
   * actors in `pendingActors`. Non-zero means some results may have landed
   * in a later step than the one that started them.
   */
  readonly pendingActorSteps: number;
}

/** Aggregated occurrences of a label recorded with `label()`/`classify()`. */
export interface TestLabelCoverage {
  /** Total number of times the label was recorded across all runs. */
  readonly count: number;
  /** Occurrences per recorded value. Labels without a value are not listed. */
  readonly values: Readonly<Record<string, number>>;
  /**
   * Runs in which the label was recorded at least once, over attempted runs
   * that were not shrink attempts. Always between `0` and `1`.
   */
  readonly share: number;
}

/** Per-run outcomes of one temporal property. */
export interface TestTemporalCounts {
  /** Runs in which the property held. */
  readonly satisfied: number;
  /** Runs the property failed. */
  readonly failed: number;
  /** Runs that ended before the property was decided. */
  readonly inconclusive: number;
}

export interface TestTemporalCoverage {
  /** Temporal definitions satisfied in at least one run. */
  readonly satisfied: readonly string[];
  /**
   * Temporal definitions that caused a run to fail, and `sometimes` or
   * `reachable` definitions that held in no run of the campaign.
   */
  readonly failed: readonly string[];
  /**
   * Definitions that were inconclusive in every run that checked them, and
   * satisfied in none.
   */
  readonly inconclusive: readonly string[];
  /** Per-id run counts. */
  readonly counts: Readonly<Record<string, TestTemporalCounts>>;
  /**
   * Bounded definitions that can never fail with the configured bounds, such
   * as an `eventually` whose `within` exceeds the longest sequence.
   */
  readonly warnings: readonly string[];
}

/**
 * What a campaign exercised, resolved by `propertyTest()` and `testPaths()`.
 * Relative to the supplied event cases and bounds; not a claim of complete
 * behavioral coverage.
 */
export interface TestCoverage {
  /** Runs attempted, including shrink attempts. */
  readonly runs: number;
  readonly steps: number;
  readonly skipped: number;
  readonly prefixSteps: number;
  readonly generatedSteps: number;
  readonly invariantChecks: number;
  readonly temporalChecks: number;
  readonly clockAdvances: number;
  readonly checkpoints: number;
  readonly stops: number;
  readonly sutComparisons: number;
  readonly oracleComparisons: number;
  /** Serialized snapshots observed during the campaign. */
  readonly states: TestCoverageDimension;
  /** State node ids. */
  readonly stateNodes: TestCoverageDimension;
  /** Sets of simultaneously active state nodes. */
  readonly configurations: TestCoverageDimension;
  /** Snapshot statuses, such as `active` and `done`. */
  readonly statuses: TestCoverageDimension;
  /** Delivered event types. This does not describe payload-domain coverage. */
  readonly eventTypes: TestCoverageDimension;
  /** Lifecycle counts for the event cases supplied to `propertyTest()`. */
  readonly eventCases: Readonly<Record<string, TestEventCaseCounts>>;
  /** Transition definitions, attributed from the microsteps XState took. */
  readonly transitions: TestCoverageDimension;
  /** Pairs of consecutive executed transitions, as `${t1} -> ${t2}`. */
  readonly transitionPairs: TestTransitionPairCoverageDimension;
  /** Requirement ids declared via `meta.requirements`. */
  readonly requirements: TestRequirementCoverageDimension;
  /** Transitions whose target is computed at runtime, with the targets observed. */
  readonly dynamicTransitions: Readonly<
    Record<string, TestDynamicTransitionCoverage>
  >;
  /** Guard ids, with pass/fail counts in `outcomes`. */
  readonly guards: TestGuardCoverageDimension;
  /** Frontier ids from the `frontiers` option. */
  readonly frontiers: TestCoverageDimension;
  /** Labels recorded with `label()`/`classify()`, keyed by label name. */
  readonly labels: Readonly<Record<string, TestLabelCoverage>>;
  /** Temporal property ids by outcome. */
  readonly temporal: TestTemporalCoverage;
  /** The bounds, budgets, and seeds the campaign ran with. */
  readonly exploration: TestExplorationBounds;
}

interface Declaration {
  unreachable: boolean;
  unknown: boolean;
}

interface MutableDimension {
  counts: Record<string, number>;
  declarations: Map<string, Declaration>;
}

export interface MutableTestCoverage {
  runs: number;
  steps: number;
  skipped: number;
  prefixSteps: number;
  generatedSteps: number;
  invariantChecks: number;
  temporalChecks: number;
  clockAdvances: number;
  checkpoints: number;
  stops: number;
  sutComparisons: number;
  oracleComparisons: number;
  states: MutableDimension;
  stateNodes: MutableDimension;
  configurations: MutableDimension;
  statuses: MutableDimension;
  eventTypes: MutableDimension;
  eventCases: Record<string, TestEventCaseCounts>;
  transitions: MutableDimension;
  transitionPairs: MutableDimension;
  transitionPairsTruncated: boolean;
  requirements: MutableDimension;
  requirementSources: Record<string, string[]>;
  requirementsByStateNode: Map<string, readonly string[]>;
  requirementsByTransition: Map<string, readonly string[]>;
  previousTransitionIds: readonly string[] | null;
  dynamicTransitions: Record<
    string,
    {
      hits: number;
      observedTargetIds: Set<string>;
      outcomeCompleteness: 'unknown';
    }
  >;
  guards: MutableDimension;
  frontiers: MutableDimension;
  labels: Record<
    string,
    { count: number; values: Record<string, number>; runs: number }
  >;
  temporal: {
    counts: Record<
      string,
      { satisfied: number; failed: number; inconclusive: number }
    >;
    /** Campaign-level failures of `sometimes` and `reachable`. */
    campaignFailed: Set<string>;
    warnings: string[];
  };
  /** Runs started after the first failing run. */
  shrinkRuns: number;
  transitionIds: WeakMap<AnyTransitionDefinition, string>;
  guardIds: WeakMap<AnyTransitionDefinition, string>;
  guardOutcomes: Record<string, { passed: number; failed: number }>;
  maximumObservedSequenceLength: number;
  pendingActorSteps: number;
}

function dimension(): MutableDimension {
  return { counts: {}, declarations: new Map() };
}

function declare(
  target: MutableDimension,
  id: string,
  declaration: Partial<Declaration> = {}
): void {
  const previous = target.declarations.get(id);
  target.declarations.set(id, {
    unreachable:
      (previous?.unreachable ?? false) || (declaration.unreachable ?? false),
    unknown: (previous?.unknown ?? false) || (declaration.unknown ?? false)
  });
}

function declareAggregate(
  target: MutableDimension,
  id: string,
  declaration: Declaration
): void {
  const previous = target.declarations.get(id);
  target.declarations.set(id, {
    unreachable: previous
      ? previous.unreachable && declaration.unreachable
      : declaration.unreachable,
    unknown: previous
      ? previous.unknown && declaration.unknown
      : declaration.unknown
  });
}

export function incrementCoverage(target: MutableDimension, id: string): void {
  target.counts[id] = (target.counts[id] ?? 0) + 1;
}

export function getPropertyConfigurationId(
  snapshot: Snapshot<unknown>
): string {
  const nodes =
    (
      snapshot as {
        nodes?: readonly { id: string }[];
        _nodes?: readonly { id: string }[];
      }
    ).nodes ?? (snapshot as { _nodes?: readonly { id: string }[] })._nodes;
  return JSON.stringify((nodes?.map((node) => node.id) ?? []).sort());
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableSerialize(
            (value as Record<string, unknown>)[key]
          )}`
      )
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

function getPropertyStateId(snapshot: Snapshot<unknown>): string {
  return stableSerialize((snapshot as { value?: unknown }).value ?? null);
}

function getPropertyTransitionId(
  coverage: MutableTestCoverage,
  transition: AnyTransitionDefinition
): string {
  return (
    coverage.transitionIds.get(transition) ??
    JSON.stringify([
      'transition',
      transition.source.id,
      transition.eventType || '@eventless',
      'dynamic'
    ])
  );
}

/**
 * Resolves the default target(s) of a history state node. History nodes are
 * never part of an active configuration themselves; entering one enters these
 * nodes instead, so anything reachable only through a history default target
 * would otherwise be misreported as unreachable.
 */
function getHistoryDefaultTargets(node: AnyStateNode): AnyStateNode[] {
  const parent = node.parent;
  if (!parent) {
    return [];
  }
  const normalized = normalizeTarget(
    (node.config as { target?: string | string[] }).target
  );
  if (!normalized) {
    return parent.type === 'parallel'
      ? [parent]
      : (parent.initial?.target ?? []);
  }
  const targets: AnyStateNode[] = [];
  for (const target of normalized) {
    if (typeof target !== 'string') {
      targets.push(target as AnyStateNode);
      continue;
    }
    try {
      targets.push(getStateNodeByPath(parent, target));
    } catch {
      // An unresolvable target contributes no reachability information.
    }
  }
  return targets;
}

function collectReachableNodes(root: AnyStateNode): Set<string> {
  const reachable = new Set<string>([root.id]);
  const queue: AnyStateNode[] = [root];
  while (queue.length) {
    const node = queue.shift()!;
    // `node.transitions` already includes `on`, `after`, the compound/parallel
    // `onDone` transitions and the `invoke` `onDone`/`onError`/`onSnapshot`
    // transitions, because `formatTransitions()` folds all of them into it.
    const candidates = [
      ...(node.initial?.target ?? []),
      ...(node.type === 'parallel' ? Object.values(node.states) : []),
      ...(node.type === 'history' ? getHistoryDefaultTargets(node) : []),
      ...[...node.transitions.values()].flatMap((definitions) =>
        definitions.flatMap((definition) => definition.target ?? [])
      ),
      ...(node.always ?? []).flatMap((definition) => definition.target ?? [])
    ];
    for (const target of candidates) {
      if (!reachable.has(target.id)) {
        reachable.add(target.id);
        queue.push(target);
      }
    }
  }
  return reachable;
}

function registerTransition(
  coverage: MutableTestCoverage,
  transition: AnyTransitionDefinition,
  index: number,
  reachable: Set<string>,
  reachabilityUnknown: boolean
): string {
  const id = JSON.stringify([
    'transition',
    transition.source.id,
    transition.eventType || '@eventless',
    index
  ]);
  const sourceUnreachable = !reachable.has(transition.source.id);
  const dynamic = !!transition.to;
  coverage.transitionIds.set(transition, id);
  declare(coverage.transitions, id, {
    unreachable: sourceUnreachable && !reachabilityUnknown,
    unknown: sourceUnreachable && reachabilityUnknown
  });
  declareAggregate(coverage.eventTypes, transition.eventType || '@eventless', {
    unreachable: sourceUnreachable && !reachabilityUnknown,
    unknown: sourceUnreachable && reachabilityUnknown
  });
  if (dynamic) {
    coverage.dynamicTransitions[id] = {
      hits: 0,
      observedTargetIds: new Set(),
      outcomeCompleteness: 'unknown'
    };
  }
  if (transition.guard) {
    const guardId = JSON.stringify(['guard', id]);
    coverage.guardIds.set(transition, guardId);
    declare(coverage.guards, guardId, {
      unreachable: sourceUnreachable && !reachabilityUnknown,
      unknown: sourceUnreachable && reachabilityUnknown
    });
  }
  return id;
}

/**
 * Upper bound on statically enumerated transition pairs. Pair universes grow
 * quadratically, so large machines report a truncated universe rather than
 * spending unbounded time and memory on it.
 */
const TRANSITION_PAIR_UNIVERSE_LIMIT = 2000;
/**
 * Machines with more transitions than this skip pair enumeration entirely,
 * since even the static pair universe can grow as O(T^2).
 */
const TRANSITION_PAIR_MACHINE_LIMIT = 500;

function getPropertyTransitionPairId(first: string, second: string): string {
  return `${first} -> ${second}`;
}

function getDescendantIds(node: AnyStateNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const descendant of getStateNodes(node)) {
    ids.add(descendant.id);
  }
  return ids;
}

interface RegisteredTransition {
  readonly id: string;
  readonly transition: AnyTransitionDefinition;
}

/**
 * Declares the pairs of transitions that can run back to back. A pair
 * `(t1, t2)` is possible when `t2`'s source node is within the configuration
 * `t1` can leave behind, approximated as the descendants-or-self of `t1`'s
 * targets (or of its own source when `t1` is targetless).
 *
 * Only pairs of static transitions are declared. A dynamic transition's target
 * is unknown until it runs, so pairs involving one are not part of the
 * universe; when observed at runtime they are still reported as covered.
 */
function declareTransitionPairs(
  coverage: MutableTestCoverage,
  registered: readonly RegisteredTransition[]
): void {
  if (registered.length > TRANSITION_PAIR_MACHINE_LIMIT) {
    // Enumerating pairs is O(T^2); on large machines the universe is both
    // uselessly large and expensive to build, so it is skipped entirely.
    coverage.transitionPairsTruncated = true;
    return;
  }
  const staticTransitions = registered.filter((entry) => !entry.transition.to);
  const bySource = new Map<string, RegisteredTransition[]>();
  for (const entry of staticTransitions) {
    const sourceId = entry.transition.source.id;
    let entries = bySource.get(sourceId);
    if (!entries) {
      entries = [];
      bySource.set(sourceId, entries);
    }
    entries.push(entry);
  }
  const descendants = new Map<string, Set<string>>();
  let declared = 0;
  for (const first of staticTransitions) {
    const roots = first.transition.target?.length
      ? first.transition.target
      : [first.transition.source];
    const firstDeclaration = coverage.transitions.declarations.get(first.id);
    const reachableSources = new Set<string>();
    for (const root of roots) {
      let ids = descendants.get(root.id);
      if (!ids) {
        ids = getDescendantIds(root);
        descendants.set(root.id, ids);
      }
      for (const id of ids) {
        reachableSources.add(id);
      }
    }
    for (const sourceId of reachableSources) {
      for (const second of bySource.get(sourceId) ?? []) {
        if (declared >= TRANSITION_PAIR_UNIVERSE_LIMIT) {
          coverage.transitionPairsTruncated = true;
          return;
        }
        declared++;
        const secondDeclaration = coverage.transitions.declarations.get(
          second.id
        );
        declare(
          coverage.transitionPairs,
          getPropertyTransitionPairId(first.id, second.id),
          {
            unreachable:
              !!firstDeclaration?.unreachable ||
              !!secondDeclaration?.unreachable,
            unknown: !!firstDeclaration?.unknown || !!secondDeclaration?.unknown
          }
        );
      }
    }
  }
}

function normalizeRequirements(meta: unknown): readonly string[] {
  const requirements = (meta as { requirements?: unknown } | undefined)
    ?.requirements;
  if (typeof requirements === 'string') {
    return [requirements];
  }
  if (Array.isArray(requirements)) {
    return requirements.filter(
      (requirement): requirement is string => typeof requirement === 'string'
    );
  }
  return [];
}

function declareRequirements(
  coverage: MutableTestCoverage,
  requirements: readonly string[],
  source: string,
  owner: Map<string, readonly string[]>,
  ownerId: string
): void {
  if (!requirements.length) {
    return;
  }
  owner.set(ownerId, [...(owner.get(ownerId) ?? []), ...requirements]);
  for (const requirement of requirements) {
    declare(coverage.requirements, requirement);
    const sources = (coverage.requirementSources[requirement] ??= []);
    if (!sources.includes(source)) {
      sources.push(source);
    }
  }
}

function recordRequirements(
  coverage: MutableTestCoverage,
  requirements: readonly string[] | undefined
): void {
  for (const requirement of requirements ?? []) {
    incrementCoverage(coverage.requirements, requirement);
  }
}

export function createTestCoverage(logic: unknown): MutableTestCoverage {
  const coverage: MutableTestCoverage = {
    runs: 0,
    steps: 0,
    skipped: 0,
    prefixSteps: 0,
    generatedSteps: 0,
    invariantChecks: 0,
    temporalChecks: 0,
    clockAdvances: 0,
    checkpoints: 0,
    stops: 0,
    sutComparisons: 0,
    oracleComparisons: 0,
    states: dimension(),
    stateNodes: dimension(),
    configurations: dimension(),
    statuses: dimension(),
    eventTypes: dimension(),
    eventCases: {},
    transitions: dimension(),
    transitionPairs: dimension(),
    transitionPairsTruncated: false,
    requirements: dimension(),
    requirementSources: {},
    requirementsByStateNode: new Map(),
    requirementsByTransition: new Map(),
    previousTransitionIds: null,
    dynamicTransitions: {},
    guards: dimension(),
    frontiers: dimension(),
    labels: {},
    temporal: {
      counts: {},
      campaignFailed: new Set(),
      warnings: []
    },
    shrinkRuns: 0,
    transitionIds: new WeakMap(),
    guardIds: new WeakMap(),
    guardOutcomes: {},
    maximumObservedSequenceLength: 0,
    pendingActorSteps: 0
  };
  const machine = logic as Partial<AnyStateMachine>;
  if (!machine.root) {
    for (const target of [
      coverage.states,
      coverage.stateNodes,
      coverage.configurations,
      coverage.eventTypes,
      coverage.transitions,
      coverage.transitionPairs,
      coverage.guards
    ]) {
      declare(target, '(not statically enumerable)', { unknown: true });
    }
    return coverage;
  }

  const nodes = [machine.root, ...getStateNodes(machine.root)];
  const reachable = collectReachableNodes(machine.root);
  const hasReachableDynamicTransition = nodes.some(
    (node) =>
      reachable.has(node.id) &&
      ([...node.transitions.values()].some((definitions) =>
        definitions.some((definition) => !!definition.to)
      ) ||
        (node.always ?? []).some((definition) => !!definition.to))
  );
  const registered: RegisteredTransition[] = [];
  for (const node of nodes) {
    declareRequirements(
      coverage,
      normalizeRequirements(node.meta),
      `stateNode:${node.id}`,
      coverage.requirementsByStateNode,
      node.id
    );
    declare(coverage.stateNodes, node.id, {
      unreachable: !reachable.has(node.id) && !hasReachableDynamicTransition,
      unknown: !reachable.has(node.id) && hasReachableDynamicTransition
    });
    for (const definitions of node.transitions.values()) {
      for (let index = 0; index < definitions.length; index++) {
        registered.push({
          id: registerTransition(
            coverage,
            definitions[index],
            index,
            reachable,
            !reachable.has(node.id) && hasReachableDynamicTransition
          ),
          transition: definitions[index]
        });
      }
    }
    for (let index = 0; index < (node.always?.length ?? 0); index++) {
      registered.push({
        id: registerTransition(
          coverage,
          node.always![index],
          index,
          reachable,
          !reachable.has(node.id) && hasReachableDynamicTransition
        ),
        transition: node.always![index]
      });
    }
  }
  for (const entry of registered) {
    declareRequirements(
      coverage,
      normalizeRequirements((entry.transition as { meta?: unknown }).meta),
      `transition:${entry.id}`,
      coverage.requirementsByTransition,
      entry.id
    );
  }
  declareTransitionPairs(coverage, registered);
  declare(coverage.states, '(runtime serialized states)', { unknown: true });
  declare(coverage.configurations, '(runtime configurations)', {
    unknown: true
  });
  return coverage;
}

export function recordPropertySnapshot(
  coverage: MutableTestCoverage,
  snapshot: Snapshot<unknown>
): void {
  incrementCoverage(coverage.states, getPropertyStateId(snapshot));
  incrementCoverage(
    coverage.configurations,
    getPropertyConfigurationId(snapshot)
  );
  incrementCoverage(coverage.statuses, snapshot.status);
  const nodes =
    (
      snapshot as {
        nodes?: readonly { id: string }[];
        _nodes?: readonly { id: string }[];
      }
    ).nodes ?? (snapshot as { _nodes?: readonly { id: string }[] })._nodes;
  for (const node of nodes ?? []) {
    incrementCoverage(coverage.stateNodes, node.id);
    recordRequirements(coverage, coverage.requirementsByStateNode.get(node.id));
  }
}

export function recordPropertyTransitions(
  coverage: MutableTestCoverage,
  event: EventObject,
  transitions: readonly AnyTransitionDefinition[],
  resolutions: readonly {
    readonly transition: AnyTransitionDefinition;
    readonly targetIds: readonly string[];
  }[] = [],
  /**
   * Whether the guard of every selected transition should be counted as one
   * evaluation. Callers that also call {@link recordPropertyGuards} for the
   * same step must pass `false`, so a passing guard is not counted twice.
   */
  countGuards = true
): readonly string[] {
  incrementCoverage(coverage.eventTypes, event.type);
  const resolvedTargets = new Map(
    resolutions.map((resolution) => [
      resolution.transition,
      resolution.targetIds
    ])
  );
  const ids: string[] = [];
  for (const selected of transitions) {
    const id = getPropertyTransitionId(coverage, selected);
    ids.push(id);
    incrementCoverage(coverage.transitions, id);
    const dynamic = coverage.dynamicTransitions[id];
    if (dynamic) {
      dynamic.hits++;
      for (const targetId of resolvedTargets.get(selected) ?? []) {
        dynamic.observedTargetIds.add(targetId);
      }
    }
    if (countGuards) {
      // Only counted here when the caller has no guard evaluations of its own
      // (executed mode): otherwise `recordPropertyGuards()` counts every
      // evaluation, passing or failing, exactly once.
      const guardId = coverage.guardIds.get(selected);
      if (guardId) {
        incrementCoverage(coverage.guards, guardId);
      }
    }
    recordRequirements(coverage, coverage.requirementsByTransition.get(id));
  }
  if (ids.length) {
    for (const previous of coverage.previousTransitionIds ?? []) {
      for (const current of ids) {
        incrementCoverage(
          coverage.transitionPairs,
          getPropertyTransitionPairId(previous, current)
        );
      }
    }
    coverage.previousTransitionIds = ids;
  }
  return ids;
}

/**
 * Clears the consecutive-transition chain so pairs are only counted within a
 * single run.
 */
export function resetPropertyTransitionPairs(
  coverage: MutableTestCoverage
): void {
  coverage.previousTransitionIds = null;
}

export function getPropertyEventCaseId(
  eventType: string,
  caseName: string
): string {
  return JSON.stringify(['event-case', eventType, caseName]);
}

/**
 * Parses an id produced by {@link getPropertyEventCaseId} back into its event
 * type and case name. Returns `undefined` for ids of any other shape.
 */
export function parsePropertyEventCaseId(
  id: string
): { readonly type: string; readonly name: string } | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(id);
  } catch {
    return undefined;
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 3 ||
    parsed[0] !== 'event-case' ||
    typeof parsed[1] !== 'string' ||
    typeof parsed[2] !== 'string'
  ) {
    return undefined;
  }
  return { type: parsed[1], name: parsed[2] };
}

export function declarePropertyEventCase(
  coverage: MutableTestCoverage,
  id: string,
  weight?: number
): void {
  const existing = coverage.eventCases[id];
  if (!existing) {
    coverage.eventCases[id] = {
      weight: weight ?? 1,
      generated: 0,
      applicable: 0,
      executed: 0,
      ignored: 0
    };
    return;
  }
  if (weight !== undefined && existing.weight !== weight) {
    coverage.eventCases[id] = { ...existing, weight };
  }
}

export function recordPropertyEventCase(
  coverage: MutableTestCoverage,
  id: string,
  stage: TestEventCaseStage
): void {
  declarePropertyEventCase(coverage, id);
  const counts = coverage.eventCases[id] as {
    generated: number;
    applicable: number;
    executed: number;
    ignored: number;
  };
  counts[stage]++;
}

export function recordPropertyGuards(
  coverage: MutableTestCoverage,
  evaluations: readonly GuardEvaluation[]
): readonly string[] {
  const ids: string[] = [];
  for (const evaluation of evaluations) {
    const id =
      coverage.guardIds.get(evaluation.transition) ??
      JSON.stringify([
        'guard',
        getPropertyTransitionId(coverage, evaluation.transition)
      ]);
    ids.push(id);
    incrementCoverage(coverage.guards, id);
    const outcomes = (coverage.guardOutcomes[id] ??= {
      passed: 0,
      failed: 0
    });
    if (evaluation.result) {
      outcomes.passed++;
    } else {
      outcomes.failed++;
    }
  }
  return ids;
}

function finalizeDimension(dimension: MutableDimension): TestCoverageDimension {
  const covered = Object.keys(dimension.counts).sort();
  const uncovered: string[] = [];
  const unreachable: string[] = [];
  const unknown: string[] = [];
  for (const [id, declaration] of dimension.declarations) {
    if (dimension.counts[id] !== undefined) {
      continue;
    }
    if (declaration.unknown) {
      unknown.push(id);
    } else if (declaration.unreachable) {
      unreachable.push(id);
    } else {
      uncovered.push(id);
    }
  }
  return {
    counts: { ...dimension.counts },
    covered,
    uncovered: uncovered.sort(),
    unreachable: unreachable.sort(),
    unknown: unknown.sort()
  };
}

export function finalizeTestCoverage(
  coverage: MutableTestCoverage,
  exploration: TestExplorationBounds = {
    strategy: 'property',
    mode: 'pure',
    configuredRuns: null,
    completedRuns: coverage.runs,
    attemptedRuns: coverage.runs,
    shrinkRuns: coverage.shrinkRuns,
    maximumSequenceLength: null,
    maximumObservedSequenceLength: coverage.maximumObservedSequenceLength,
    frontiers: [],
    seeds: [],
    swarm: null,
    target: { best: -Infinity, improvements: 0 },
    truncated: false,
    truncationReasons: [],
    stoppedBecause: 'budget',
    pendingActorSteps: coverage.pendingActorSteps
  }
): TestCoverage {
  // Shrink attempts record no labels, so the share is taken over the attempted
  // runs that were not shrink attempts, and clamped.
  const labelRuns =
    (exploration.attemptedRuns || coverage.runs) - coverage.shrinkRuns;
  const temporalCounts = coverage.temporal.counts;
  const temporalIds = Object.keys(temporalCounts).sort();
  return {
    runs: coverage.runs,
    steps: coverage.steps,
    skipped: coverage.skipped,
    prefixSteps: coverage.prefixSteps,
    generatedSteps: coverage.generatedSteps,
    invariantChecks: coverage.invariantChecks,
    temporalChecks: coverage.temporalChecks,
    clockAdvances: coverage.clockAdvances,
    checkpoints: coverage.checkpoints,
    stops: coverage.stops,
    sutComparisons: coverage.sutComparisons,
    oracleComparisons: coverage.oracleComparisons,
    states: finalizeDimension(coverage.states),
    stateNodes: finalizeDimension(coverage.stateNodes),
    configurations: finalizeDimension(coverage.configurations),
    statuses: finalizeDimension(coverage.statuses),
    eventTypes: finalizeDimension(coverage.eventTypes),
    eventCases: Object.fromEntries(
      Object.entries(coverage.eventCases)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, counts]) => [id, { ...counts }])
    ),
    transitions: finalizeDimension(coverage.transitions),
    transitionPairs: {
      ...finalizeDimension(coverage.transitionPairs),
      truncated: coverage.transitionPairsTruncated
    },
    requirements: {
      ...finalizeDimension(coverage.requirements),
      sources: Object.fromEntries(
        Object.entries(coverage.requirementSources)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([id, sources]) => [id, [...sources].sort()])
      )
    },
    dynamicTransitions: Object.fromEntries(
      Object.entries(coverage.dynamicTransitions)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, dynamic]) => [
          id,
          {
            hits: dynamic.hits,
            observedTargetIds: [...dynamic.observedTargetIds].sort(),
            outcomeCompleteness: dynamic.outcomeCompleteness
          }
        ])
    ),
    guards: {
      ...finalizeDimension(coverage.guards),
      outcomes: { ...coverage.guardOutcomes }
    },
    frontiers: finalizeDimension(coverage.frontiers),
    labels: Object.fromEntries(
      Object.entries(coverage.labels)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, entry]) => [
          name,
          {
            count: entry.count,
            values: Object.fromEntries(
              Object.entries(entry.values).sort(([left], [right]) =>
                left.localeCompare(right)
              )
            ),
            share: labelRuns ? Math.min(1, entry.runs / labelRuns) : 0
          }
        ])
    ),
    temporal: {
      satisfied: temporalIds.filter((id) => temporalCounts[id].satisfied > 0),
      failed: [
        ...new Set([
          ...temporalIds.filter((id) => temporalCounts[id].failed > 0),
          ...coverage.temporal.campaignFailed
        ])
      ].sort(),
      inconclusive: temporalIds.filter(
        (id) =>
          temporalCounts[id].inconclusive > 0 &&
          temporalCounts[id].satisfied === 0 &&
          !coverage.temporal.campaignFailed.has(id)
      ),
      counts: Object.fromEntries(
        temporalIds.map((id) => [id, { ...temporalCounts[id] }])
      ),
      warnings: coverage.temporal.warnings.slice()
    },
    exploration
  };
}

/**
 * Records one occurrence of a label. `seen` is the set of label names already
 * recorded in the current run, so each run contributes at most once to a
 * label's `share`.
 */
export function recordPropertyLabel(
  coverage: MutableTestCoverage,
  name: string,
  value: string | number | boolean | undefined,
  seen: Set<string>
): void {
  const entry = (coverage.labels[name] ??= { count: 0, values: {}, runs: 0 });
  entry.count++;
  if (value !== undefined) {
    const key = String(value);
    entry.values[key] = (entry.values[key] ?? 0) + 1;
  }
  if (!seen.has(name)) {
    seen.add(name);
    entry.runs++;
  }
}

/** Records one run's outcome for a temporal property. */
export function recordPropertyTemporal(
  coverage: MutableTestCoverage,
  id: string,
  outcome: 'satisfied' | 'failed' | 'inconclusive'
): void {
  const counts = (coverage.temporal.counts[id] ??= {
    satisfied: 0,
    failed: 0,
    inconclusive: 0
  });
  counts[outcome]++;
}

export function declarePropertyFrontier(
  coverage: MutableTestCoverage,
  id: string
): void {
  declare(coverage.frontiers, id);
}
