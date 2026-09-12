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

export type PropertyCoverageStatus =
  | 'covered'
  | 'uncovered'
  | 'unreachable'
  | 'unknown';

export interface PropertyCoverageDimension {
  readonly counts: Readonly<Record<string, number>>;
  readonly covered: readonly string[];
  readonly uncovered: readonly string[];
  readonly unreachable: readonly string[];
  readonly unknown: readonly string[];
}

export interface PropertyTransitionPairCoverageDimension extends PropertyCoverageDimension {
  /**
   * `true` when the statically enumerable pair universe exceeded
   * `TRANSITION_PAIR_UNIVERSE_LIMIT` and was cut short. Pairs observed at
   * runtime are still reported as covered.
   */
  readonly truncated: boolean;
}

export interface PropertyRequirementCoverageDimension extends PropertyCoverageDimension {
  /** Requirement id to the state nodes and transitions that declare it. */
  readonly sources: Readonly<Record<string, readonly string[]>>;
}

interface PropertyGuardCoverageDimension extends PropertyCoverageDimension {
  readonly outcomes: Readonly<
    Record<string, { readonly passed: number; readonly failed: number }>
  >;
}

export type PropertyEventCaseStage =
  | 'generated'
  | 'applicable'
  | 'executed'
  | 'ignored';

export interface PropertyEventCaseCounts {
  /** Effective relative generation weight for this case. Defaults to `1`. */
  readonly weight: number;
  readonly generated: number;
  readonly applicable: number;
  readonly executed: number;
  readonly ignored: number;
}

export interface PropertyDynamicTransitionCoverage {
  readonly hits: number;
  readonly observedTargetIds: readonly string[];
  readonly outcomeCompleteness: 'unknown';
}

export interface PropertyExplorationFrontier {
  readonly id: string;
  readonly prefixLength: number;
  readonly runBudget: number | null;
  readonly configuredRuns: number | null;
  readonly completedRuns: number;
  /** Runner creations, including shrink attempts. */
  readonly attemptedRuns: number;
}

export interface PropertyExplorationSeed {
  readonly frontierId: string;
  readonly engine?: string;
  readonly seed?: number;
  readonly path?: string;
}

/** Why a property campaign stopped running batches. */
export type PropertyStoppedBecause = 'until' | 'budget' | 'failure';

export interface PropertyExplorationBounds {
  /**
   * `'pure'` when the campaign stepped the machine through `transition()`,
   * `'executed'` when it drove a real actor on a simulated clock.
   */
  readonly mode: 'pure' | 'executed';
  readonly configuredRuns: number | null;
  readonly completedRuns: number;
  /** Runner creations, including shrink attempts. */
  readonly attemptedRuns: number;
  readonly maximumSequenceLength: number | null;
  readonly maximumObservedSequenceLength: number;
  readonly frontiers: readonly PropertyExplorationFrontier[];
  readonly seeds: readonly PropertyExplorationSeed[];
  readonly truncated: boolean;
  readonly truncationReasons: readonly string[];
  /**
   * `'until'` when a stop condition was met, `'failure'` when a
   * counterexample ended the campaign, `'budget'` when the configured runs
   * were exhausted.
   */
  readonly stoppedBecause: PropertyStoppedBecause;
}

/** Aggregated occurrences of a label recorded with `label()`/`classify()`. */
export interface PropertyLabelCoverage {
  /** Total number of times the label was recorded across all runs. */
  readonly count: number;
  /** Occurrences per recorded value. Labels without a value are not listed. */
  readonly values: Readonly<Record<string, number>>;
  /** Runs in which the label was recorded at least once, over completed runs. */
  readonly share: number;
}

export interface PropertyTemporalCoverage {
  /** Temporal definitions satisfied in at least one run. */
  readonly satisfied: readonly string[];
  /** Temporal definitions that caused a run to fail. */
  readonly failed: readonly string[];
  /**
   * Bounded `eventually`/`until` definitions whose `within` bound was never
   * reached before the run ended, and which were never satisfied.
   */
  readonly inconclusive: readonly string[];
}

export interface PropertyCoverage {
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
  readonly states: PropertyCoverageDimension;
  readonly stateNodes: PropertyCoverageDimension;
  readonly configurations: PropertyCoverageDimension;
  readonly statuses: PropertyCoverageDimension;
  /** Delivered event types. This does not describe payload-domain coverage. */
  readonly eventTypes: PropertyCoverageDimension;
  /** Lifecycle counts for the event cases supplied to `propertyTest()`. */
  readonly eventCases: Readonly<Record<string, PropertyEventCaseCounts>>;
  readonly transitions: PropertyCoverageDimension;
  /** Pairs of consecutive executed transitions, as `${t1} -> ${t2}`. */
  readonly transitionPairs: PropertyTransitionPairCoverageDimension;
  /** Requirement ids declared via `meta.requirements`. */
  readonly requirements: PropertyRequirementCoverageDimension;
  readonly dynamicTransitions: Readonly<
    Record<string, PropertyDynamicTransitionCoverage>
  >;
  readonly guards: PropertyGuardCoverageDimension;
  readonly frontiers: PropertyCoverageDimension;
  /** Labels recorded with `label()`/`classify()`, keyed by label name. */
  readonly labels: Readonly<Record<string, PropertyLabelCoverage>>;
  readonly temporal: PropertyTemporalCoverage;
  readonly exploration: PropertyExplorationBounds;
}

interface Declaration {
  unreachable: boolean;
  unknown: boolean;
}

interface MutableDimension {
  counts: Record<string, number>;
  declarations: Map<string, Declaration>;
}

export interface MutablePropertyCoverage {
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
  eventCases: Record<string, PropertyEventCaseCounts>;
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
    satisfied: Set<string>;
    failed: Set<string>;
    inconclusive: Set<string>;
  };
  transitionIds: WeakMap<AnyTransitionDefinition, string>;
  guardIds: WeakMap<AnyTransitionDefinition, string>;
  guardOutcomes: Record<string, { passed: number; failed: number }>;
  maximumObservedSequenceLength: number;
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
  coverage: MutablePropertyCoverage,
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
  coverage: MutablePropertyCoverage,
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
const TRANSITION_PAIR_UNIVERSE_LIMIT = 5000;

export function getPropertyTransitionPairId(
  first: string,
  second: string
): string {
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
 */
function declareTransitionPairs(
  coverage: MutablePropertyCoverage,
  registered: readonly RegisteredTransition[]
): void {
  const followers = new Map<string, RegisteredTransition[]>();
  for (const entry of registered) {
    const bySource = followers.get(entry.transition.source.id);
    if (bySource) {
      bySource.push(entry);
    } else {
      followers.set(entry.transition.source.id, [entry]);
    }
  }
  const descendants = new Map<string, Set<string>>();
  let declared = 0;
  for (const first of registered) {
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
    for (const second of registered) {
      const dynamic = !!first.transition.to || !!second.transition.to;
      if (!dynamic && !reachableSources.has(second.transition.source.id)) {
        continue;
      }
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
            !!firstDeclaration?.unreachable || !!secondDeclaration?.unreachable,
          unknown:
            dynamic ||
            !!firstDeclaration?.unknown ||
            !!secondDeclaration?.unknown
        }
      );
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
  coverage: MutablePropertyCoverage,
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
  coverage: MutablePropertyCoverage,
  requirements: readonly string[] | undefined
): void {
  for (const requirement of requirements ?? []) {
    incrementCoverage(coverage.requirements, requirement);
  }
}

export function createPropertyCoverage(
  logic: unknown
): MutablePropertyCoverage {
  const coverage: MutablePropertyCoverage = {
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
      satisfied: new Set(),
      failed: new Set(),
      inconclusive: new Set()
    },
    transitionIds: new WeakMap(),
    guardIds: new WeakMap(),
    guardOutcomes: {},
    maximumObservedSequenceLength: 0
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
  coverage: MutablePropertyCoverage,
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
  coverage: MutablePropertyCoverage,
  event: EventObject,
  transitions: readonly AnyTransitionDefinition[],
  resolutions: readonly {
    readonly transition: AnyTransitionDefinition;
    readonly targetIds: readonly string[];
  }[] = []
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
    const guardId = coverage.guardIds.get(selected);
    if (guardId) {
      incrementCoverage(coverage.guards, guardId);
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
  coverage: MutablePropertyCoverage
): void {
  coverage.previousTransitionIds = null;
}

export function getPropertyEventCaseId(
  eventType: string,
  caseName: string
): string {
  return JSON.stringify(['event-case', eventType, caseName]);
}

export function declarePropertyEventCase(
  coverage: MutablePropertyCoverage,
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
  coverage: MutablePropertyCoverage,
  id: string,
  stage: PropertyEventCaseStage
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
  coverage: MutablePropertyCoverage,
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

function finalizeDimension(
  dimension: MutableDimension
): PropertyCoverageDimension {
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

export function finalizePropertyCoverage(
  coverage: MutablePropertyCoverage,
  exploration: PropertyExplorationBounds = {
    mode: 'pure',
    configuredRuns: null,
    completedRuns: coverage.runs,
    attemptedRuns: coverage.runs,
    maximumSequenceLength: null,
    maximumObservedSequenceLength: coverage.maximumObservedSequenceLength,
    frontiers: [],
    seeds: [],
    truncated: false,
    truncationReasons: [],
    stoppedBecause: 'budget'
  }
): PropertyCoverage {
  const completedRuns = exploration.completedRuns || coverage.runs;
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
            share: completedRuns ? entry.runs / completedRuns : 0
          }
        ])
    ),
    temporal: {
      satisfied: [...coverage.temporal.satisfied].sort(),
      failed: [...coverage.temporal.failed].sort(),
      inconclusive: [...coverage.temporal.inconclusive]
        .filter((id) => !coverage.temporal.satisfied.has(id))
        .sort()
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
  coverage: MutablePropertyCoverage,
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

export function recordPropertyTemporal(
  coverage: MutablePropertyCoverage,
  id: string,
  outcome: 'satisfied' | 'failed' | 'inconclusive'
): void {
  coverage.temporal[outcome].add(id);
}

export function declarePropertyFrontier(
  coverage: MutablePropertyCoverage,
  id: string
): void {
  declare(coverage.frontiers, id);
}
