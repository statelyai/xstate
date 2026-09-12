import type {
  ActorLogic,
  AnyTransitionDefinition,
  EventObject,
  InputFrom,
  Snapshot,
  SnapshotFrom
} from '../index.ts';
import { XSTATE_INIT, XSTATE_STOP } from '../constants.ts';
import {
  initialTransitionWithDetails,
  transitionWithDetails
} from '../transition.ts';
import { TestModel } from './TestModel.ts';
import {
  createPropertyCoverage,
  declarePropertyEventCase,
  declarePropertyFrontier,
  finalizePropertyCoverage,
  getPropertyConfigurationId,
  getPropertyEventCaseId,
  incrementCoverage,
  recordPropertyEventCase,
  recordPropertyGuards,
  recordPropertyLabel,
  recordPropertyTemporal,
  recordPropertySnapshot,
  recordPropertyTransitions,
  resetPropertyTransitionPairs,
  type MutablePropertyCoverage,
  type PropertyCoverage,
  type PropertyCoverageDimension,
  type PropertyStoppedBecause,
  type PropertyExplorationBounds,
  type PropertyExplorationFrontier,
  type PropertyExplorationSeed
} from './propertyCoverage.ts';
import { getShortestPaths } from './shortestPaths.ts';
import type { StatePath, Step, TestParam } from './types.ts';

export type {
  PropertyCoverage,
  PropertyCoverageDimension,
  PropertyLabelCoverage,
  PropertyStoppedBecause,
  PropertyCoverageStatus,
  PropertyDynamicTransitionCoverage,
  PropertyEventCaseCounts,
  PropertyExplorationBounds,
  PropertyExplorationFrontier,
  PropertyExplorationSeed
} from './propertyCoverage.ts';

export interface PropertyGeneratorKind {
  readonly target: unknown;
  readonly generator: unknown;
}

export type PropertyGenerator<
  TKind extends PropertyGeneratorKind,
  TValue
> = (TKind & { readonly target: TValue })['generator'];

export interface PropertyReplayMetadata {
  readonly engine: string;
  readonly engineVersion?: string;
  readonly seed?: number;
  readonly path?: string;
  readonly replayPath?: string;
  readonly data?: unknown;
}

export type PropertyCommand<TEvent extends EventObject = EventObject> =
  | {
      readonly type: 'event';
      readonly event: TEvent;
      readonly phase: 'prefix' | 'generated';
      readonly origin: 'frontier' | 'generator' | 'clock';
      readonly caseId?: string;
    }
  | {
      readonly type: 'advance';
      readonly milliseconds: number;
      readonly deliveredEvents: readonly TEvent[];
    }
  | { readonly type: 'checkpoint'; readonly label?: string }
  | { readonly type: 'stop' };

export interface PropertyComparedObservation {
  /** The model projection that was compared. */
  readonly model: unknown;
  /** The value observed on the reference oracle or the system under test. */
  readonly observed: unknown;
}

export interface PropertyObservation {
  /**
   * The model projection of the reference oracle when one is configured,
   * otherwise the model projection of the system under test. Prefer the
   * explicit `reference` and `sut` fields, which always report the projection
   * they were compared against.
   */
  readonly model: unknown;
  /** Present when a reference oracle is configured. */
  readonly reference?: PropertyComparedObservation;
  /** Present when a system under test is configured. */
  readonly sut?: PropertyComparedObservation;
}

export interface PropertyEventTimelineEntry<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly kind: 'event';
  readonly index: number;
  readonly command: Extract<PropertyCommand<TEvent>, { type: 'event' }>;
  readonly previousSnapshot: TSnapshot;
  readonly snapshot: TSnapshot;
  readonly effects: readonly unknown[];
  readonly transitionIds: readonly string[];
  readonly guardIds: readonly string[];
  readonly activeStateIds: readonly string[];
  readonly observation?: PropertyObservation;
}

export interface PropertyRuntimeTimelineEntry<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly kind: 'command';
  readonly index: number;
  readonly command: Exclude<PropertyCommand<TEvent>, { type: 'event' }>;
  readonly previousSnapshot: TSnapshot;
  readonly snapshot: TSnapshot;
  readonly effects: readonly unknown[];
  readonly transitionIds: readonly string[];
  readonly guardIds: readonly string[];
  readonly observation?: PropertyObservation;
}

export type PropertyTimelineEntry<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> =
  | PropertyEventTimelineEntry<TSnapshot, TEvent>
  | PropertyRuntimeTimelineEntry<TSnapshot, TEvent>;

export interface PortablePropertyTimelineEntry {
  readonly kind: 'event' | 'command';
  readonly command: PropertyCommand;
}

export interface PortableTemporalFailure {
  readonly type: 'eventually' | 'until' | 'always' | 'never';
  readonly id: string;
  readonly description?: string;
  /** Only present for bounded (`eventually`/`until`) temporal properties. */
  readonly within?: number;
  readonly atStep: number;
}

export interface PortablePropertyReplayFixture {
  readonly formatVersion: 2;
  readonly machine?: {
    readonly id?: string;
    readonly version?: string;
  };
  readonly start:
    | { readonly type: 'input'; readonly input: unknown }
    | { readonly type: 'snapshot'; readonly snapshot: unknown };
  readonly timeline: readonly PortablePropertyTimelineEntry[];
  readonly failedAt: number;
  readonly temporalFailure?: PortableTemporalFailure;
}

interface LegacyPortablePropertyReplayFixture {
  readonly formatVersion: 1;
  readonly machine?: { readonly id?: string; readonly version?: string };
  readonly start:
    | { readonly type: 'input'; readonly input: unknown }
    | { readonly type: 'snapshot'; readonly snapshot: unknown };
  readonly prefixEvents: readonly unknown[];
  readonly events: readonly unknown[];
  readonly failedAt: number;
}

export interface PropertyTestAdapterResult {
  readonly runs: number;
  readonly exploration: {
    readonly configuredRuns: number | null;
    readonly maximumSequenceLength: number | null;
    readonly engine?: string;
    readonly seed?: number;
    readonly path?: string;
    readonly truncated?: boolean;
    readonly truncationReasons?: readonly string[];
  };
  readonly replay?: PropertyReplayMetadata;
  readonly error?: unknown;
}

export interface PropertyGeneratedCommand {
  readonly type: 'advance' | 'checkpoint' | 'stop';
  readonly generator: unknown;
  /** Relative generation weight. `1` unless configured otherwise. */
  readonly weight: number;
}

export interface PropertyTestAdapterRequest<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly events: readonly {
    readonly type: string;
    readonly caseId: string;
    readonly generator: unknown;
    /** Relative generation weight. `1` unless configured otherwise. */
    readonly weight: number;
  }[];
  readonly commands: readonly PropertyGeneratedCommand[];
  readonly runBudget?: number;
  /**
   * The number of runs already completed by earlier batches of the same
   * campaign. Adapters that derive their seed from a fixed value should offset
   * it by this number so batches explore different sequences.
   */
  readonly runOffset?: number;
  readonly createEvent: (type: string, payload: unknown) => TEvent;
  readonly createRunner: () => PropertyScenarioRunner<TSnapshot, TEvent>;
}

export interface PropertyTestAdapter<
  TKind extends PropertyGeneratorKind = PropertyGeneratorKind
> {
  readonly kind?: TKind;
  run<TSnapshot extends Snapshot<unknown>, TEvent extends EventObject>(
    request: PropertyTestAdapterRequest<TSnapshot, TEvent>
  ): Promise<PropertyTestAdapterResult>;
}

export interface PropertySutContext<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> extends PropertyLabelRecorders {
  readonly logic: ActorLogic<TSnapshot, TEvent, unknown>;
  readonly input: unknown;
  readonly snapshot: TSnapshot | undefined;
}

export interface PropertySut<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly create: (
    context: PropertySutContext<TSnapshot, TEvent>
  ) => PropertySutSession<TEvent> | Promise<PropertySutSession<TEvent>>;
  readonly projectModel: (snapshot: TSnapshot) => unknown;
  readonly projectSut?: (observed: unknown) => unknown;
  readonly equivalent?: (
    model: unknown,
    sut: unknown
  ) => boolean | Promise<boolean>;
}

export interface PropertySutSession<TEvent extends EventObject> {
  readonly send: (event: TEvent) => void | Promise<void>;
  readonly read: () => unknown | Promise<unknown>;
  readonly settle?: () => void | Promise<void>;
  readonly advance?: (
    milliseconds: number
  ) => readonly TEvent[] | Promise<readonly TEvent[]>;
  readonly checkpoint?: (label?: string) => void | Promise<void>;
  readonly stop?: () => void | Promise<void>;
  readonly dispose?: () => void | Promise<void>;
}

export interface PropertyTestModelSession<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly params: TestParam<TSnapshot, TEvent>;
  readonly dispose?: () => void | Promise<void>;
}

export interface PropertyTestModelExecution<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly create: (
    context: PropertySutContext<TSnapshot, TEvent>
  ) =>
    | PropertyTestModelSession<TSnapshot, TEvent>
    | Promise<PropertyTestModelSession<TSnapshot, TEvent>>;
}

export interface PropertyReferenceContext<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> extends PropertySutContext<TSnapshot, TEvent> {}

export interface PropertyReferenceOracle<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly create: (
    context: PropertyReferenceContext<TSnapshot, TEvent>
  ) =>
    | PropertyReferenceSession<TEvent>
    | Promise<PropertyReferenceSession<TEvent>>;
  readonly projectModel: (snapshot: TSnapshot) => unknown;
  readonly projectReference?: (observed: unknown) => unknown;
  readonly equivalent?: (
    model: unknown,
    reference: unknown
  ) => boolean | Promise<boolean>;
}

export interface PropertyReferenceSession<TEvent extends EventObject> {
  readonly transition: (event: TEvent) => void | Promise<void>;
  readonly read: () => unknown | Promise<unknown>;
  readonly stop?: () => void | Promise<void>;
  readonly dispose?: () => void | Promise<void>;
}

type EventType<TEvent extends EventObject> = TEvent['type'] & string;
type EventForType<
  TEvent extends EventObject,
  TType extends EventType<TEvent>
> = Extract<TEvent, { type: TType }>;
type EventPayload<TEvent extends EventObject> = Omit<TEvent, 'type'>;

/** Records a statistic for the current run. */
export interface PropertyLabelRecorders {
  /**
   * Records `name` (optionally with `value`) for the current run. Labels are
   * aggregated across the campaign into `coverage.labels`.
   */
  readonly label: (name: string, value?: string | number | boolean) => void;
  /** Records `name` when `condition` holds. */
  readonly classify: (condition: boolean, name: string) => void;
}

export interface PropertyInvariantContext<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> extends PropertyLabelRecorders {
  readonly initialSnapshot: TSnapshot;
  readonly previousSnapshot: TSnapshot;
  readonly snapshot: TSnapshot;
  readonly event: TEvent | undefined;
  readonly effects: readonly unknown[];
  readonly step: number;
}

export type PropertyInvariant<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = (
  context: PropertyInvariantContext<TSnapshot, TEvent>
) => void | Promise<void>;

export interface PropertyEventDescriptor<
  TGenerator,
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly generate: TGenerator;
  readonly case?: string;
  /**
   * Relative generation weight for this case. Must be a positive, finite
   * number. Defaults to `1`.
   */
  readonly weight?: number;
  readonly when?: (context: {
    readonly snapshot: TSnapshot;
    readonly event: TEvent;
  }) => boolean;
  readonly resolve?: never;
}

export interface PropertyResolvedEventDescriptor<
  TGenerator,
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly generate: TGenerator;
  readonly case?: string;
  /**
   * Relative generation weight for this case. Must be a positive, finite
   * number. Defaults to `1`.
   */
  readonly weight?: number;
  /** Resolves a shrinkable symbolic value against the current model snapshot. */
  readonly resolve: (context: {
    readonly snapshot: TSnapshot;
    readonly generated: unknown;
  }) => EventPayload<TEvent> | undefined;
  readonly when?: (context: {
    readonly snapshot: TSnapshot;
    readonly event: TEvent;
  }) => boolean;
}

type AnyPropertyEventDescriptor<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> =
  | PropertyEventDescriptor<unknown, TSnapshot, TEvent>
  | PropertyResolvedEventDescriptor<unknown, TSnapshot, TEvent>;

type PropertyEventGenerator<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TKind extends PropertyGeneratorKind
> =
  | PropertyGenerator<TKind, EventPayload<TEvent>>
  | PropertyEventDescriptor<
      PropertyGenerator<TKind, EventPayload<TEvent>>,
      TSnapshot,
      TEvent
    >
  | PropertyResolvedEventDescriptor<
      PropertyGenerator<TKind, unknown>,
      TSnapshot,
      TEvent
    >;

export type PropertyEventGenerators<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TKind extends PropertyGeneratorKind
> = {
  [TType in EventType<TEvent>]?:
    | PropertyEventGenerator<TSnapshot, EventForType<TEvent, TType>, TKind>
    | readonly PropertyEventGenerator<
        TSnapshot,
        EventForType<TEvent, TType>,
        TKind
      >[];
};

export type PropertyTemporalPredicate<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = (
  context: PropertyInvariantContext<TSnapshot, TEvent>
) => boolean | Promise<boolean>;

export type PropertyTemporal<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> =
  | {
      readonly type: 'eventually';
      readonly id: string;
      readonly description?: string;
      /**
       * Fails as soon as this many stable steps elapse without the predicate
       * holding. When omitted, the predicate must hold before the run ends.
       */
      readonly within?: number;
      readonly predicate: PropertyTemporalPredicate<TSnapshot, TEvent>;
    }
  | {
      readonly type: 'until';
      readonly id: string;
      readonly description?: string;
      /**
       * Fails as soon as this many stable steps elapse without `until`
       * holding. When omitted, `until` must hold before the run ends.
       */
      readonly within?: number;
      readonly hold: PropertyTemporalPredicate<TSnapshot, TEvent>;
      readonly until: PropertyTemporalPredicate<TSnapshot, TEvent>;
    }
  | {
      /** The predicate must hold on every stable step. */
      readonly type: 'always';
      readonly id: string;
      readonly description?: string;
      readonly predicate: PropertyTemporalPredicate<TSnapshot, TEvent>;
    }
  | {
      /** The predicate must never hold on any stable step. */
      readonly type: 'never';
      readonly id: string;
      readonly description?: string;
      readonly predicate: PropertyTemporalPredicate<TSnapshot, TEvent>;
    };

export interface PropertyStep<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> extends PropertyEventTimelineEntry<TSnapshot, TEvent> {
  readonly phase: 'prefix' | 'generated';
  readonly event: TEvent;
}

export interface PropertyTrace<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly start:
    | { readonly type: 'input'; readonly input: unknown }
    | { readonly type: 'snapshot'; readonly snapshot: TSnapshot };
  readonly initialSnapshot: TSnapshot;
  readonly initialEffects: readonly unknown[];
  readonly initialTransitionIds: readonly string[];
  readonly initialGuardIds: readonly string[];
  readonly timeline: readonly PropertyTimelineEntry<TSnapshot, TEvent>[];
  readonly prefixEvents: readonly TEvent[];
  readonly events: readonly TEvent[];
  readonly commands: readonly Exclude<
    PropertyCommand<TEvent>,
    { type: 'event' }
  >[];
  readonly steps: readonly PropertyStep<TSnapshot, TEvent>[];
  readonly finalSnapshot: TSnapshot;
  readonly finalObservation?: PropertyObservation;
}

/**
 * Builds the full failure message before `Error` captures the stack. The
 * formatted trace is part of the message so reporters that only print
 * `error.stack` still show the counterexample (GH #3435).
 */
function getPropertyFailureMessage<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(summary: string, trace: PropertyTrace<TSnapshot, TEvent>): string {
  try {
    return `${summary}\n${formatPropertyTrace(trace)}`;
  } catch {
    // Never mask the failure with a formatting error.
    return summary;
  }
}

export class PropertyTestFailure<
  TSnapshot extends Snapshot<unknown> = Snapshot<unknown>,
  TEvent extends EventObject = EventObject
> extends Error {
  /** The short message, without the formatted trace. */
  public readonly summary: string;

  public constructor(
    summary: string,
    public readonly trace: PropertyTrace<TSnapshot, TEvent>,
    public readonly cause: unknown,
    public readonly replay?: PropertyReplayMetadata,
    public readonly fixture?: PortablePropertyReplayFixture,
    public readonly coverage?: PropertyCoverage
  ) {
    super(getPropertyFailureMessage(summary, trace), { cause });
    this.name = 'PropertyTestFailure';
    this.summary = summary;
  }
}

interface TemporalState<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  definition: PropertyTemporal<TSnapshot, TEvent>;
  satisfied: boolean;
}

/**
 * Structural, key-order insensitive deep equality used to compare model
 * projections against reference/SUT observations. Cycle-safe.
 */
export function defaultEquivalent(left: unknown, right: unknown): boolean {
  return deepEqual(left, right, new Map());
}

function deepEqual(
  left: unknown,
  right: unknown,
  visited: Map<object, Set<object>>
): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    left === null ||
    right === null
  ) {
    // `NaN` is handled by `Object.is`; `0`/`-0` are treated as equal.
    return left === right;
  }
  const seen = visited.get(left);
  if (seen?.has(right)) {
    return true;
  }
  if (seen) {
    seen.add(right);
  } else {
    visited.set(left, new Set([right]));
  }
  if (left instanceof Date || right instanceof Date) {
    return (
      left instanceof Date &&
      right instanceof Date &&
      left.getTime() === right.getTime()
    );
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index], visited))
    );
  }
  if (left instanceof Map || right instanceof Map) {
    if (!(left instanceof Map) || !(right instanceof Map)) {
      return false;
    }
    if (left.size !== right.size) {
      return false;
    }
    for (const [key, value] of left) {
      if (!right.has(key) || !deepEqual(value, right.get(key), visited)) {
        return false;
      }
    }
    return true;
  }
  if (left instanceof Set || right instanceof Set) {
    if (!(left instanceof Set) || !(right instanceof Set)) {
      return false;
    }
    if (left.size !== right.size) {
      return false;
    }
    for (const value of left) {
      if (!right.has(value)) {
        return false;
      }
    }
    return true;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      deepEqual(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key],
        visited
      )
  );
}

function assertPropertyWeight(
  weight: number | undefined,
  location: string
): number {
  if (weight === undefined) {
    return 1;
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    throw new Error(
      `Property ${location} has an invalid \`weight\` (${String(
        weight
      )}). Weights must be positive, finite numbers.`
    );
  }
  return weight;
}

function assertEventPayload(
  payload: unknown,
  type: string,
  caseId?: string
): asserts payload is object {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    const location = caseId
      ? `Property event case ${caseId}`
      : `Property event "${type}"`;
    throw new Error(
      `${location} generated a non-object payload (${
        typeof payload === 'string' ? JSON.stringify(payload) : String(payload)
      }). Event payloads must be plain objects; use a \`resolve\` function to map generated values onto an event payload.`
    );
  }
}

export class PropertyScenarioRunner<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  private snapshot!: TSnapshot;
  private initialSnapshot!: TSnapshot;
  private initialEffects: readonly unknown[] = [];
  private initialTransitionIds: readonly string[] = [];
  private initialGuardIds: readonly string[] = [];
  private readonly timeline: PropertyTimelineEntry<TSnapshot, TEvent>[] = [];
  private readonly temporal: TemporalState<TSnapshot, TEvent>[];
  private stableStep = 0;
  private started = false;
  private finished = false;
  private sutSession: PropertySutSession<TEvent> | undefined;
  private referenceSession: PropertyReferenceSession<TEvent> | undefined;
  private testModelSession:
    | PropertyTestModelSession<TSnapshot, TEvent>
    | undefined;
  private lastObservation: PropertyObservation | undefined;
  private readonly inconclusiveTemporalIds: string[] = [];
  private generatedCommandCount = 0;
  private readonly labelsSeen = new Set<string>();

  /** Records a label for this run. */
  public readonly label = (
    name: string,
    value?: string | number | boolean
  ): void => {
    recordPropertyLabel(this.coverage, name, value, this.labelsSeen);
  };

  /** Records `name` when `condition` holds. */
  public readonly classify = (condition: boolean, name: string): void => {
    if (condition) {
      this.label(name);
    }
  };

  public constructor(
    private readonly logic: ActorLogic<TSnapshot, TEvent, unknown>,
    private readonly input: unknown,
    private readonly startingSnapshot: TSnapshot | undefined,
    private readonly serializeStartingSnapshot:
      | ((snapshot: TSnapshot) => unknown)
      | undefined,
    private readonly prefixEvents: readonly TEvent[],
    private readonly frontierId: string | undefined,
    private readonly sut: PropertySut<TSnapshot, TEvent> | undefined,
    private readonly testModel: TestModel<TSnapshot, TEvent, unknown>,
    private readonly testModelExecution:
      | PropertyTestModelExecution<TSnapshot, TEvent>
      | undefined,
    private readonly reference:
      | PropertyReferenceOracle<TSnapshot, TEvent>
      | undefined,
    private readonly invariant: PropertyInvariant<TSnapshot, TEvent>,
    temporal: readonly PropertyTemporal<TSnapshot, TEvent>[],
    private readonly eventDescriptors: ReadonlyMap<
      string,
      AnyPropertyEventDescriptor<TSnapshot, TEvent>
    >,
    private readonly coverage: MutablePropertyCoverage
  ) {
    this.temporal = temporal.map((definition) => ({
      definition,
      satisfied: false
    }));
  }

  public async start(): Promise<void> {
    resetPropertyTransitionPairs(this.coverage);
    const [snapshot, effects, selected, guards, resolutions]: [
      TSnapshot,
      readonly unknown[],
      readonly AnyTransitionDefinition[],
      readonly import('../transition.ts').GuardEvaluation[],
      readonly import('../transition.ts').TransitionResolution[]
    ] = this.startingSnapshot
      ? [this.startingSnapshot, [], [], [], []]
      : (initialTransitionWithDetails(this.logic, this.input as never) as [
          TSnapshot,
          readonly unknown[],
          readonly AnyTransitionDefinition[],
          readonly import('../transition.ts').GuardEvaluation[],
          readonly import('../transition.ts').TransitionResolution[]
        ]);
    this.snapshot = snapshot;
    this.initialSnapshot = snapshot;
    this.initialEffects = effects;
    this.initialTransitionIds = recordPropertyTransitions(
      this.coverage,
      { type: XSTATE_INIT },
      selected,
      resolutions
    );
    this.initialGuardIds = recordPropertyGuards(this.coverage, guards);
    this.started = true;
    this.recordSnapshot(snapshot);
    const context = {
      logic: this.logic,
      input: this.input,
      snapshot: this.startingSnapshot,
      label: this.label,
      classify: this.classify
    };
    if (this.reference) {
      this.referenceSession = await this.reference.create(context);
    }
    if (this.sut) {
      this.sutSession = await this.sut.create(context);
    }
    if (this.testModelExecution) {
      this.testModelSession = await this.testModelExecution.create(context);
    }
    await this.checkStable(undefined, snapshot, snapshot, effects);
    for (const event of this.prefixEvents) {
      await this.executeEvent(event, 'prefix', 'frontier', true);
    }
    if (this.frontierId) {
      incrementCoverage(this.coverage.frontiers, this.frontierId);
    }
  }

  public canRun(event: TEvent, caseId: string): boolean {
    return this.canRunResolved(event, caseId);
  }

  public canRunGenerated(
    type: string,
    generated: unknown,
    caseId: string
  ): boolean {
    return this.canRunResolved(
      this.resolveGeneratedEvent(type, generated, caseId),
      caseId
    );
  }

  private canRunResolved(event: TEvent | undefined, caseId: string): boolean {
    recordPropertyEventCase(this.coverage, caseId, 'generated');
    const descriptor = this.eventDescriptors.get(caseId);
    const canRun =
      !!event &&
      this.snapshot.status === 'active' &&
      (descriptor?.when?.({ snapshot: this.snapshot, event }) ?? true);
    if (!canRun) {
      this.coverage.skipped++;
      recordPropertyEventCase(this.coverage, caseId, 'ignored');
    } else {
      recordPropertyEventCase(this.coverage, caseId, 'applicable');
    }
    return canRun;
  }

  private resolveGeneratedEvent(
    type: string,
    generated: unknown,
    caseId: string
  ): TEvent | undefined {
    const descriptor = this.eventDescriptors.get(caseId);
    const payload =
      descriptor && 'resolve' in descriptor && descriptor.resolve
        ? descriptor.resolve({ snapshot: this.snapshot, generated })
        : generated;
    if (payload === undefined) {
      return undefined;
    }
    assertEventPayload(payload, type, caseId);
    return { ...payload, type } as TEvent;
  }

  public canRunCommand(applicable: boolean): boolean {
    if (!applicable) {
      this.coverage.skipped++;
    }
    return applicable;
  }

  public async run(event: TEvent, caseId: string): Promise<void> {
    this.assertStarted();
    this.recordGeneratedCommand();
    recordPropertyEventCase(this.coverage, caseId, 'executed');
    await this.executeEvent(
      event,
      'generated',
      'generator',
      true,
      true,
      caseId
    );
  }

  public async runGenerated(
    type: string,
    generated: unknown,
    caseId: string
  ): Promise<void> {
    const event = this.resolveGeneratedEvent(type, generated, caseId);
    if (!event) {
      throw new Error(
        `Property event case ${caseId} became inapplicable before execution`
      );
    }
    await this.run(event, caseId);
  }

  public async replay(command: PropertyCommand<TEvent>): Promise<void> {
    this.assertStarted();
    if (command.type === 'event') {
      await this.executeEvent(
        command.event,
        command.phase,
        command.origin,
        command.origin !== 'clock',
        true,
        command.caseId
      );
    } else if (command.type === 'advance') {
      this.coverage.clockAdvances++;
      this.timeline.push({
        kind: 'command',
        index: this.timeline.length,
        command,
        previousSnapshot: this.snapshot,
        snapshot: this.snapshot,
        effects: [],
        transitionIds: [],
        guardIds: []
      });
    } else if (command.type === 'checkpoint') {
      await this.checkpoint(command.label);
    } else {
      await this.stop();
    }
  }

  public async advance(milliseconds: number): Promise<void> {
    this.assertStarted();
    this.recordGeneratedCommand();
    if (!this.sutSession?.advance) {
      throw new Error('Property SUT does not support clock advancement');
    }
    const previousSnapshot = this.snapshot;
    const events = await this.sutSession.advance(milliseconds);
    const command: Extract<PropertyCommand<TEvent>, { type: 'advance' }> = {
      type: 'advance',
      milliseconds,
      deliveredEvents: events.slice()
    };
    this.coverage.clockAdvances++;
    this.timeline.push({
      kind: 'command',
      index: this.timeline.length,
      command,
      previousSnapshot,
      snapshot: this.snapshot,
      effects: [],
      transitionIds: [],
      guardIds: []
    });
    for (let index = 0; index < events.length; index++) {
      await this.executeEvent(
        events[index],
        'generated',
        'clock',
        false,
        index === events.length - 1
      );
    }
    if (!events.length) {
      this.lastObservation = await this.compareObservations();
      this.replaceLastObservation(this.lastObservation);
    }
  }

  public async checkpoint(label?: string): Promise<void> {
    this.assertStarted();
    this.recordGeneratedCommand();
    const entry: PropertyRuntimeTimelineEntry<TSnapshot, TEvent> = {
      kind: 'command',
      index: this.timeline.length,
      command: { type: 'checkpoint', label },
      previousSnapshot: this.snapshot,
      snapshot: this.snapshot,
      effects: [],
      transitionIds: [],
      guardIds: []
    };
    this.timeline.push(entry);
    await this.sutSession?.checkpoint?.(label);
    this.coverage.checkpoints++;
    const observation = await this.compareObservations();
    this.lastObservation = observation;
    (entry as { observation?: PropertyObservation }).observation = observation;
  }

  public async stop(): Promise<void> {
    this.assertStarted();
    this.recordGeneratedCommand();
    const previousSnapshot = this.snapshot;
    const [snapshot, effects, selected, guards, resolutions] =
      transitionWithDetails(this.logic, previousSnapshot, {
        type: XSTATE_STOP
      } as TEvent);
    this.snapshot = snapshot;
    await this.referenceSession?.stop?.();
    await this.sutSession?.stop?.();
    const transitionIds = recordPropertyTransitions(
      this.coverage,
      { type: XSTATE_STOP },
      selected,
      resolutions
    );
    const guardIds = recordPropertyGuards(this.coverage, guards);
    this.coverage.stops++;
    this.coverage.steps++;
    this.coverage.generatedSteps++;
    this.recordSnapshot(snapshot);
    const entry: PropertyRuntimeTimelineEntry<TSnapshot, TEvent> = {
      kind: 'command',
      index: this.timeline.length,
      command: { type: 'stop' },
      previousSnapshot,
      snapshot,
      effects,
      transitionIds,
      guardIds
    };
    this.timeline.push(entry);
    const observation = await this.checkStable(
      undefined,
      previousSnapshot,
      snapshot,
      effects
    );
    (entry as { observation?: PropertyObservation }).observation = observation;
  }

  public finish(): void {
    this.assertStarted();
    if (this.finished) {
      return;
    }
    this.finished = true;
    for (const state of this.temporal) {
      if (state.satisfied) {
        continue;
      }
      const definition = state.definition;
      if (definition.type !== 'eventually' && definition.type !== 'until') {
        // `always`/`never` are checked on every stable step; reaching the end
        // of the run without a failure means the property held.
        recordPropertyTemporal(this.coverage, definition.id, 'satisfied');
        continue;
      }
      if (definition.within !== undefined) {
        // The run ended before the bound elapsed, so the property is
        // inconclusive rather than violated.
        recordPropertyTemporal(this.coverage, definition.id, 'inconclusive');
        this.inconclusiveTemporalIds.push(definition.id);
        continue;
      }
      this.failTemporal(definition);
    }
  }

  /** Bounded temporal properties that the run ended before deciding. */
  public getInconclusiveTemporalIds(): readonly string[] {
    return this.inconclusiveTemporalIds.slice();
  }

  /** The number of stable steps observed so far. */
  public getStableStep(): number {
    return this.stableStep;
  }

  public async dispose(): Promise<void> {
    const errors: unknown[] = [];
    for (const dispose of [
      this.testModelSession?.dispose,
      this.sutSession?.dispose,
      this.referenceSession?.dispose
    ]) {
      try {
        await dispose?.();
      } catch (error) {
        errors.push(error);
      }
    }
    this.sutSession = undefined;
    this.referenceSession = undefined;
    this.testModelSession = undefined;
    if (errors.length) {
      throw new AggregateError(errors, 'Property scenario disposal failed');
    }
  }

  public getSnapshot(): TSnapshot {
    return this.snapshot;
  }

  public getTrace(): PropertyTrace<TSnapshot, TEvent> {
    const steps = this.timeline
      .filter(
        (entry): entry is PropertyEventTimelineEntry<TSnapshot, TEvent> =>
          entry.kind === 'event'
      )
      .map(
        (entry): PropertyStep<TSnapshot, TEvent> => ({
          ...entry,
          phase: entry.command.phase,
          event: entry.command.event
        })
      );
    return {
      start: this.startingSnapshot
        ? { type: 'snapshot', snapshot: this.startingSnapshot }
        : { type: 'input', input: this.input },
      initialSnapshot: this.initialSnapshot,
      initialEffects: this.initialEffects,
      initialTransitionIds: this.initialTransitionIds,
      initialGuardIds: this.initialGuardIds,
      timeline: this.timeline.slice(),
      prefixEvents: steps
        .filter((step) => step.phase === 'prefix')
        .map((step) => step.event),
      events: steps
        .filter(
          (step) =>
            step.phase === 'generated' && step.command.origin === 'generator'
        )
        .map((step) => step.event),
      commands: this.timeline
        .filter(
          (entry): entry is PropertyRuntimeTimelineEntry<TSnapshot, TEvent> =>
            entry.kind === 'command'
        )
        .map((entry) => entry.command),
      steps,
      finalSnapshot: this.snapshot,
      finalObservation: this.lastObservation
    };
  }

  private async executeEvent(
    event: TEvent,
    phase: 'prefix' | 'generated',
    origin: 'frontier' | 'generator' | 'clock',
    sendToSut: boolean,
    compare = true,
    caseId?: string
  ): Promise<void> {
    const previousSnapshot = this.snapshot;
    const [snapshot, effects, selected, guards, resolutions] =
      transitionWithDetails(this.logic, previousSnapshot, event);
    this.snapshot = snapshot;
    if (this.referenceSession) {
      await this.referenceSession.transition(event);
    }
    if (sendToSut) {
      await this.sutSession?.send(event);
    }
    const transitionIds = recordPropertyTransitions(
      this.coverage,
      event,
      selected,
      resolutions
    );
    const guardIds = recordPropertyGuards(this.coverage, guards);
    this.coverage.steps++;
    if (phase === 'prefix') {
      this.coverage.prefixSteps++;
    } else {
      this.coverage.generatedSteps++;
    }
    this.recordSnapshot(snapshot);
    const entry: PropertyEventTimelineEntry<TSnapshot, TEvent> = {
      kind: 'event',
      index: this.timeline.length,
      command: { type: 'event', event, phase, origin, caseId },
      previousSnapshot,
      snapshot,
      effects,
      transitionIds,
      guardIds,
      activeStateIds: this.getActiveStateIds(snapshot)
    };
    this.timeline.push(entry);
    if (sendToSut && this.testModelSession) {
      try {
        await this.testModel.testTransition(this.testModelSession.params, {
          event,
          state: snapshot
        } satisfies Step<TSnapshot, TEvent>);
      } catch (cause) {
        this.fail(
          `Test model event executor failed for ${JSON.stringify(event)}`,
          cause,
          this.stableStep
        );
      }
    }
    const observation = await this.checkStable(
      event,
      previousSnapshot,
      snapshot,
      effects,
      compare
    );
    (entry as { observation?: PropertyObservation }).observation = observation;
  }

  private async checkStable(
    event: TEvent | undefined,
    previousSnapshot: TSnapshot,
    snapshot: TSnapshot,
    effects: readonly unknown[],
    compare = true
  ): Promise<PropertyObservation | undefined> {
    const step = this.stableStep++;
    const observation = compare ? await this.compareObservations() : undefined;
    this.lastObservation = observation;
    if (this.testModelSession) {
      try {
        await this.testModel.testState(this.testModelSession.params, snapshot);
      } catch (cause) {
        this.fail(
          `Test model state assertion failed after ${step} step${
            step === 1 ? '' : 's'
          }`,
          cause,
          step
        );
      }
    }
    this.coverage.invariantChecks++;
    try {
      await this.invariant({
        initialSnapshot: this.initialSnapshot,
        previousSnapshot,
        snapshot,
        event,
        effects,
        step,
        label: this.label,
        classify: this.classify
      });
    } catch (cause) {
      this.fail(
        `Property invariant failed after ${step} step${step === 1 ? '' : 's'}`,
        cause,
        step
      );
    }
    await this.checkTemporal({
      initialSnapshot: this.initialSnapshot,
      previousSnapshot,
      snapshot,
      event,
      effects,
      step,
      label: this.label,
      classify: this.classify
    });
    return observation;
  }

  private async checkTemporal(
    context: PropertyInvariantContext<TSnapshot, TEvent>
  ): Promise<void> {
    for (const state of this.temporal) {
      if (state.satisfied) {
        continue;
      }
      this.coverage.temporalChecks++;
      const definition = state.definition;
      if (definition.type === 'always') {
        if (!(await definition.predicate(context))) {
          this.failTemporal(definition);
        }
        continue;
      }
      if (definition.type === 'never') {
        if (await definition.predicate(context)) {
          this.failTemporal(definition);
        }
        continue;
      }
      if (definition.type === 'eventually') {
        state.satisfied = await definition.predicate(context);
      } else if (await definition.until(context)) {
        state.satisfied = true;
      } else if (!(await definition.hold(context))) {
        this.failTemporal(definition);
      }
      if (state.satisfied) {
        recordPropertyTemporal(this.coverage, definition.id, 'satisfied');
      }
      if (
        !state.satisfied &&
        definition.within !== undefined &&
        context.step >= definition.within
      ) {
        this.failTemporal(definition);
      }
    }
  }

  private failTemporal(definition: PropertyTemporal<TSnapshot, TEvent>): never {
    recordPropertyTemporal(this.coverage, definition.id, 'failed');
    const failure: PortableTemporalFailure = {
      type: definition.type,
      id: definition.id,
      description: definition.description,
      within:
        definition.type === 'eventually' || definition.type === 'until'
          ? definition.within
          : undefined,
      atStep: this.stableStep - 1
    };
    this.fail(
      `Temporal property "${definition.id}" failed`,
      failure,
      failure.atStep,
      failure
    );
  }

  private async compareObservations(): Promise<
    PropertyObservation | undefined
  > {
    if (!this.reference && !this.sut) {
      return undefined;
    }
    await this.sutSession?.settle?.();
    const referenceRaw = await this.referenceSession?.read();
    const sutRaw = await this.sutSession?.read();
    const model = this.reference
      ? this.reference.projectModel(this.snapshot)
      : this.sut!.projectModel(this.snapshot);
    const reference = this.reference
      ? this.reference.projectReference
        ? this.reference.projectReference(referenceRaw)
        : referenceRaw
      : undefined;
    const sut = this.sut
      ? this.sut.projectSut
        ? this.sut.projectSut(sutRaw)
        : sutRaw
      : undefined;
    const sutModel = this.sut
      ? this.sut.projectModel(this.snapshot)
      : undefined;
    const observation: PropertyObservation = {
      model,
      reference: this.reference ? { model, observed: reference } : undefined,
      sut: this.sut ? { model: sutModel, observed: sut } : undefined
    };
    let referenceMatches = true;
    let sutMatches = true;
    if (this.reference) {
      this.coverage.oracleComparisons++;
      referenceMatches = this.reference.equivalent
        ? await this.reference.equivalent(model, reference)
        : defaultEquivalent(model, reference);
    }
    if (this.sut) {
      this.coverage.sutComparisons++;
      sutMatches = this.sut.equivalent
        ? await this.sut.equivalent(sutModel, sut)
        : defaultEquivalent(sutModel, sut);
    }
    if (!referenceMatches || !sutMatches) {
      this.lastObservation = observation;
      this.replaceLastObservation(observation);
      this.fail(
        'Property observation diverged',
        {
          model,
          reference: observation.reference,
          sut: observation.sut,
          referenceMatches,
          sutMatches
        },
        this.stableStep
      );
    }
    return observation;
  }

  private replaceLastObservation(observation: PropertyObservation | undefined) {
    const last = this.timeline.at(-1);
    if (last) {
      (last as { observation?: PropertyObservation }).observation = observation;
    }
  }

  private recordSnapshot(snapshot: TSnapshot): void {
    recordPropertySnapshot(this.coverage, snapshot);
  }

  private recordGeneratedCommand(): void {
    this.generatedCommandCount++;
    this.coverage.maximumObservedSequenceLength = Math.max(
      this.coverage.maximumObservedSequenceLength,
      this.generatedCommandCount
    );
  }

  private getActiveStateIds(snapshot: TSnapshot): readonly string[] {
    const nodes =
      (
        snapshot as {
          nodes?: readonly { id: string }[];
          _nodes?: readonly { id: string }[];
        }
      ).nodes ?? (snapshot as { _nodes?: readonly { id: string }[] })._nodes;
    return nodes?.map((node) => node.id) ?? [];
  }

  private assertStarted(): void {
    if (!this.started) {
      throw new Error('Property scenario runner has not been started');
    }
  }

  private fail(
    message: string,
    cause: unknown,
    failedAt: number,
    temporalFailure?: PortableTemporalFailure
  ): never {
    let fixture: PortablePropertyReplayFixture | undefined;
    try {
      fixture = this.getReplayFixture(failedAt, temporalFailure);
    } catch {
      // Never mask the underlying failure with a fixture-construction error.
      fixture = undefined;
    }
    throw new PropertyTestFailure(
      message,
      this.getTrace(),
      cause,
      undefined,
      fixture
    );
  }

  private getReplayFixture(
    failedAt: number,
    temporalFailure?: PortableTemporalFailure
  ): PortablePropertyReplayFixture {
    const identity = this.logic as { id?: string; version?: string };
    if (this.startingSnapshot && !this.serializeStartingSnapshot) {
      throw new Error(
        'Property tests starting from a snapshot require serializeSnapshot to create replay fixtures'
      );
    }
    return {
      formatVersion: 2,
      machine:
        identity.id || identity.version
          ? { id: identity.id, version: identity.version }
          : undefined,
      start: this.startingSnapshot
        ? {
            type: 'snapshot',
            snapshot: this.serializeStartingSnapshot!(this.startingSnapshot)
          }
        : { type: 'input', input: this.input },
      timeline: this.timeline.map((entry) => ({
        kind: entry.kind,
        command: entry.command as PropertyCommand
      })),
      failedAt,
      temporalFailure
    };
  }
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

export interface PropertyFrontierContext<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly frontier: StatePath<TSnapshot, TEvent>;
  readonly index: number;
  readonly id: string;
}

export interface PropertyFrontierOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly paths: readonly StatePath<TSnapshot, TEvent>[];
  readonly select?: (
    context: PropertyFrontierContext<TSnapshot, TEvent>
  ) => boolean;
  readonly runsPerFrontier?:
    | number
    | ((context: PropertyFrontierContext<TSnapshot, TEvent>) => number);
}

/**
 * A command generator, optionally paired with a relative generation weight. A
 * bare generator is equivalent to `{ generate, weight: 1 }`; a `weight` key is
 * what distinguishes the descriptor form.
 */
export interface PropertyCommandDescriptor<TGenerator> {
  readonly generate: TGenerator;
  /** Positive, finite relative generation weight. Defaults to `1`. */
  readonly weight?: number;
}

export type PropertyCommandGenerator<
  TKind extends PropertyGeneratorKind,
  TValue
> =
  | PropertyGenerator<TKind, TValue>
  | PropertyCommandDescriptor<PropertyGenerator<TKind, TValue>>;

export interface PropertyTestOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TKind extends PropertyGeneratorKind
> {
  readonly adapter: PropertyTestAdapter<TKind>;
  readonly events: PropertyEventGenerators<TSnapshot, TEvent, TKind>;
  readonly commands?: {
    readonly advance?: PropertyCommandGenerator<TKind, number>;
    readonly checkpoint?: PropertyCommandGenerator<
      TKind,
      { readonly label?: string }
    >;
    readonly stop?: PropertyCommandGenerator<TKind, Record<string, never>>;
  };
  readonly sut?: PropertySut<TSnapshot, TEvent>;
  readonly test?: PropertyTestModelExecution<TSnapshot, TEvent>;
  readonly reference?: PropertyReferenceOracle<TSnapshot, TEvent>;
  readonly input?: TInput;
  readonly start?: {
    readonly snapshot: TSnapshot;
    readonly serializeSnapshot: (snapshot: TSnapshot) => unknown;
  };
  readonly frontiers?:
    | readonly StatePath<TSnapshot, TEvent>[]
    | PropertyFrontierOptions<TSnapshot, TEvent>
    | 'auto'
    | PropertyAutoFrontierOptions;
  readonly invariant: PropertyInvariant<TSnapshot, TEvent>;
  readonly temporal?: readonly PropertyTemporal<TSnapshot, TEvent>[];
  /**
   * Stops the campaign as soon as the condition holds. Coverage is
   * re-evaluated between batches of `batchRuns` runs. Without `until` (and
   * without `frontiers: 'auto'`) the adapter is invoked exactly once.
   */
  readonly until?: PropertyStopCondition;
  /** Runs per batch in a batched campaign. Defaults to 25. */
  readonly batchRuns?: number;
  /** Total runs a batched campaign may complete. Defaults to 100. */
  readonly maxRuns?: number;
  /** Minimum label frequencies the campaign must reach. */
  readonly expectLabels?: PropertyLabelExpectations;
}

/** Minimum frequencies required of labels recorded during the campaign. */
export interface PropertyLabelExpectations {
  readonly [name: string]: {
    /** Minimum share of completed runs that must record the label, `0`..`1`. */
    readonly min?: number;
    /** Minimum total occurrences of the label. */
    readonly minCount?: number;
  };
}

/**
 * Ratios are `covered / (covered + uncovered)`. Every listed key must hold;
 * `any` holds when at least one of its conditions does.
 */
export interface PropertyStopConditionObject {
  readonly stateNodes?: number;
  readonly transitions?: number;
  readonly transitionPairs?: number;
  readonly guards?: number;
  /** The share of event cases executed at least once. */
  readonly eventCases?: number;
  readonly requirements?: number;
  readonly runs?: number;
  readonly timeMs?: number;
  readonly any?: readonly PropertyStopCondition[];
}

export type PropertyStopCondition =
  | PropertyStopConditionObject
  | ((coverage: PropertyCoverage) => boolean);

/** Coverage-guided exploration. See `frontiers: 'auto'`. */
export interface PropertyAutoFrontierOptions {
  readonly strategy: 'uncovered';
  /** Frontiers explored per batch. Defaults to 5. */
  readonly maxFrontiers?: number;
  /** Runs per frontier. Defaults to an even split of the batch. */
  readonly runsPerFrontier?: number;
  /** Traversal limit for the shortest-path search. Defaults to 1000. */
  readonly limit?: number;
}

const DEFAULT_BATCH_RUNS = 25;
const DEFAULT_MAX_RUNS = 100;
const DEFAULT_MAX_FRONTIERS = 5;
const DEFAULT_FRONTIER_SEARCH_LIMIT = 1000;

function getCoverageRatio(dimension: PropertyCoverageDimension): number {
  const considered = dimension.covered.length + dimension.uncovered.length;
  return considered ? dimension.covered.length / considered : 1;
}

function getEventCaseRatio(coverage: PropertyCoverage): number {
  const cases = Object.values(coverage.eventCases);
  if (!cases.length) {
    return 1;
  }
  return cases.filter((counts) => counts.executed > 0).length / cases.length;
}

/** Evaluates a {@link PropertyStopCondition} against aggregated coverage. */
export function evaluatePropertyStopCondition(
  condition: PropertyStopCondition,
  coverage: PropertyCoverage,
  elapsedMs: number
): boolean {
  if (typeof condition === 'function') {
    return condition(coverage);
  }
  const clauses: boolean[] = [];
  for (const key of [
    'stateNodes',
    'transitions',
    'transitionPairs',
    'guards',
    'requirements'
  ] as const) {
    const threshold = condition[key];
    if (threshold !== undefined) {
      clauses.push(getCoverageRatio(coverage[key]) >= threshold);
    }
  }
  if (condition.eventCases !== undefined) {
    clauses.push(getEventCaseRatio(coverage) >= condition.eventCases);
  }
  if (condition.runs !== undefined) {
    clauses.push(coverage.exploration.completedRuns >= condition.runs);
  }
  if (condition.timeMs !== undefined) {
    clauses.push(elapsedMs >= condition.timeMs);
  }
  if (condition.any?.length) {
    clauses.push(
      condition.any.some((nested) =>
        evaluatePropertyStopCondition(nested, coverage, elapsedMs)
      )
    );
  }
  // An empty condition never stops the campaign.
  return clauses.length > 0 && clauses.every(Boolean);
}

function getSnapshotStateNodeIds(
  snapshot: Snapshot<unknown>
): readonly string[] {
  const nodes =
    (
      snapshot as {
        nodes?: readonly { id: string }[];
        _nodes?: readonly { id: string }[];
      }
    ).nodes ?? (snapshot as { _nodes?: readonly { id: string }[] })._nodes;
  return nodes?.map((node) => node.id) ?? [];
}

function getTransitionSourceId(id: string): string | undefined {
  try {
    const parsed = JSON.parse(id) as unknown[];
    return Array.isArray(parsed) && parsed[0] === 'transition'
      ? String(parsed[1])
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Picks the shortest paths that reach the state nodes owning the most
 * uncovered transitions, deduplicated by target configuration.
 */
function selectUncoveredFrontiers<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  paths: readonly StatePath<TSnapshot, TEvent>[],
  coverage: PropertyCoverage,
  maxFrontiers: number
): StatePath<TSnapshot, TEvent>[] {
  const uncoveredBySource = new Map<string, number>();
  for (const id of coverage.transitions.uncovered) {
    const source = getTransitionSourceId(id);
    if (source === undefined) {
      continue;
    }
    uncoveredBySource.set(source, (uncoveredBySource.get(source) ?? 0) + 1);
  }
  const ranked = [...uncoveredBySource].sort(
    ([leftId, left], [rightId, right]) =>
      right - left || leftId.localeCompare(rightId)
  );
  const selected: StatePath<TSnapshot, TEvent>[] = [];
  const seen = new Set<string>();
  for (const [sourceId] of ranked) {
    let best: StatePath<TSnapshot, TEvent> | undefined;
    for (const path of paths) {
      if (
        !path.steps.length ||
        !getSnapshotStateNodeIds(path.state).includes(sourceId)
      ) {
        continue;
      }
      if (!best || path.weight < best.weight) {
        best = path;
      }
    }
    if (!best) {
      continue;
    }
    const key = getPropertyConfigurationId(best.state);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    selected.push(best);
    if (selected.length >= maxFrontiers) {
      break;
    }
  }
  return selected;
}

function getLabelExpectationFailures(
  expectations: PropertyLabelExpectations,
  coverage: PropertyCoverage
): string[] {
  const failures: string[] = [];
  for (const [name, expectation] of Object.entries(expectations)) {
    const label = coverage.labels[name] ?? { count: 0, values: {}, share: 0 };
    if (expectation.min !== undefined && label.share < expectation.min) {
      failures.push(
        `${name}: share ${label.share.toFixed(3)} is below ${expectation.min}`
      );
    }
    if (
      expectation.minCount !== undefined &&
      label.count < expectation.minCount
    ) {
      failures.push(
        `${name}: count ${label.count} is below ${expectation.minCount}`
      );
    }
  }
  return failures;
}

function getFrontierId<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(frontier: StatePath<TSnapshot, TEvent>): string {
  return JSON.stringify([
    'frontier',
    getPropertyConfigurationId(frontier.state),
    frontier.steps
      .map((step) => step.event)
      .filter((event) => event.type !== XSTATE_INIT)
  ]);
}

interface PropertyExplorationAccumulator {
  configuredRuns: number;
  configuredRunsOverride: number | null;
  stoppedBecause: PropertyStoppedBecause;
  configuredRunsUnknown: boolean;
  completedRuns: number;
  maximumSequenceLength: number | null;
  maximumSequenceLengthUnknown: boolean;
  frontiers: PropertyExplorationFrontier[];
  seeds: PropertyExplorationSeed[];
  truncationReasons: Set<string>;
}

function finalizeExploration(
  coverage: MutablePropertyCoverage,
  accumulator: PropertyExplorationAccumulator
): PropertyExplorationBounds {
  const maximumSequenceLength = accumulator.maximumSequenceLengthUnknown
    ? null
    : accumulator.maximumSequenceLength;
  if (
    maximumSequenceLength !== null &&
    coverage.maximumObservedSequenceLength >= maximumSequenceLength
  ) {
    accumulator.truncationReasons.add('maximum sequence length reached');
  }
  return {
    configuredRuns:
      accumulator.configuredRunsOverride ??
      (accumulator.configuredRunsUnknown ? null : accumulator.configuredRuns),
    stoppedBecause: accumulator.stoppedBecause,
    completedRuns: accumulator.completedRuns,
    attemptedRuns: coverage.runs,
    maximumSequenceLength,
    maximumObservedSequenceLength: coverage.maximumObservedSequenceLength,
    frontiers: accumulator.frontiers.slice(),
    seeds: accumulator.seeds.slice(),
    truncated: accumulator.truncationReasons.size > 0,
    truncationReasons: [...accumulator.truncationReasons].sort()
  };
}

export async function propertyTest<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>,
  TKind extends PropertyGeneratorKind
>(
  source: TSource,
  options: PropertyTestOptions<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>,
    InputFromSource<TSource>,
    TKind
  >
): Promise<{ coverage: PropertyCoverage }> {
  const model =
    source instanceof TestModel
      ? source
      : new TestModel(source as ActorLogic<any, any, any>);
  const eventDescriptors = new Map<
    string,
    AnyPropertyEventDescriptor<
      SnapshotFromSource<TSource>,
      EventFromSource<TSource>
    >
  >();
  const events = Object.entries(options.events).flatMap(
    ([type, configured]) => {
      const cases = Array.isArray(configured) ? configured : [configured];
      return cases.map((eventCase) => {
        const descriptor: AnyPropertyEventDescriptor<
          SnapshotFromSource<TSource>,
          EventFromSource<TSource>
        > = eventCase &&
        typeof eventCase === 'object' &&
        ('when' in eventCase ||
          'case' in eventCase ||
          'resolve' in eventCase ||
          'weight' in eventCase)
          ? (eventCase as AnyPropertyEventDescriptor<
              SnapshotFromSource<TSource>,
              EventFromSource<TSource>
            >)
          : { generate: eventCase };
        const caseName = descriptor.case ?? 'default';
        if (!caseName) {
          throw new Error(
            `Property event case for "${type}" must not be empty`
          );
        }
        const caseId = getPropertyEventCaseId(type, caseName);
        if (eventDescriptors.has(caseId)) {
          throw new Error(
            `Property event case "${caseName}" is duplicated for "${type}"`
          );
        }
        eventDescriptors.set(caseId, descriptor);
        return {
          type,
          caseId,
          generator: descriptor.generate,
          weight: assertPropertyWeight(
            descriptor.weight,
            `event case "${caseName}" for "${type}"`
          )
        };
      });
    }
  );
  const commands: PropertyGeneratedCommand[] = [];
  for (const type of ['advance', 'checkpoint', 'stop'] as const) {
    const configured = options.commands?.[type];
    if (configured === undefined) {
      continue;
    }
    const descriptor =
      typeof configured === 'object' &&
      configured !== null &&
      'weight' in configured
        ? (configured as PropertyCommandDescriptor<unknown>)
        : { generate: configured as unknown };
    commands.push({
      type,
      generator: descriptor.generate,
      weight: assertPropertyWeight(descriptor.weight, `"${type}" command`)
    });
  }
  if (options.start && typeof options.start.serializeSnapshot !== 'function') {
    throw new Error(
      'Property tests starting from a snapshot require a `start.serializeSnapshot` function'
    );
  }
  const coverage = createPropertyCoverage(model.testLogic);
  for (const event of events) {
    declarePropertyEventCase(coverage, event.caseId, event.weight);
  }
  const exploration: PropertyExplorationAccumulator = {
    configuredRuns: 0,
    configuredRunsOverride: null,
    stoppedBecause: 'budget',
    configuredRunsUnknown: false,
    completedRuns: 0,
    maximumSequenceLength: 0,
    maximumSequenceLengthUnknown: false,
    frontiers: [],
    seeds: [],
    truncationReasons: new Set()
  };
  const configuredFrontiers = options.frontiers;
  const autoFrontierOptions: PropertyAutoFrontierOptions | null =
    configuredFrontiers === 'auto'
      ? { strategy: 'uncovered' }
      : configuredFrontiers &&
          !Array.isArray(configuredFrontiers) &&
          (configuredFrontiers as PropertyAutoFrontierOptions).strategy ===
            'uncovered'
        ? (configuredFrontiers as PropertyAutoFrontierOptions)
        : null;
  const frontierOptions: PropertyFrontierOptions<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>
  > | null = Array.isArray(configuredFrontiers)
    ? { paths: configuredFrontiers }
    : configuredFrontiers && !autoFrontierOptions
      ? (configuredFrontiers as PropertyFrontierOptions<
          SnapshotFromSource<TSource>,
          EventFromSource<TSource>
        >)
      : null;
  const frontierContexts = (frontierOptions?.paths ?? []).map(
    (frontier, index) => ({ frontier, index, id: getFrontierId(frontier) })
  );
  for (const context of frontierContexts) {
    declarePropertyFrontier(coverage, context.id);
  }
  const selectedFrontiers = frontierContexts.filter(
    (context) => frontierOptions?.select?.(context) ?? true
  );
  const scenarios: Array<
    | PropertyFrontierContext<
        SnapshotFromSource<TSource>,
        EventFromSource<TSource>
      >
    | undefined
  > = frontierOptions ? selectedFrontiers : [undefined];

  type Scenario =
    | PropertyFrontierContext<
        SnapshotFromSource<TSource>,
        EventFromSource<TSource>
      >
    | undefined;

  const runScenario = async (
    frontierContext: Scenario,
    runBudget: number | undefined,
    runOffset: number | undefined
  ): Promise<void> => {
    const prefixEvents = frontierContext
      ? frontierContext.frontier.steps
          .map((step) => step.event)
          .filter((event) => event.type !== XSTATE_INIT)
      : [];
    if (
      runBudget !== undefined &&
      (!Number.isInteger(runBudget) || runBudget < 1)
    ) {
      throw new Error('runsPerFrontier must return a positive integer');
    }
    const attemptedRunsBefore = coverage.runs;
    const result = await options.adapter.run({
      events,
      commands,
      runBudget,
      runOffset,
      createEvent: (type, payload) => {
        assertEventPayload(payload, type);
        return { ...payload, type } as EventFromSource<TSource>;
      },
      createRunner: () => {
        coverage.runs++;
        return new PropertyScenarioRunner(
          model.testLogic as ActorLogic<
            SnapshotFromSource<TSource>,
            EventFromSource<TSource>,
            unknown
          >,
          options.input,
          options.start?.snapshot,
          options.start?.serializeSnapshot,
          prefixEvents,
          frontierContext?.id,
          options.sut,
          model as TestModel<
            SnapshotFromSource<TSource>,
            EventFromSource<TSource>,
            unknown
          >,
          options.test,
          options.reference,
          options.invariant,
          options.temporal ?? [],
          eventDescriptors,
          coverage
        );
      }
    });

    const configuredRuns = result.exploration.configuredRuns;
    if (configuredRuns === null) {
      exploration.configuredRunsUnknown = true;
    } else {
      exploration.configuredRuns += configuredRuns;
    }
    exploration.completedRuns += result.runs;
    const maximumSequenceLength = result.exploration.maximumSequenceLength;
    if (maximumSequenceLength === null) {
      exploration.maximumSequenceLengthUnknown = true;
    } else {
      exploration.maximumSequenceLength = Math.max(
        exploration.maximumSequenceLength ?? 0,
        maximumSequenceLength
      );
    }
    const frontierId =
      frontierContext?.id ?? JSON.stringify(['frontier', 'initial']);
    exploration.frontiers.push({
      id: frontierId,
      prefixLength: prefixEvents.length,
      runBudget: runBudget ?? null,
      configuredRuns,
      completedRuns: result.runs,
      attemptedRuns: coverage.runs - attemptedRunsBefore
    });
    exploration.seeds.push({
      frontierId,
      engine: result.exploration.engine,
      seed: result.exploration.seed,
      path: result.exploration.path
    });
    for (const reason of result.exploration.truncationReasons ?? []) {
      exploration.truncationReasons.add(reason);
    }
    if (
      result.exploration.truncated &&
      !(result.exploration.truncationReasons?.length ?? 0)
    ) {
      exploration.truncationReasons.add('adapter reported truncation');
    }

    if (result.error !== undefined) {
      exploration.stoppedBecause = 'failure';
      if (result.error instanceof PropertyTestFailure) {
        throw new PropertyTestFailure(
          result.error.summary,
          result.error.trace,
          result.error.cause,
          result.replay,
          result.error.fixture,
          finalizePropertyCoverage(
            coverage,
            finalizeExploration(coverage, exploration)
          )
        );
      }
      throw result.error instanceof Error
        ? result.error
        : new Error('Property adapter failed', { cause: result.error });
    }
  };

  const snapshotCoverage = () =>
    finalizePropertyCoverage(
      coverage,
      finalizeExploration(coverage, exploration)
    );
  const getStaticRunBudget = (frontierContext: Scenario) =>
    frontierContext
      ? typeof frontierOptions?.runsPerFrontier === 'function'
        ? frontierOptions.runsPerFrontier(frontierContext)
        : frontierOptions?.runsPerFrontier
      : undefined;

  if (!options.until && !autoFrontierOptions) {
    for (const frontierContext of scenarios) {
      await runScenario(
        frontierContext,
        getStaticRunBudget(frontierContext),
        undefined
      );
    }
  } else {
    const maxRuns = options.maxRuns ?? DEFAULT_MAX_RUNS;
    const batchRuns = Math.max(
      1,
      Math.min(options.batchRuns ?? DEFAULT_BATCH_RUNS, maxRuns)
    );
    exploration.configuredRunsOverride = maxRuns;
    const startedAt = Date.now();
    let shortestPaths:
      | StatePath<SnapshotFromSource<TSource>, EventFromSource<TSource>>[]
      | null = null;
    const getShortestPathsOnce = () => {
      if (shortestPaths) {
        return shortestPaths;
      }
      try {
        shortestPaths = getShortestPaths(model.testLogic as any, {
          input: options.input,
          limit: autoFrontierOptions?.limit ?? DEFAULT_FRONTIER_SEARCH_LIMIT
        }) as StatePath<
          SnapshotFromSource<TSource>,
          EventFromSource<TSource>
        >[];
      } catch {
        // An unenumerable machine simply falls back to random exploration.
        shortestPaths = [];
      }
      return shortestPaths;
    };
    let nextFrontierIndex = 0;
    const getAutoScenarios = (
      budget: number
    ): [Scenario, number | undefined][] => {
      const paths = selectUncoveredFrontiers(
        getShortestPathsOnce(),
        snapshotCoverage(),
        autoFrontierOptions!.maxFrontiers ?? DEFAULT_MAX_FRONTIERS
      );
      if (!paths.length) {
        return [[undefined, budget]];
      }
      const perFrontier =
        autoFrontierOptions!.runsPerFrontier ??
        Math.max(1, Math.floor(budget / paths.length));
      return paths.map((frontier) => {
        const id = getFrontierId(frontier);
        declarePropertyFrontier(coverage, id);
        return [{ frontier, index: nextFrontierIndex++, id }, perFrontier] as [
          Scenario,
          number | undefined
        ];
      });
    };

    while (exploration.completedRuns < maxRuns) {
      const budget = Math.min(batchRuns, maxRuns - exploration.completedRuns);
      const batch: [Scenario, number | undefined][] = autoFrontierOptions
        ? getAutoScenarios(budget)
        : scenarios.map((frontierContext) => [
            frontierContext,
            Math.min(getStaticRunBudget(frontierContext) ?? budget, budget)
          ]);
      for (const [frontierContext, scenarioBudget] of batch) {
        await runScenario(
          frontierContext,
          scenarioBudget,
          exploration.completedRuns
        );
        if (exploration.completedRuns >= maxRuns) {
          break;
        }
      }
      if (
        options.until &&
        evaluatePropertyStopCondition(
          options.until,
          snapshotCoverage(),
          Date.now() - startedAt
        )
      ) {
        exploration.stoppedBecause = 'until';
        break;
      }
    }
  }

  const finalCoverage = snapshotCoverage();
  if (options.expectLabels) {
    const failures = getLabelExpectationFailures(
      options.expectLabels,
      finalCoverage
    );
    if (failures.length) {
      const error = new Error(
        `Property label expectations were not met:\n${failures
          .map((failure) => `  - ${failure}`)
          .join('\n')}`
      ) as Error & { coverage: PropertyCoverage };
      error.name = 'PropertyLabelExpectationError';
      error.coverage = finalCoverage;
      throw error;
    }
  }

  return { coverage: finalCoverage };
}

function normalizeFixtureTimeline(
  fixture: PortablePropertyReplayFixture | LegacyPortablePropertyReplayFixture
): readonly PortablePropertyTimelineEntry[] {
  if (fixture.formatVersion === 2) {
    return fixture.timeline;
  }
  return [
    ...fixture.prefixEvents.map((event) => ({
      kind: 'event' as const,
      command: {
        type: 'event' as const,
        event: event as EventObject,
        phase: 'prefix' as const,
        origin: 'frontier' as const
      }
    })),
    ...fixture.events.map((event) => ({
      kind: 'event' as const,
      command: {
        type: 'event' as const,
        event: event as EventObject,
        phase: 'generated' as const,
        origin: 'generator' as const
      }
    }))
  ];
}

export async function replayPropertyTest<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
>(
  source: TSource,
  fixture: PortablePropertyReplayFixture | LegacyPortablePropertyReplayFixture,
  options: {
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
    readonly restoreSnapshot?: (
      snapshot: unknown
    ) => SnapshotFromSource<TSource>;
  }
): Promise<
  PropertyTrace<SnapshotFromSource<TSource>, EventFromSource<TSource>>
> {
  const model =
    source instanceof TestModel
      ? source
      : new TestModel(source as ActorLogic<any, any, any>);
  const identity = model.testLogic as { id?: string; version?: string };
  if (fixture.machine?.id && fixture.machine.id !== identity.id) {
    throw new Error(
      `Property replay fixture targets machine "${fixture.machine.id}", received "${identity.id ?? '(anonymous)'}"`
    );
  }
  if (
    fixture.machine?.version &&
    fixture.machine.version !== identity.version
  ) {
    throw new Error(
      `Property replay fixture targets machine version "${fixture.machine.version}", received "${identity.version ?? '(unversioned)'}"`
    );
  }
  const startingSnapshot =
    fixture.start.type === 'snapshot'
      ? options.restoreSnapshot?.(fixture.start.snapshot)
      : undefined;
  if (fixture.start.type === 'snapshot' && !startingSnapshot) {
    throw new Error(
      'Property replay fixture contains a snapshot but no restoreSnapshot function was provided'
    );
  }
  const coverage = createPropertyCoverage(model.testLogic);
  coverage.runs = 1;
  const serializedStartingSnapshot =
    fixture.start.type === 'snapshot' ? fixture.start.snapshot : undefined;
  const runner = new PropertyScenarioRunner(
    model.testLogic as ActorLogic<
      SnapshotFromSource<TSource>,
      EventFromSource<TSource>,
      unknown
    >,
    fixture.start.type === 'input' ? fixture.start.input : undefined,
    startingSnapshot,
    fixture.start.type === 'snapshot'
      ? () => serializedStartingSnapshot
      : undefined,
    [],
    undefined,
    options.sut,
    model as TestModel<
      SnapshotFromSource<TSource>,
      EventFromSource<TSource>,
      unknown
    >,
    options.test,
    options.reference,
    options.invariant,
    options.temporal ?? [],
    new Map(),
    coverage
  );
  await runner.start();
  try {
    for (const entry of normalizeFixtureTimeline(fixture)) {
      const command = entry.command as PropertyCommand<
        EventFromSource<TSource>
      >;
      await runner.replay(command);
      if (runner.getStableStep() > fixture.failedAt) {
        // The recorded failure step has been replayed; anything after it was
        // never reached by the original run.
        break;
      }
    }
    runner.finish();
    throw new Error(
      `Property replay did not reproduce the recorded failure at step ${fixture.failedAt}`
    );
  } finally {
    await runner.dispose();
  }
}

function serializeSnapshot<TSnapshot extends Snapshot<unknown>>(
  snapshot: TSnapshot
): unknown {
  return 'toJSON' in snapshot && typeof snapshot.toJSON === 'function'
    ? snapshot.toJSON()
    : snapshot;
}

export function serializePropertyTrace<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(trace: PropertyTrace<TSnapshot, TEvent>): unknown {
  return {
    start:
      trace.start.type === 'snapshot'
        ? {
            type: 'snapshot',
            snapshot: serializeSnapshot(trace.start.snapshot)
          }
        : trace.start,
    initialSnapshot: serializeSnapshot(trace.initialSnapshot),
    initialTransitionIds: trace.initialTransitionIds,
    initialGuardIds: trace.initialGuardIds,
    timeline: trace.timeline.map((entry) => ({
      kind: entry.kind,
      index: entry.index,
      command: entry.command,
      previousSnapshot: serializeSnapshot(entry.previousSnapshot),
      snapshot: serializeSnapshot(entry.snapshot),
      effects: entry.effects,
      transitionIds: entry.transitionIds,
      guardIds: entry.guardIds,
      observation: entry.observation,
      ...(entry.kind === 'event'
        ? { activeStateIds: entry.activeStateIds }
        : {})
    })),
    finalSnapshot: serializeSnapshot(trace.finalSnapshot),
    finalObservation: trace.finalObservation
  };
}

export function formatPropertyTrace<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(trace: PropertyTrace<TSnapshot, TEvent>): string {
  const lines = [
    `start ${JSON.stringify(serializeSnapshot(trace.initialSnapshot))}`
  ];
  for (const entry of trace.timeline) {
    if (entry.kind === 'event') {
      lines.push(
        `${entry.index}. ${entry.command.phase}/${entry.command.origin} ${JSON.stringify(entry.command.event)} -> ${JSON.stringify(serializeSnapshot(entry.snapshot))}`
      );
      if (entry.transitionIds.length) {
        lines.push(`   transitions ${entry.transitionIds.join(', ')}`);
      }
    } else {
      lines.push(`${entry.index}. command ${JSON.stringify(entry.command)}`);
    }
    if (entry.observation) {
      lines.push(`   observations ${JSON.stringify(entry.observation)}`);
    }
  }
  return lines.join('\n');
}
