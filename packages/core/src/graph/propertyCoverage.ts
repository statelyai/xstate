import type {
  AnyStateMachine,
  AnyStateNode,
  AnyTransitionDefinition,
  EventObject,
  Snapshot
} from '../types.ts';
import type { GuardEvaluation } from '../transition.ts';
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

export interface PropertyGuardCoverageDimension extends PropertyCoverageDimension {
  readonly outcomes: Readonly<
    Record<string, { readonly passed: number; readonly failed: number }>
  >;
}

export interface PropertyEventCaseCounts {
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
  readonly attemptedRuns: number;
}

export interface PropertyExplorationSeed {
  readonly frontierId: string;
  readonly engine?: string;
  readonly seed?: number;
  readonly path?: string;
}

export interface PropertyExplorationBounds {
  readonly configuredRuns: number | null;
  readonly completedRuns: number;
  readonly attemptedRuns: number;
  readonly maximumSequenceLength: number | null;
  readonly maximumObservedSequenceLength: number;
  readonly frontiers: readonly PropertyExplorationFrontier[];
  readonly seeds: readonly PropertyExplorationSeed[];
  readonly truncated: boolean;
  readonly truncationReasons: readonly string[];
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
  readonly dynamicTransitions: Readonly<
    Record<string, PropertyDynamicTransitionCoverage>
  >;
  readonly guards: PropertyGuardCoverageDimension;
  readonly frontiers: PropertyCoverageDimension;
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
  const nodes = (snapshot as { _nodes?: readonly { id: string }[] })._nodes;
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

export function getPropertyStateId(snapshot: Snapshot<unknown>): string {
  return stableSerialize((snapshot as { value?: unknown }).value ?? null);
}

export function getPropertyTransitionId(
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

function collectReachableNodes(root: AnyStateNode): Set<string> {
  const reachable = new Set<string>([root.id]);
  const queue: AnyStateNode[] = [root];
  while (queue.length) {
    const node = queue.shift()!;
    const candidates = [
      ...(node.initial?.target ?? []),
      ...(node.type === 'parallel' ? Object.values(node.states) : []),
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
): void {
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
    dynamicTransitions: {},
    guards: dimension(),
    frontiers: dimension(),
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
  for (const node of nodes) {
    declare(coverage.stateNodes, node.id, {
      unreachable: !reachable.has(node.id) && !hasReachableDynamicTransition,
      unknown: !reachable.has(node.id) && hasReachableDynamicTransition
    });
    for (const definitions of node.transitions.values()) {
      for (let index = 0; index < definitions.length; index++) {
        registerTransition(
          coverage,
          definitions[index],
          index,
          reachable,
          !reachable.has(node.id) && hasReachableDynamicTransition
        );
      }
    }
    for (let index = 0; index < (node.always?.length ?? 0); index++) {
      registerTransition(
        coverage,
        node.always![index],
        index,
        reachable,
        !reachable.has(node.id) && hasReachableDynamicTransition
      );
    }
  }
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
  const nodes = (snapshot as { _nodes?: readonly { id: string }[] })._nodes;
  for (const node of nodes ?? []) {
    incrementCoverage(coverage.stateNodes, node.id);
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
  }
  return ids;
}

export function getPropertyEventCaseId(
  eventType: string,
  caseName: string
): string {
  return JSON.stringify(['event-case', eventType, caseName]);
}

export function declarePropertyEventCase(
  coverage: MutablePropertyCoverage,
  id: string
): void {
  coverage.eventCases[id] ??= {
    generated: 0,
    applicable: 0,
    executed: 0,
    ignored: 0
  };
}

export function recordPropertyEventCase(
  coverage: MutablePropertyCoverage,
  id: string,
  stage: keyof PropertyEventCaseCounts
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
    configuredRuns: null,
    completedRuns: coverage.runs,
    attemptedRuns: coverage.runs,
    maximumSequenceLength: null,
    maximumObservedSequenceLength: coverage.maximumObservedSequenceLength,
    frontiers: [],
    seeds: [],
    truncated: false,
    truncationReasons: []
  }
): PropertyCoverage {
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
    exploration
  };
}

export function declarePropertyFrontier(
  coverage: MutablePropertyCoverage,
  id: string
): void {
  declare(coverage.frontiers, id);
}
