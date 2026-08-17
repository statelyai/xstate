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
  recordPropertySnapshot,
  recordPropertyTransitions,
  type MutablePropertyCoverage,
  type PropertyCoverage,
  type PropertyExplorationBounds,
  type PropertyExplorationFrontier,
  type PropertyExplorationSeed
} from './propertyCoverage.ts';
import type { StatePath } from './types.ts';

export type {
  PropertyCoverage,
  PropertyCoverageDimension,
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

export interface PropertyObservation {
  readonly model: unknown;
  readonly oracle?: unknown;
  readonly sut?: unknown;
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
  readonly type: 'eventually' | 'until';
  readonly id: string;
  readonly description?: string;
  readonly within: number;
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
}

export interface PropertyTestAdapterRequest<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly events: readonly {
    readonly type: string;
    readonly caseId: string;
    readonly generator: unknown;
  }[];
  readonly commands: readonly PropertyGeneratedCommand[];
  readonly runBudget?: number;
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
> {
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

export interface PropertyInvariantContext<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
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
  readonly when?: (context: {
    readonly snapshot: TSnapshot;
    readonly event: TEvent;
  }) => boolean;
}

export type PropertyEventGenerators<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TKind extends PropertyGeneratorKind
> = {
  [TType in EventType<TEvent>]?:
    | PropertyGenerator<TKind, EventPayload<EventForType<TEvent, TType>>>
    | PropertyEventDescriptor<
        PropertyGenerator<TKind, EventPayload<EventForType<TEvent, TType>>>,
        TSnapshot,
        EventForType<TEvent, TType>
      >;
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
      readonly within: number;
      readonly predicate: PropertyTemporalPredicate<TSnapshot, TEvent>;
    }
  | {
      readonly type: 'until';
      readonly id: string;
      readonly description?: string;
      readonly within: number;
      readonly hold: PropertyTemporalPredicate<TSnapshot, TEvent>;
      readonly until: PropertyTemporalPredicate<TSnapshot, TEvent>;
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

export class PropertyTestFailure<
  TSnapshot extends Snapshot<unknown> = Snapshot<unknown>,
  TEvent extends EventObject = EventObject
> extends Error {
  public constructor(
    message: string,
    public readonly trace: PropertyTrace<TSnapshot, TEvent>,
    public readonly cause: unknown,
    public readonly replay?: PropertyReplayMetadata,
    public readonly fixture?: PortablePropertyReplayFixture,
    public readonly coverage?: PropertyCoverage
  ) {
    super(message, { cause });
    this.name = 'PropertyTestFailure';
  }
}

interface TemporalState<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  definition: PropertyTemporal<TSnapshot, TEvent>;
  satisfied: boolean;
}

function defaultEquivalent(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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
  private lastObservation: PropertyObservation | undefined;
  private generatedCommandCount = 0;

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
    private readonly reference:
      | PropertyReferenceOracle<TSnapshot, TEvent>
      | undefined,
    private readonly invariant: PropertyInvariant<TSnapshot, TEvent>,
    temporal: readonly PropertyTemporal<TSnapshot, TEvent>[],
    private readonly eventDescriptors: ReadonlyMap<
      string,
      PropertyEventDescriptor<unknown, TSnapshot, TEvent>
    >,
    private readonly coverage: MutablePropertyCoverage
  ) {
    this.temporal = temporal.map((definition) => ({
      definition,
      satisfied: false
    }));
  }

  public async start(): Promise<void> {
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
      snapshot: this.startingSnapshot
    };
    if (this.reference) {
      this.referenceSession = await this.reference.create(context);
    }
    if (this.sut) {
      this.sutSession = await this.sut.create(context);
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
    this.recordGeneratedCommand();
    recordPropertyEventCase(this.coverage, caseId, 'generated');
    const descriptor = this.eventDescriptors.get(event.type);
    const canRun =
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

  public canRunCommand(applicable: boolean): boolean {
    this.recordGeneratedCommand();
    if (!applicable) {
      this.coverage.skipped++;
    }
    return applicable;
  }

  public async run(event: TEvent, caseId: string): Promise<void> {
    this.assertStarted();
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
      if (!state.satisfied) {
        this.failTemporal(state.definition);
      }
    }
  }

  public async dispose(): Promise<void> {
    const errors: unknown[] = [];
    for (const dispose of [
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
    this.coverage.invariantChecks++;
    try {
      await this.invariant({
        initialSnapshot: this.initialSnapshot,
        previousSnapshot,
        snapshot,
        event,
        effects,
        step
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
      step
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
      if (definition.type === 'eventually') {
        state.satisfied = await definition.predicate(context);
      } else if (await definition.until(context)) {
        state.satisfied = true;
      } else if (!(await definition.hold(context))) {
        this.failTemporal(definition);
      }
      if (!state.satisfied && context.step >= definition.within) {
        this.failTemporal(definition);
      }
    }
  }

  private failTemporal(definition: PropertyTemporal<TSnapshot, TEvent>): never {
    const failure: PortableTemporalFailure = {
      type: definition.type,
      id: definition.id,
      description: definition.description,
      within: definition.within,
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
    const observation: PropertyObservation = {
      model,
      oracle: reference,
      sut
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
      const sutModel = this.sut.projectModel(this.snapshot);
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
          oracle: reference,
          sut,
          oracleMatches: referenceMatches,
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
    return (
      (snapshot as { _nodes?: readonly { id: string }[] })._nodes?.map(
        (node) => node.id
      ) ?? []
    );
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
    throw new PropertyTestFailure(
      message,
      this.getTrace(),
      cause,
      undefined,
      this.getReplayFixture(failedAt, temporalFailure)
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

export interface PropertyTestOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TKind extends PropertyGeneratorKind
> {
  readonly adapter: PropertyTestAdapter<TKind>;
  readonly events: PropertyEventGenerators<TSnapshot, TEvent, TKind>;
  readonly commands?: {
    readonly advance?: PropertyGenerator<TKind, number>;
    readonly checkpoint?: PropertyGenerator<TKind, { readonly label?: string }>;
    readonly stop?: PropertyGenerator<TKind, Record<string, never>>;
  };
  readonly sut?: PropertySut<TSnapshot, TEvent>;
  readonly reference?: PropertyReferenceOracle<TSnapshot, TEvent>;
  readonly input?: TInput;
  readonly start?: {
    readonly snapshot: TSnapshot;
    readonly serializeSnapshot: (snapshot: TSnapshot) => unknown;
  };
  readonly frontiers?:
    | readonly StatePath<TSnapshot, TEvent>[]
    | PropertyFrontierOptions<TSnapshot, TEvent>;
  readonly invariant: PropertyInvariant<TSnapshot, TEvent>;
  readonly temporal?: readonly PropertyTemporal<TSnapshot, TEvent>[];
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
    configuredRuns: accumulator.configuredRunsUnknown
      ? null
      : accumulator.configuredRuns,
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
    PropertyEventDescriptor<
      unknown,
      SnapshotFromSource<TSource>,
      EventFromSource<TSource>
    >
  >();
  const events = Object.entries(options.events).map(([type, configured]) => {
    const descriptor =
      configured &&
      typeof configured === 'object' &&
      ('when' in configured || 'case' in configured)
        ? (configured as PropertyEventDescriptor<
            unknown,
            SnapshotFromSource<TSource>,
            EventFromSource<TSource>
          >)
        : { generate: configured };
    const caseName = descriptor.case ?? 'default';
    if (!caseName) {
      throw new Error(`Property event case for "${type}" must not be empty`);
    }
    const caseId = getPropertyEventCaseId(type, caseName);
    eventDescriptors.set(type, descriptor);
    return { type, caseId, generator: descriptor.generate };
  });
  const commands: PropertyGeneratedCommand[] = [];
  for (const type of ['advance', 'checkpoint', 'stop'] as const) {
    const generator = options.commands?.[type];
    if (generator !== undefined) {
      commands.push({ type, generator });
    }
  }
  const coverage = createPropertyCoverage(model.testLogic);
  for (const event of events) {
    declarePropertyEventCase(coverage, event.caseId);
  }
  const exploration: PropertyExplorationAccumulator = {
    configuredRuns: 0,
    configuredRunsUnknown: false,
    completedRuns: 0,
    maximumSequenceLength: 0,
    maximumSequenceLengthUnknown: false,
    frontiers: [],
    seeds: [],
    truncationReasons: new Set()
  };
  const configuredFrontiers = options.frontiers;
  const frontierOptions: PropertyFrontierOptions<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>
  > | null = Array.isArray(configuredFrontiers)
    ? { paths: configuredFrontiers }
    : configuredFrontiers
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

  for (const frontierContext of scenarios) {
    const prefixEvents = frontierContext
      ? frontierContext.frontier.steps
          .map((step) => step.event)
          .filter((event) => event.type !== XSTATE_INIT)
      : [];
    const runBudget = frontierContext
      ? typeof frontierOptions?.runsPerFrontier === 'function'
        ? frontierOptions.runsPerFrontier(frontierContext)
        : frontierOptions?.runsPerFrontier
      : undefined;
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
      createEvent: (type, payload) =>
        ({ ...(payload as object), type }) as EventFromSource<TSource>,
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
      if (result.error instanceof PropertyTestFailure) {
        throw new PropertyTestFailure(
          result.error.message,
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
  }

  return {
    coverage: finalizePropertyCoverage(
      coverage,
      finalizeExploration(coverage, exploration)
    )
  };
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
    undefined,
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
    }
    runner.finish();
    return runner.getTrace();
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
