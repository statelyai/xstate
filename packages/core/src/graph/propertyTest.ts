import type {
  ActorLogic,
  AnyTransitionDefinition,
  EventObject,
  InputFrom,
  Snapshot,
  SnapshotFrom
} from '../index.ts';
import { XSTATE_INIT, XSTATE_STOP } from '../constants.ts';
import { createActor } from '../createActor.ts';
import { createAsyncLogic } from '../actors/promise.ts';
import { SimulatedClock } from '../SimulatedClock.ts';
import type { InspectionEvent } from '../inspection.ts';
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
  type PropertyExplorationSeed,
  type PropertyExplorationSwarm,
  type PropertyExplorationTarget
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
  PropertyExplorationSeed,
  PropertyExplorationSwarm,
  PropertyExplorationTarget
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

/**
 * `'pure'` steps the machine through the pure `transition()` path: no effect
 * runs, no invoked or spawned actor starts, no delayed transition fires.
 * `'executed'` drives a real actor on a {@link SimulatedClock} instead, so
 * invoked/spawned actors run and `after` transitions are reachable through
 * generated `advance` commands.
 */
export type PropertyTestMode = 'pure' | 'executed';

/** A resolved actor outcome queued for a stubbed invoke source. */
export type PropertyActorOutcome =
  | { readonly ok: true; readonly output: unknown }
  | { readonly ok: false; readonly error: unknown };

/**
 * An actor outcome observed during an executed-mode run, keyed by invoke
 * source and by how many actors of that source had already resolved.
 * Recorded into replay fixtures so a failure can be replayed against stubbed
 * actors instead of the real ones.
 */
export interface PropertyOutcomeRecord {
  readonly src: string;
  readonly occurrence: number;
  readonly outcome: PropertyActorOutcome;
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
  | {
      /** Queues the next resolution of a stubbed invoke source. */
      readonly type: 'outcome';
      readonly src: string;
      readonly outcome: PropertyActorOutcome;
    }
  | { readonly type: 'stop' };

/**
 * An event the actor system produced on its own during an executed-mode step:
 * an invoked actor's `onDone`/`onError`/`onSnapshot`, a delayed transition, a
 * `sendTo`/`raise`, or a child actor's own transition.
 */
export interface PropertyActorTimelineEntry<
  TSnapshot extends Snapshot<unknown>
> {
  readonly kind: 'actorEvent';
  readonly index: number;
  /** `'root'` when the tested actor transitioned, `'child'` otherwise. */
  readonly source: 'root' | 'child';
  /** The `id` of the actor that transitioned. */
  readonly actorId: string;
  readonly event: EventObject;
  readonly previousSnapshot: TSnapshot;
  readonly snapshot: TSnapshot;
  readonly effects: readonly unknown[];
  readonly transitionIds: readonly string[];
  readonly guardIds: readonly string[];
  /** Never set: reference/SUT comparison happens on the settled step. */
  readonly observation?: undefined;
}

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
  | PropertyRuntimeTimelineEntry<TSnapshot, TEvent>
  | PropertyActorTimelineEntry<TSnapshot>;

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
  /**
   * The step the recorded run failed at. Absent on fixtures recorded from a
   * passing run, such as the ones an offline property suite is built from.
   */
  readonly failedAt?: number;
  readonly temporalFailure?: PortableTemporalFailure;
  /** Event case ids enabled for the run, when swarm testing was used. */
  readonly swarm?: readonly string[];
  /** Executed-mode runs only. See {@link PropertyOutcomeRecord}. */
  readonly mode?: PropertyTestMode;
  /** Actor outcomes observed during an executed-mode run, in resolution order. */
  readonly outcomes?: readonly PropertyOutcomeRecord[];
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
  readonly type: 'advance' | 'checkpoint' | 'stop' | 'outcome';
  readonly generator: unknown;
  /** Relative generation weight. `1` unless configured otherwise. */
  readonly weight: number;
  /**
   * The invoke source an `'outcome'` command resolves. Always present for
   * `'outcome'` commands and never present for the others.
   */
  readonly src?: string;
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

/** Metadata about the step an event belongs to, passed to `send`. */
export interface PropertySutSendContext {
  /**
   * The generated event case id (`"<type>:<case>"`), when the event came from
   * a generator. Absent for prefix, clock, and replayed events.
   */
  readonly caseId?: string;
}

export interface PropertySutSession<TEvent extends EventObject> {
  readonly send: (
    event: TEvent,
    context?: PropertySutSendContext
  ) => void | Promise<void>;
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
  /**
   * Records an observation for targeted search. The campaign keeps the best
   * (highest) observed value and steers later batches towards the prefixes
   * that reached it. See `frontiers: { strategy: 'target' }`.
   */
  readonly target: (observation: number, label?: string) => void;
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
  /** Event case ids enabled for the run, when swarm testing was used. */
  readonly swarm?: readonly string[];
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

/**
 * Queues and hands out actor outcomes for stubbed invoke sources.
 *
 * A stub actor asks the registry for its outcome when it starts. If an
 * outcome is already queued for its source it resolves immediately; otherwise
 * the stub stays pending until an `outcome` command (or a seeded replay
 * record) supplies one, which is what lets fast-check shrink service results.
 */
export class PropertyOutcomeRegistry {
  private queued = new Map<string, PropertyActorOutcome[]>();
  private waiting = new Map<
    string,
    ((outcome: PropertyActorOutcome) => void)[]
  >();

  /** Called by a stub actor when it starts. */
  public request(src: string): Promise<PropertyActorOutcome> {
    const queue = this.queued.get(src);
    const next = queue?.shift();
    if (next) {
      return Promise.resolve(next);
    }
    return new Promise<PropertyActorOutcome>((resolve) => {
      const waiters = this.waiting.get(src);
      if (waiters) {
        waiters.push(resolve);
      } else {
        this.waiting.set(src, [resolve]);
      }
    });
  }

  /** Resolves the oldest pending stub for `src`, or queues for the next one. */
  public provide(src: string, outcome: PropertyActorOutcome): void {
    const waiters = this.waiting.get(src);
    const waiter = waiters?.shift();
    if (waiter) {
      waiter(outcome);
      return;
    }
    const queue = this.queued.get(src);
    if (queue) {
      queue.push(outcome);
    } else {
      this.queued.set(src, [outcome]);
    }
  }

  /** Pre-loads recorded outcomes so a replay never calls a real service. */
  public seed(records: readonly PropertyOutcomeRecord[]): void {
    for (const record of records) {
      this.provide(record.src, record.outcome);
    }
  }

  public reset(): void {
    this.queued = new Map();
    this.waiting = new Map();
  }
}

let activeOutcomeRegistry: PropertyOutcomeRegistry | undefined;

/**
 * Builds the stub {@link ActorLogic} that replaces an invoke source named
 * `src`. The registry is read when the stub starts — always inside the
 * owning runner's step — so one stub built per campaign serves every run.
 */
function createOutcomeStub(src: string): ActorLogic<any, any, any> {
  return createAsyncLogic({
    run: async () => {
      const registry = activeOutcomeRegistry;
      if (!registry) {
        throw new Error(
          `Property outcome stub for "${src}" ran outside an executed-mode property run`
        );
      }
      const outcome = await registry.request(src);
      if (outcome.ok) {
        return outcome.output;
      }
      throw outcome.error instanceof Error
        ? outcome.error
        : new Error(String(outcome.error));
    }
  }) as unknown as ActorLogic<any, any, any>;
}

/** Microtask turns awaited per drain round. */
const DRAIN_MICROTASKS = 8;
/** Drain rounds awaited before an executed step is considered settled. */
const MAX_DRAIN_ROUNDS = 20;

interface DrainedTransition<TSnapshot extends Snapshot<unknown>> {
  readonly source: 'root' | 'child';
  readonly actorId: string;
  readonly event: EventObject;
  readonly snapshot: TSnapshot;
  readonly effects: readonly unknown[];
  readonly transitionIds: readonly string[];
}

/**
 * Drives a real actor on a {@link SimulatedClock} and turns its inspection
 * stream into the same transition/guard details the pure path returns.
 */
class PropertyExecutionEngine<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  public readonly clock = new SimulatedClock();
  private actor: {
    start: () => void;
    stop: () => void;
    send: (event: TEvent) => void;
    getSnapshot: () => TSnapshot;
  };
  private buffer: InspectionEvent[] = [];
  private rootRef: unknown;
  private readonly srcByActorId = new Map<string, string>();
  private readonly resolvedBySrc = new Map<string, number>();
  /** Outcomes observed this run, in resolution order. */
  public readonly outcomes: PropertyOutcomeRecord[] = [];

  public constructor(
    logic: ActorLogic<TSnapshot, TEvent, unknown>,
    input: unknown,
    startingSnapshot: TSnapshot | undefined
  ) {
    const actor = createActor(logic as any, {
      clock: this.clock,
      input: input as never,
      ...(startingSnapshot ? { snapshot: startingSnapshot as never } : {}),
      inspect: (event: InspectionEvent) => {
        this.buffer.push(event);
      }
    });
    this.rootRef = actor;
    this.actor = actor as unknown as typeof this.actor;
  }

  public start(): void {
    this.actor.start();
  }

  public send(event: TEvent): void {
    this.actor.send(event);
  }

  public advance(milliseconds: number): void {
    this.clock.increment(milliseconds);
  }

  public stop(): void {
    this.actor.stop();
  }

  public getSnapshot(): TSnapshot {
    return this.actor.getSnapshot();
  }

  /**
   * Runs microtasks and macrotasks until the inspection stream stops growing.
   * The actor's own timers are on the simulated clock, so nothing here can
   * fire a delayed transition; only already-pending promises settle.
   */
  public async drain(): Promise<void> {
    let seen = -1;
    for (
      let round = 0;
      round < MAX_DRAIN_ROUNDS && seen !== this.buffer.length;
      round++
    ) {
      seen = this.buffer.length;
      for (let turn = 0; turn < DRAIN_MICROTASKS; turn++) {
        await Promise.resolve();
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  /**
   * Consumes the buffered inspection events, records root transitions into
   * `coverage`, and returns one {@link DrainedTransition} per transition.
   */
  public consume(
    coverage: MutablePropertyCoverage
  ): readonly DrainedTransition<TSnapshot>[] {
    const buffered = this.buffer;
    this.buffer = [];
    const drained: DrainedTransition<TSnapshot>[] = [];
    for (const inspected of buffered) {
      if (inspected.type === '@xstate.actor') {
        if (typeof inspected.src === 'string') {
          this.srcByActorId.set(inspected.id, inspected.src);
        }
        continue;
      }
      if (inspected.type !== '@xstate.transition') {
        continue;
      }
      const isRoot = inspected.actorRef === this.rootRef;
      const actorId =
        (inspected.actorRef as { id?: string } | undefined)?.id ?? '(unknown)';
      if (!isRoot) {
        this.recordOutcome(actorId, inspected.snapshot);
      }
      drained.push({
        source: isRoot ? 'root' : 'child',
        actorId,
        event: inspected.event,
        snapshot: inspected.snapshot as TSnapshot,
        effects: inspected.actions,
        // Only the tested actor's own transitions are part of its coverage.
        transitionIds: isRoot
          ? recordPropertyTransitions(
              coverage,
              inspected.event,
              inspected.microsteps
            )
          : []
      });
    }
    return drained;
  }

  private recordOutcome(actorId: string, snapshot: Snapshot<unknown>): void {
    if (snapshot.status !== 'done' && snapshot.status !== 'error') {
      return;
    }
    const src = this.srcByActorId.get(actorId);
    if (src === undefined) {
      return;
    }
    const occurrence = this.resolvedBySrc.get(src) ?? 0;
    this.resolvedBySrc.set(src, occurrence + 1);
    this.outcomes.push({
      src,
      occurrence,
      outcome:
        snapshot.status === 'done'
          ? { ok: true, output: (snapshot as { output?: unknown }).output }
          : { ok: false, error: (snapshot as { error?: unknown }).error }
    });
  }
}

/** Executed-mode wiring handed to a {@link PropertyScenarioRunner}. */
export interface PropertyExecutionConfig {
  readonly mode: PropertyTestMode;
  readonly registry: PropertyOutcomeRegistry;
  /** Outcomes pre-loaded before the run starts (replay). */
  readonly seededOutcomes?: readonly PropertyOutcomeRecord[];
}

/** A single `target()` observation, recorded against the timeline. */
export interface PropertyTargetObservation {
  readonly value: number;
  readonly label?: string;
  /** Number of timeline entries recorded when the observation was made. */
  readonly index: number;
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
  private execution: PropertyExecutionEngine<TSnapshot, TEvent> | undefined;
  private swarmCaseIds: readonly string[] | undefined;
  private swarmEnabled: ReadonlySet<string> | undefined;
  private targetFunction:
    | ((context: PropertyInvariantContext<TSnapshot, TEvent>) => number)
    | undefined;
  private readonly targetObservations: PropertyTargetObservation[] = [];

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

  /** Records an observation for targeted search. */
  public readonly target = (observation: number, label?: string): void => {
    if (typeof observation !== 'number' || Number.isNaN(observation)) {
      throw new Error('target() requires a numeric observation');
    }
    this.targetObservations.push({
      value: observation,
      label,
      index: this.timeline.length
    });
  };

  /**
   * Restricts this run to a subset of the declared event cases. Every other
   * case reports itself as inapplicable, so a run only exercises the enabled
   * ones. See the `swarm` option.
   */
  public setSwarm(caseIds: readonly string[]): void {
    this.swarmCaseIds = caseIds;
    this.swarmEnabled = new Set(caseIds);
  }

  /** Evaluates `target` on every stable step. See the `target` option. */
  public setTargetFunction(
    targetFunction: (
      context: PropertyInvariantContext<TSnapshot, TEvent>
    ) => number
  ): void {
    this.targetFunction = targetFunction;
  }

  /** Observations recorded with `target()` during this run. */
  public getTargetObservations(): readonly PropertyTargetObservation[] {
    return this.targetObservations;
  }

  /** `true` when the run completed without a property failure. */
  public isFinished(): boolean {
    return this.finished;
  }

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
    private readonly coverage: MutablePropertyCoverage,
    private readonly executionConfig?: PropertyExecutionConfig
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
    this.initialTransitionIds = recordPropertyTransitions(
      this.coverage,
      { type: XSTATE_INIT },
      selected,
      resolutions
    );
    this.initialGuardIds = recordPropertyGuards(this.coverage, guards);
    let initialSnapshot = snapshot;
    let initialEffects = effects;
    if (this.executionConfig?.mode === 'executed') {
      // The pure initial transition above is only used to attribute initial
      // transition and guard coverage: the `@xstate.init` inspection event
      // carries no microsteps. The snapshot the run proceeds from is the real
      // actor's.
      this.executionConfig.registry.reset();
      this.executionConfig.registry.seed(
        this.executionConfig.seededOutcomes ?? []
      );
      activeOutcomeRegistry = this.executionConfig.registry;
      this.execution = new PropertyExecutionEngine(
        this.logic,
        this.input,
        this.startingSnapshot
      );
      this.execution.start();
      await this.execution.drain();
      // Initial-transition coverage is already attributed above; the drained
      // entries below cover anything the actor did on its own while starting.
      this.execution.consume(this.coverage);
      initialSnapshot = this.execution.getSnapshot();
      initialEffects = [];
    }
    this.snapshot = initialSnapshot;
    this.initialSnapshot = initialSnapshot;
    this.initialEffects = initialEffects;
    this.started = true;
    this.recordSnapshot(initialSnapshot);
    const context = {
      logic: this.logic,
      input: this.input,
      snapshot: this.startingSnapshot,
      label: this.label,
      classify: this.classify,
      target: this.target
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
    await this.checkStable(
      undefined,
      initialSnapshot,
      initialSnapshot,
      initialEffects
    );
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
      (this.swarmEnabled?.has(caseId) ?? true) &&
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

  /** `outcome` commands only apply while the executed actor is running. */
  public canRunOutcome(): boolean {
    return this.canRunCommand(
      !!this.execution && this.snapshot.status === 'active'
    );
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
      if (this.execution) {
        await this.advanceExecuted(command.milliseconds);
        return;
      }
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
    } else if (command.type === 'outcome') {
      if (this.execution) {
        await this.outcome(command.src, command.outcome);
      }
    } else if (command.type === 'checkpoint') {
      await this.checkpoint(command.label);
    } else {
      await this.stop();
    }
  }

  /** Queues the next resolution of the stubbed invoke source `src`. */
  public async outcome(
    src: string,
    outcome: PropertyActorOutcome
  ): Promise<void> {
    this.assertStarted();
    this.recordGeneratedCommand();
    if (!this.execution || !this.executionConfig) {
      throw new Error("Property `outcome` commands require `mode: 'executed'`");
    }
    const previousSnapshot = this.snapshot;
    this.executionConfig.registry.provide(src, outcome);
    await this.execution.drain();
    const drained = this.execution.consume(this.coverage);
    this.snapshot = this.execution.getSnapshot();
    this.recordSnapshot(this.snapshot);
    const entry: PropertyRuntimeTimelineEntry<TSnapshot, TEvent> = {
      kind: 'command',
      index: this.timeline.length,
      command: { type: 'outcome', src, outcome },
      previousSnapshot,
      snapshot: this.snapshot,
      effects: [],
      transitionIds: [],
      guardIds: []
    };
    this.timeline.push(entry);
    this.pushActorEntries(previousSnapshot, drained);
    const observation = await this.checkStable(
      undefined,
      previousSnapshot,
      this.snapshot,
      []
    );
    (entry as { observation?: PropertyObservation }).observation = observation;
  }

  public async advance(milliseconds: number): Promise<void> {
    this.assertStarted();
    this.recordGeneratedCommand();
    if (this.execution) {
      await this.advanceExecuted(milliseconds);
      return;
    }
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

  /**
   * Advances the simulated clock the executed actor runs on, then drains
   * whatever the elapsed delays produced.
   */
  private async advanceExecuted(milliseconds: number): Promise<void> {
    const previousSnapshot = this.snapshot;
    this.execution!.advance(milliseconds);
    await this.execution!.drain();
    const drained = this.execution!.consume(this.coverage);
    this.snapshot = this.execution!.getSnapshot();
    this.recordSnapshot(this.snapshot);
    this.coverage.clockAdvances++;
    const entry: PropertyRuntimeTimelineEntry<TSnapshot, TEvent> = {
      kind: 'command',
      index: this.timeline.length,
      command: { type: 'advance', milliseconds, deliveredEvents: [] },
      previousSnapshot,
      snapshot: this.snapshot,
      effects: [],
      transitionIds: [],
      guardIds: []
    };
    this.timeline.push(entry);
    this.pushActorEntries(previousSnapshot, drained);
    const observation = await this.checkStable(
      undefined,
      previousSnapshot,
      this.snapshot,
      []
    );
    (entry as { observation?: PropertyObservation }).observation = observation;
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
    let snapshot: TSnapshot;
    let effects: readonly unknown[];
    let transitionIds: readonly string[];
    let guardIds: readonly string[];
    let drained: readonly DrainedTransition<TSnapshot>[] = [];
    if (this.execution) {
      this.execution.stop();
      await this.execution.drain();
      drained = this.execution.consume(this.coverage);
      snapshot = this.execution.getSnapshot();
      effects = [];
      transitionIds = [];
      guardIds = [];
    } else {
      const [pureSnapshot, pureEffects, selected, guards, resolutions] =
        transitionWithDetails(this.logic, previousSnapshot, {
          type: XSTATE_STOP
        } as TEvent);
      snapshot = pureSnapshot;
      effects = pureEffects;
      transitionIds = recordPropertyTransitions(
        this.coverage,
        { type: XSTATE_STOP },
        selected,
        resolutions
      );
      guardIds = recordPropertyGuards(this.coverage, guards);
    }
    this.snapshot = snapshot;
    await this.referenceSession?.stop?.();
    await this.sutSession?.stop?.();
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
    this.pushActorEntries(previousSnapshot, drained);
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
    if (this.execution) {
      try {
        this.execution.stop();
      } catch (error) {
        errors.push(error);
      }
      this.execution = undefined;
      if (activeOutcomeRegistry === this.executionConfig?.registry) {
        activeOutcomeRegistry = undefined;
      }
    }
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
      finalObservation: this.lastObservation,
      swarm: this.swarmCaseIds
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
    let snapshot: TSnapshot;
    let effects: readonly unknown[];
    let transitionIds: readonly string[];
    let guardIds: readonly string[];
    let drained: readonly DrainedTransition<TSnapshot>[] = [];
    if (this.execution) {
      this.execution.send(event);
      await this.execution.drain();
      drained = this.execution.consume(this.coverage);
      snapshot = this.execution.getSnapshot();
      // The first root transition for this event type is the one the send
      // caused; everything after it is the actor system reacting on its own.
      const primaryIndex = drained.findIndex(
        (entry) => entry.source === 'root' && entry.event.type === event.type
      );
      const primary = primaryIndex === -1 ? undefined : drained[primaryIndex];
      drained = primaryIndex === -1 ? drained : drained.slice(primaryIndex + 1);
      effects = primary?.effects ?? [];
      transitionIds = primary?.transitionIds ?? [];
      // The inspection protocol reports the microsteps taken, not the guards
      // evaluated, so executed mode attributes guard coverage only through
      // the guarded transitions that were selected.
      guardIds = [];
    } else {
      const [pureSnapshot, pureEffects, selected, guards, resolutions] =
        transitionWithDetails(this.logic, previousSnapshot, event);
      snapshot = pureSnapshot;
      effects = pureEffects;
      transitionIds = recordPropertyTransitions(
        this.coverage,
        event,
        selected,
        resolutions
      );
      guardIds = recordPropertyGuards(this.coverage, guards);
    }
    this.snapshot = snapshot;
    if (this.referenceSession) {
      await this.referenceSession.transition(event);
    }
    if (sendToSut) {
      await this.sutSession?.send(event, { caseId });
    }
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
    this.pushActorEntries(previousSnapshot, drained);
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
        classify: this.classify,
        target: this.target
      });
    } catch (cause) {
      this.fail(
        `Property invariant failed after ${step} step${step === 1 ? '' : 's'}`,
        cause,
        step
      );
    }
    if (this.targetFunction) {
      this.target(
        this.targetFunction({
          initialSnapshot: this.initialSnapshot,
          previousSnapshot,
          snapshot,
          event,
          effects,
          step,
          label: this.label,
          classify: this.classify,
          target: this.target
        })
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
      classify: this.classify,
      target: this.target
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

  /**
   * Appends one timeline entry per transition the actor system performed on
   * its own during an executed step: invoked/spawned actor lifecycle events,
   * delayed transitions, and relayed sends.
   */
  private pushActorEntries(
    previousSnapshot: TSnapshot,
    drained: readonly DrainedTransition<TSnapshot>[]
  ): void {
    let previous = previousSnapshot;
    for (const transition of drained) {
      this.timeline.push({
        kind: 'actorEvent',
        index: this.timeline.length,
        source: transition.source,
        actorId: transition.actorId,
        event: transition.event,
        previousSnapshot: previous,
        snapshot: transition.snapshot,
        effects: transition.effects,
        transitionIds: transition.transitionIds,
        guardIds: []
      });
      if (transition.source === 'root') {
        previous = transition.snapshot;
      }
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
      timeline: this.timeline
        .filter(
          (
            entry
          ): entry is
            | PropertyEventTimelineEntry<TSnapshot, TEvent>
            | PropertyRuntimeTimelineEntry<TSnapshot, TEvent> =>
            entry.kind !== 'actorEvent'
        )
        .map((entry) => ({
          kind: entry.kind,
          command: entry.command as PropertyCommand
        })),
      failedAt,
      temporalFailure,
      ...(this.swarmCaseIds ? { swarm: this.swarmCaseIds } : {}),
      ...(this.execution
        ? {
            mode: 'executed' as const,
            outcomes: this.execution.outcomes.slice()
          }
        : {})
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
  /**
   * `'pure'` (the default) steps the machine through `transition()`, so no
   * effects run. `'executed'` runs a real actor on a `SimulatedClock`:
   * invoked and spawned actors start, `onDone`/`onError`/`onSnapshot` fire,
   * and `after` transitions are reached with generated `advance` commands.
   */
  readonly mode?: PropertyTestMode;
  /**
   * Actor logic substituted for the machine's named invoke/spawn sources
   * before the campaign runs, via `machine.provide({ actors })`. Executed
   * mode only.
   */
  readonly actors?: Readonly<Record<string, ActorLogic<any, any, any>>>;
  /**
   * Invoke source names whose actors are replaced by a stub that resolves
   * from a generated `outcome` command, so the adapter shrinks service
   * results alongside events. Executed mode only.
   */
  readonly outcomes?: {
    readonly [src: string]: PropertyCommandGenerator<
      TKind,
      PropertyActorOutcome
    >;
  };
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
    | PropertyAutoFrontierOptions
    | PropertyTargetFrontierOptions;
  /**
   * Swarm testing: each run only enables a seeded random subset of the
   * declared event cases, so rarely-reachable interleavings are not crowded
   * out by the most common ones. `true` enables at least half the cases.
   */
  readonly swarm?: boolean | PropertySwarmOptions;
  /**
   * Evaluated on every stable step. The campaign keeps the best (highest)
   * observed value, reports it as `coverage.exploration.target`, and, with
   * `frontiers: { strategy: 'target' }`, replays the prefixes that reached it
   * as frontiers for the next batch. Equivalent to calling `target()` from
   * the invariant.
   */
  readonly target?: (
    context: PropertyInvariantContext<TSnapshot, TEvent>
  ) => number;
  /**
   * Called once per run, after the runner has finished and been disposed.
   * `passed` is `false` when the run ended in a property failure.
   */
  readonly collect?: (
    trace: PropertyTrace<TSnapshot, TEvent>,
    info: { readonly passed: boolean; readonly runIndex: number }
  ) => void;
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

/** Swarm testing options. See the `swarm` option. */
export interface PropertySwarmOptions {
  /**
   * The fewest event cases a run may enable. Defaults to half the declared
   * cases, rounded up.
   */
  readonly minCases?: number;
  /** Campaign seed the per-run subsets are derived from. Defaults to `0`. */
  readonly seed?: number;
}

/** Targeted search. See `frontiers: { strategy: 'target' }`. */
export interface PropertyTargetFrontierOptions {
  readonly strategy: 'target';
  /** Best-scoring prefixes carried into the next batch. Defaults to 5. */
  readonly maxFrontiers?: number;
  /** Runs per frontier. Defaults to an even split of the batch. */
  readonly runsPerFrontier?: number;
}

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
  mode: PropertyTestMode;
  configuredRuns: number;
  configuredRunsOverride: number | null;
  stoppedBecause: PropertyStoppedBecause;
  configuredRunsUnknown: boolean;
  completedRuns: number;
  maximumSequenceLength: number | null;
  maximumSequenceLengthUnknown: boolean;
  frontiers: PropertyExplorationFrontier[];
  seeds: PropertyExplorationSeed[];
  swarmRuns: number;
  swarmEnabledTotal: number;
  swarmUsed: boolean;
  targetBest: number;
  targetLabel: string | undefined;
  targetImprovements: number;
  truncationReasons: Set<string>;
}

/** A prefix that reached a good target value, kept for the next batch. */
interface PropertyTargetCandidate<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly value: number;
  readonly key: string;
  readonly events: readonly TEvent[];
  readonly state: TSnapshot;
}

/** A small, dependency-free PRNG, used to pick swarm subsets. */
function createSwarmRng(seed: number): () => number {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
    mode: accumulator.mode,
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
    swarm: accumulator.swarmUsed
      ? ({
          runs: accumulator.swarmRuns,
          averageEnabled: accumulator.swarmRuns
            ? accumulator.swarmEnabledTotal / accumulator.swarmRuns
            : 0
        } satisfies PropertyExplorationSwarm)
      : null,
    target: {
      best: accumulator.targetBest,
      label: accumulator.targetLabel,
      improvements: accumulator.targetImprovements
    } satisfies PropertyExplorationTarget,
    truncated: accumulator.truncationReasons.size > 0,
    truncationReasons: [...accumulator.truncationReasons].sort()
  };
}

/** Applies `actors` to a machine, rejecting logic that cannot be provided. */
function provideActors<TLogic>(
  logic: TLogic,
  actors: Readonly<Record<string, ActorLogic<any, any, any>>>
): TLogic {
  const provide = (logic as { provide?: unknown }).provide;
  if (typeof provide !== 'function') {
    throw new Error(
      'Property `actors` and `outcomes` require a state machine; the provided actor logic has no `provide()`'
    );
  }
  return (provide as (sources: unknown) => TLogic).call(logic, { actors });
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
  const mode: PropertyTestMode = options.mode ?? 'pure';
  if (mode === 'pure' && (options.actors || options.outcomes)) {
    throw new Error(
      "Property `actors` and `outcomes` require `mode: 'executed'`"
    );
  }
  const outcomeRegistry = new PropertyOutcomeRegistry();
  const providedActors: Record<string, ActorLogic<any, any, any>> = {
    ...options.actors
  };
  for (const src of Object.keys(options.outcomes ?? {})) {
    providedActors[src] = createOutcomeStub(src);
  }
  const baseModel =
    source instanceof TestModel
      ? source
      : new TestModel(source as ActorLogic<any, any, any>);
  // Coverage ids are keyed by transition-definition identity, so the machine
  // that gets provided must be the same one coverage is declared from.
  const model = Object.keys(providedActors).length
    ? new TestModel(
        provideActors(baseModel.testLogic, providedActors),
        baseModel.options
      )
    : baseModel;
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
  for (const [src, configured] of Object.entries(options.outcomes ?? {})) {
    const descriptor =
      typeof configured === 'object' &&
      configured !== null &&
      'weight' in configured
        ? (configured as PropertyCommandDescriptor<unknown>)
        : { generate: configured as unknown };
    commands.push({
      type: 'outcome',
      src,
      generator: descriptor.generate,
      weight: assertPropertyWeight(
        descriptor.weight,
        `"outcome" command for "${src}"`
      )
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
    mode,
    configuredRuns: 0,
    configuredRunsOverride: null,
    stoppedBecause: 'budget',
    configuredRunsUnknown: false,
    completedRuns: 0,
    maximumSequenceLength: 0,
    maximumSequenceLengthUnknown: false,
    frontiers: [],
    seeds: [],
    swarmRuns: 0,
    swarmEnabledTotal: 0,
    swarmUsed: !!options.swarm,
    targetBest: -Infinity,
    targetLabel: undefined,
    targetImprovements: 0,
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
  const targetFrontierOptions: PropertyTargetFrontierOptions | null =
    configuredFrontiers &&
    !Array.isArray(configuredFrontiers) &&
    (configuredFrontiers as PropertyTargetFrontierOptions).strategy === 'target'
      ? (configuredFrontiers as PropertyTargetFrontierOptions)
      : null;
  const frontierOptions: PropertyFrontierOptions<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>
  > | null = Array.isArray(configuredFrontiers)
    ? { paths: configuredFrontiers }
    : configuredFrontiers && !autoFrontierOptions && !targetFrontierOptions
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

  const swarmOptions: PropertySwarmOptions | null = options.swarm
    ? options.swarm === true
      ? {}
      : options.swarm
    : null;
  const swarmCaseIds = events.map((event) => event.caseId);
  const swarmMinimum = Math.max(
    1,
    Math.min(
      swarmCaseIds.length,
      swarmOptions?.minCases ?? Math.ceil(swarmCaseIds.length / 2)
    )
  );
  const swarmSeed = swarmOptions?.seed ?? 0;
  /** The enabled subset for one run. Deterministic in `swarmSeed + runIndex`. */
  const selectSwarmCases = (runIndex: number): readonly string[] => {
    const rng = createSwarmRng(swarmSeed + runIndex * 0x2545f491);
    const shuffled = swarmCaseIds.slice();
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapWith = Math.floor(rng() * (index + 1));
      [shuffled[index], shuffled[swapWith]] = [
        shuffled[swapWith],
        shuffled[index]
      ];
    }
    const count =
      swarmMinimum + Math.floor(rng() * (shuffled.length - swarmMinimum + 1));
    return shuffled.slice(0, count).sort();
  };
  // Shrinking re-runs the failing scenario, so the enabled subset is frozen to
  // the one the failing run used as soon as a run fails.
  let frozenSwarm: readonly string[] | undefined;
  const targetCandidates: PropertyTargetCandidate<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>
  >[] = [];
  const targetFrontierLimit =
    targetFrontierOptions?.maxFrontiers ?? DEFAULT_MAX_FRONTIERS;

  const recordRun = (
    runner: PropertyScenarioRunner<
      SnapshotFromSource<TSource>,
      EventFromSource<TSource>
    >,
    runIndex: number,
    enabled: readonly string[] | undefined
  ): void => {
    const passed = runner.isFinished();
    if (swarmOptions && !passed && !frozenSwarm) {
      frozenSwarm = enabled;
    }
    let trace:
      | PropertyTrace<SnapshotFromSource<TSource>, EventFromSource<TSource>>
      | undefined;
    try {
      trace = runner.getTrace();
    } catch {
      return;
    }
    for (const observation of runner.getTargetObservations()) {
      if (observation.value > exploration.targetBest) {
        exploration.targetBest = observation.value;
        exploration.targetLabel = observation.label;
        exploration.targetImprovements++;
      }
      if (!targetFrontierOptions) {
        continue;
      }
      const prefix = trace.timeline.slice(0, observation.index);
      const prefixEvents = prefix
        .filter(
          (
            entry
          ): entry is PropertyEventTimelineEntry<
            SnapshotFromSource<TSource>,
            EventFromSource<TSource>
          > => entry.kind === 'event'
        )
        .map((entry) => entry.command.event);
      if (!prefixEvents.length) {
        continue;
      }
      const key = JSON.stringify(prefixEvents);
      if (targetCandidates.some((candidate) => candidate.key === key)) {
        continue;
      }
      targetCandidates.push({
        value: observation.value,
        key,
        events: prefixEvents,
        state:
          prefix.length > 0
            ? prefix[prefix.length - 1].snapshot
            : trace.initialSnapshot
      });
    }
    targetCandidates.sort(
      (left, right) =>
        right.value - left.value ||
        left.events.length - right.events.length ||
        (left.key < right.key ? -1 : 1)
    );
    targetCandidates.length = Math.min(
      targetCandidates.length,
      targetFrontierLimit * 4
    );
    options.collect?.(trace, { passed, runIndex });
  };

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
    let scenarioRunCount = 0;
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
        const runIndex = (runOffset ?? 0) + scenarioRunCount++;
        const runner = new PropertyScenarioRunner(
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
          coverage,
          mode === 'executed' ? { mode, registry: outcomeRegistry } : undefined
        );
        if (options.target) {
          runner.setTargetFunction(options.target);
        }
        let enabled: readonly string[] | undefined;
        if (swarmOptions) {
          enabled = frozenSwarm ?? selectSwarmCases(runIndex);
          runner.setSwarm(enabled);
          exploration.swarmRuns++;
          exploration.swarmEnabledTotal += enabled.length;
        }
        const dispose = runner.dispose.bind(runner);
        (
          runner as PropertyScenarioRunner<
            SnapshotFromSource<TSource>,
            EventFromSource<TSource>
          > & { dispose: () => Promise<void> }
        ).dispose = async () => {
          try {
            await dispose();
          } finally {
            recordRun(runner, runIndex, enabled);
          }
        };
        return runner;
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

  if (!options.until && !autoFrontierOptions && !targetFrontierOptions) {
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

    let nextTargetIndex = 0;
    const getTargetScenarios = (
      budget: number
    ): [Scenario, number | undefined][] => {
      const candidates = targetCandidates.slice(0, targetFrontierLimit);
      if (!candidates.length) {
        return [[undefined, budget]];
      }
      const perFrontier =
        targetFrontierOptions!.runsPerFrontier ??
        Math.max(1, Math.floor(budget / candidates.length));
      return candidates.map((candidate) => {
        const frontier = {
          state: candidate.state,
          steps: candidate.events.map((event) => ({
            state: candidate.state,
            event
          })),
          weight: candidate.events.length
        } as unknown as StatePath<
          SnapshotFromSource<TSource>,
          EventFromSource<TSource>
        >;
        const id = getFrontierId(frontier);
        declarePropertyFrontier(coverage, id);
        return [{ frontier, index: nextTargetIndex++, id }, perFrontier] as [
          Scenario,
          number | undefined
        ];
      });
    };

    while (exploration.completedRuns < maxRuns) {
      const budget = Math.min(batchRuns, maxRuns - exploration.completedRuns);
      const batch: [Scenario, number | undefined][] = autoFrontierOptions
        ? getAutoScenarios(budget)
        : targetFrontierOptions
          ? getTargetScenarios(budget)
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

/**
 * Thrown by `replayPropertyTest()` when a fixture recorded from a failing run
 * replays without reproducing that failure — the regression is fixed, or the
 * machine no longer behaves the way the fixture recorded.
 */
export class PropertyReplayNotReproducedError extends Error {
  public override readonly name = 'PropertyReplayNotReproducedError';

  public constructor(
    /** The step the fixture recorded the failure at. */
    public readonly step: number
  ) {
    super(
      `Property replay did not reproduce the recorded failure at step ${step}`
    );
  }
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
    /**
     * Defaults to the mode recorded in the fixture. In `'executed'` mode the
     * replay drives a real actor, and every invoke source the fixture
     * recorded an outcome for is replaced by a stub that replays those
     * outcomes, so no real service is called.
     */
    readonly mode?: PropertyTestMode;
    /** Actor logic to provide before replaying. Executed mode only. */
    readonly actors?: Readonly<Record<string, ActorLogic<any, any, any>>>;
    /**
     * `'failure'` (the default) expects the fixture to reproduce its recorded
     * failure, and throws {@link PropertyReplayNotReproducedError} when it
     * does not. `'pass'` expects the whole timeline to replay cleanly, and
     * lets any property failure through.
     */
    readonly expect?: 'failure' | 'pass';
  }
): Promise<
  PropertyTrace<SnapshotFromSource<TSource>, EventFromSource<TSource>>
> {
  const baseModel =
    source instanceof TestModel
      ? source
      : new TestModel(source as ActorLogic<any, any, any>);
  const mode: PropertyTestMode =
    options.mode ??
    (fixture.formatVersion === 2 ? fixture.mode : undefined) ??
    'pure';
  const recordedOutcomes =
    fixture.formatVersion === 2 ? (fixture.outcomes ?? []) : [];
  const outcomeRegistry = new PropertyOutcomeRegistry();
  const providedActors: Record<string, ActorLogic<any, any, any>> = {
    ...options.actors
  };
  if (mode === 'executed') {
    for (const record of recordedOutcomes) {
      providedActors[record.src] ??= createOutcomeStub(record.src);
    }
  }
  const model = Object.keys(providedActors).length
    ? new TestModel(
        provideActors(baseModel.testLogic, providedActors),
        baseModel.options
      )
    : baseModel;
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
    coverage,
    mode === 'executed'
      ? {
          mode,
          registry: outcomeRegistry,
          seededOutcomes: recordedOutcomes
        }
      : undefined
  );
  const failedAt = fixture.failedAt;
  await runner.start();
  try {
    for (const entry of normalizeFixtureTimeline(fixture)) {
      const command = entry.command as PropertyCommand<
        EventFromSource<TSource>
      >;
      await runner.replay(command);
      if (failedAt !== undefined && runner.getStableStep() > failedAt) {
        // The recorded failure step has been replayed; anything after it was
        // never reached by the original run.
        break;
      }
    }
    runner.finish();
    if (options.expect === 'pass') {
      return runner.getTrace();
    }
    throw new PropertyReplayNotReproducedError(
      failedAt ?? runner.getStableStep()
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
      previousSnapshot: serializeSnapshot(entry.previousSnapshot),
      snapshot: serializeSnapshot(entry.snapshot),
      effects: entry.effects,
      transitionIds: entry.transitionIds,
      guardIds: entry.guardIds,
      ...(entry.kind === 'actorEvent'
        ? {
            source: entry.source,
            actorId: entry.actorId,
            event: entry.event
          }
        : {
            command: entry.command,
            observation: entry.observation,
            ...(entry.kind === 'event'
              ? { activeStateIds: entry.activeStateIds }
              : {})
          })
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
    if (entry.kind === 'actorEvent') {
      lines.push(
        `${entry.index}. actor(${entry.source}:${entry.actorId}) ${JSON.stringify(entry.event)} -> ${JSON.stringify(serializeSnapshot(entry.snapshot))}`
      );
      if (entry.transitionIds.length) {
        lines.push(`   transitions ${entry.transitionIds.join(', ')}`);
      }
      continue;
    }
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
