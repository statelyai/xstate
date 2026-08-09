import {
  ActorLogic,
  EventObject,
  InputFrom,
  Snapshot,
  SnapshotFrom,
  initialTransition,
  transition
} from '../index.ts';
import { XSTATE_INIT } from '../constants.ts';
import { TestModel } from './TestModel.ts';
import { getStateNodes } from './graph.ts';
import type { StatePath } from './types.ts';

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

export interface PortablePropertyReplayFixture {
  readonly formatVersion: 1;
  readonly machine?: {
    readonly id?: string;
    readonly version?: string;
  };
  readonly start:
    | { readonly type: 'input'; readonly input: unknown }
    | { readonly type: 'snapshot'; readonly snapshot: unknown };
  readonly prefixEvents: readonly unknown[];
  readonly events: readonly unknown[];
  readonly commands?: readonly PropertyRuntimeCommand[];
  readonly failedAt: number;
}

export interface PropertyRuntimeCommand {
  readonly type: 'advance';
  readonly milliseconds: number;
  readonly atStep: number;
}

export interface PropertyTestAdapterResult {
  readonly runs: number;
  readonly replay?: PropertyReplayMetadata;
  readonly error?: unknown;
}

export interface PropertyTestAdapterRequest<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly events: readonly {
    readonly type: string;
    readonly generator: unknown;
  }[];
  readonly advanceGenerator?: unknown;
  readonly createEvent: (type: string, payload: unknown) => TEvent;
  readonly createRunner: () => PropertyScenarioRunner<TSnapshot, TEvent>;
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
  readonly dispose?: () => void | Promise<void>;
}

export interface PropertyTestAdapter<
  TKind extends PropertyGeneratorKind = PropertyGeneratorKind
> {
  readonly kind?: TKind;
  run<TSnapshot extends Snapshot<unknown>, TEvent extends EventObject>(
    request: PropertyTestAdapterRequest<TSnapshot, TEvent>
  ): Promise<PropertyTestAdapterResult>;
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

export interface PropertyStep<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly index: number;
  readonly phase: 'prefix' | 'generated';
  readonly previousSnapshot: TSnapshot;
  readonly event: TEvent;
  readonly snapshot: TSnapshot;
  readonly effects: readonly unknown[];
  readonly activeStateIds: readonly string[];
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
  readonly prefixEvents: readonly TEvent[];
  readonly events: readonly TEvent[];
  readonly commands: readonly PropertyRuntimeCommand[];
  readonly steps: readonly PropertyStep<TSnapshot, TEvent>[];
  readonly finalSnapshot: TSnapshot;
}

export interface PropertyCoverage {
  readonly runs: number;
  readonly steps: number;
  readonly skipped: number;
  readonly prefixSteps: number;
  readonly generatedSteps: number;
  readonly invariantChecks: number;
  readonly clockAdvances: number;
  readonly sutComparisons: number;
  readonly states: Readonly<Record<string, number>>;
  readonly configurations: Readonly<Record<string, number>>;
  readonly statuses: Readonly<Record<string, number>>;
  readonly events: Readonly<Record<string, number>>;
  readonly frontiers: Readonly<Record<string, number>>;
  readonly stateNodes: {
    readonly hits: Readonly<Record<string, number>>;
    readonly missed: readonly string[];
  };
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
    public readonly fixture?: PortablePropertyReplayFixture
  ) {
    super(message, { cause });
    this.name = 'PropertyTestFailure';
  }
}

interface MutableCoverage {
  runs: number;
  steps: number;
  skipped: number;
  prefixSteps: number;
  generatedSteps: number;
  invariantChecks: number;
  clockAdvances: number;
  sutComparisons: number;
  states: Record<string, number>;
  configurations: Record<string, number>;
  statuses: Record<string, number>;
  events: Record<string, number>;
  frontiers: Record<string, number>;
  stateNodes: Record<string, number>;
  declaredStateNodes: readonly string[];
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function getActiveStateIds(snapshot: Snapshot<unknown>): string[] {
  const nodes = (snapshot as { _nodes?: readonly { id: string }[] })._nodes;
  return nodes?.map((node) => node.id) ?? [];
}

function getConfiguration(snapshot: Snapshot<unknown>): string {
  const value = (snapshot as { value?: unknown }).value;
  return JSON.stringify(value ?? null);
}

function finalizeCoverage(coverage: MutableCoverage): PropertyCoverage {
  return {
    runs: coverage.runs,
    steps: coverage.steps,
    skipped: coverage.skipped,
    prefixSteps: coverage.prefixSteps,
    generatedSteps: coverage.generatedSteps,
    invariantChecks: coverage.invariantChecks,
    clockAdvances: coverage.clockAdvances,
    sutComparisons: coverage.sutComparisons,
    states: { ...coverage.states },
    configurations: { ...coverage.configurations },
    statuses: { ...coverage.statuses },
    events: { ...coverage.events },
    frontiers: { ...coverage.frontiers },
    stateNodes: {
      hits: { ...coverage.stateNodes },
      missed: coverage.declaredStateNodes.filter(
        (id) => coverage.stateNodes[id] === undefined
      )
    }
  };
}

export class PropertyScenarioRunner<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  private snapshot!: TSnapshot;
  private initialSnapshot!: TSnapshot;
  private initialEffects: readonly unknown[] = [];
  private readonly steps: PropertyStep<TSnapshot, TEvent>[] = [];
  private readonly commands: PropertyRuntimeCommand[] = [];
  private started = false;
  private sutSession: PropertySutSession<TEvent> | undefined;
  private sutCreated = false;

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
    private readonly invariant: PropertyInvariant<TSnapshot, TEvent>,
    private readonly serializeState: (snapshot: TSnapshot) => string,
    private readonly eventDescriptors: ReadonlyMap<
      string,
      PropertyEventDescriptor<unknown, TSnapshot, TEvent>
    >,
    private readonly coverage: MutableCoverage
  ) {}

  public async start(): Promise<void> {
    const [snapshot, effects]: [TSnapshot, readonly unknown[]] = this
      .startingSnapshot
      ? [this.startingSnapshot, []]
      : (initialTransition(this.logic, this.input as never) as [
          TSnapshot,
          readonly unknown[]
        ]);
    this.snapshot = snapshot;
    this.initialSnapshot = snapshot;
    this.initialEffects = effects;
    this.started = true;
    this.recordSnapshot(snapshot);
    if (this.sut) {
      this.sutSession = await this.sut.create({
        logic: this.logic,
        input: this.input,
        snapshot: this.startingSnapshot
      });
      this.sutCreated = true;
      await this.compareSut(0);
    }
    await this.checkInvariant(undefined, snapshot, snapshot, effects, 0);
    for (const event of this.prefixEvents) {
      await this.execute(event, 'prefix');
    }
    if (this.frontierId) {
      increment(this.coverage.frontiers, this.frontierId);
    }
  }

  public canRun(event: TEvent): boolean {
    const descriptor = this.eventDescriptors.get(event.type);
    const canRun =
      descriptor?.when?.({ snapshot: this.snapshot, event }) ?? true;
    if (!canRun) {
      this.coverage.skipped++;
    }
    return canRun;
  }

  public async run(event: TEvent): Promise<void> {
    if (!this.started) {
      throw new Error('Property scenario runner has not been started');
    }
    await this.execute(event, 'generated');
  }

  public async advance(milliseconds: number): Promise<void> {
    if (!this.started) {
      throw new Error('Property scenario runner has not been started');
    }
    if (!this.sutSession?.advance) {
      throw new Error('Property SUT does not support clock advancement');
    }
    this.commands.push({
      type: 'advance',
      milliseconds,
      atStep: this.steps.length
    });
    this.coverage.clockAdvances++;
    const events = await this.sutSession.advance(milliseconds);
    for (const event of events) {
      await this.execute(event, 'generated', false);
    }
    if (!events.length) {
      await this.compareSut(this.steps.length);
    }
  }

  public async dispose(): Promise<void> {
    if (this.sut && this.sutCreated) {
      await this.sutSession?.dispose?.();
      this.sutSession = undefined;
      this.sutCreated = false;
    }
  }

  private async execute(
    event: TEvent,
    phase: PropertyStep<TSnapshot, TEvent>['phase'],
    sendToSut = true
  ): Promise<void> {
    const previousSnapshot = this.snapshot;
    const [snapshot, effects] = transition(this.logic, previousSnapshot, event);
    const step: PropertyStep<TSnapshot, TEvent> = {
      index: this.steps.length,
      phase,
      previousSnapshot,
      event,
      snapshot,
      effects,
      activeStateIds: getActiveStateIds(snapshot)
    };
    this.steps.push(step);
    this.snapshot = snapshot;
    this.coverage.steps++;
    if (phase === 'prefix') {
      this.coverage.prefixSteps++;
    } else {
      this.coverage.generatedSteps++;
    }
    increment(this.coverage.events, event.type);
    this.recordSnapshot(snapshot);
    if (this.sut) {
      if (sendToSut) {
        await this.sutSession!.send(event);
      }
      await this.compareSut(this.steps.length);
    }
    await this.checkInvariant(
      event,
      previousSnapshot,
      snapshot,
      effects,
      this.steps.length
    );
  }

  public getSnapshot(): TSnapshot {
    return this.snapshot;
  }

  public getTrace(): PropertyTrace<TSnapshot, TEvent> {
    return {
      start: this.startingSnapshot
        ? { type: 'snapshot', snapshot: this.startingSnapshot }
        : { type: 'input', input: this.input },
      initialSnapshot: this.initialSnapshot,
      initialEffects: this.initialEffects,
      prefixEvents: this.steps
        .filter((step) => step.phase === 'prefix')
        .map((step) => step.event),
      events: this.steps
        .filter((step) => step.phase === 'generated')
        .map((step) => step.event),
      commands: this.commands.slice(),
      steps: this.steps.slice(),
      finalSnapshot: this.snapshot
    };
  }

  private async compareSut(step: number): Promise<void> {
    const sut = this.sut!;
    await this.sutSession!.settle?.();
    const observed = await this.sutSession!.read();
    const modelValue = sut.projectModel(this.snapshot);
    const sutValue = sut.projectSut ? sut.projectSut(observed) : observed;
    const equivalent = sut.equivalent
      ? await sut.equivalent(modelValue, sutValue)
      : JSON.stringify(modelValue) === JSON.stringify(sutValue);
    this.coverage.sutComparisons++;
    if (!equivalent) {
      throw new PropertyTestFailure(
        `Property SUT diverged after ${step} step${step === 1 ? '' : 's'}`,
        this.getTrace(),
        { model: modelValue, sut: sutValue },
        undefined,
        this.getReplayFixture(step)
      );
    }
  }

  private async checkInvariant(
    event: TEvent | undefined,
    previousSnapshot: TSnapshot,
    snapshot: TSnapshot,
    effects: readonly unknown[],
    step: number
  ): Promise<void> {
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
      throw new PropertyTestFailure(
        `Property invariant failed after ${step} step${step === 1 ? '' : 's'}`,
        this.getTrace(),
        cause,
        undefined,
        this.getReplayFixture(step)
      );
    }
  }

  private recordSnapshot(snapshot: TSnapshot): void {
    increment(this.coverage.states, this.serializeState(snapshot));
    increment(this.coverage.configurations, getConfiguration(snapshot));
    increment(this.coverage.statuses, snapshot.status);
    for (const id of getActiveStateIds(snapshot)) {
      increment(this.coverage.stateNodes, id);
    }
  }

  private getReplayFixture(failedAt: number): PortablePropertyReplayFixture {
    const identity = this.logic as { id?: string; version?: string };
    if (this.startingSnapshot && !this.serializeStartingSnapshot) {
      throw new Error(
        'Property tests starting from a snapshot require serializeSnapshot to create replay fixtures'
      );
    }
    return {
      formatVersion: 1,
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
      prefixEvents: this.steps
        .filter((step) => step.phase === 'prefix')
        .map((step) => step.event),
      events: this.steps
        .filter((step) => step.phase === 'generated')
        .map((step) => step.event),
      commands: this.commands.slice(),
      failedAt
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
  };
  readonly sut?: PropertySut<TSnapshot, TEvent>;
  readonly input?: TInput;
  readonly start?: {
    readonly snapshot: TSnapshot;
    readonly serializeSnapshot: (snapshot: TSnapshot) => unknown;
  };
  readonly frontiers?: readonly StatePath<TSnapshot, TEvent>[];
  readonly invariant: PropertyInvariant<TSnapshot, TEvent>;
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
      configured && typeof configured === 'object' && 'when' in configured
        ? (configured as PropertyEventDescriptor<
            unknown,
            SnapshotFromSource<TSource>,
            EventFromSource<TSource>
          >)
        : { generate: configured };
    eventDescriptors.set(type, descriptor);
    return { type, generator: descriptor.generate };
  });
  const machineRoot = (
    model.testLogic as { root?: Parameters<typeof getStateNodes>[0] }
  ).root;
  const declaredStateNodes = machineRoot
    ? getStateNodes(machineRoot)
        .filter((node) => node.type !== 'history' && node.type !== 'choice')
        .map((node) => node.id)
    : [];
  const coverage: MutableCoverage = {
    runs: 0,
    steps: 0,
    skipped: 0,
    prefixSteps: 0,
    generatedSteps: 0,
    invariantChecks: 0,
    clockAdvances: 0,
    sutComparisons: 0,
    states: {},
    configurations: {},
    statuses: {},
    events: {},
    frontiers: {},
    stateNodes: {},
    declaredStateNodes
  };

  const frontiers = options.frontiers?.length
    ? options.frontiers
    : ([undefined] as const);
  for (const frontier of frontiers) {
    const prefixEvents = frontier
      ? frontier.steps
          .map((step) => step.event)
          .filter((event) => event.type !== XSTATE_INIT)
      : [];
    const frontierId = frontier
      ? model.options.serializeState!(frontier.state, undefined)
      : undefined;
    const result = await options.adapter.run({
      events,
      advanceGenerator: options.commands?.advance,
      createEvent: (type, payload) =>
        ({
          ...(payload as object),
          type
        }) as EventFromSource<TSource>,
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
          frontierId,
          options.sut,
          options.invariant,
          (snapshot) => model.options.serializeState!(snapshot, undefined),
          eventDescriptors,
          coverage
        );
      }
    });

    if (result.error !== undefined) {
      if (result.error instanceof PropertyTestFailure) {
        throw new PropertyTestFailure(
          result.error.message,
          result.error.trace,
          result.error.cause,
          result.replay,
          result.error.fixture
        );
      }
      throw result.error instanceof Error
        ? result.error
        : new Error('Property adapter failed', { cause: result.error });
    }
  }

  return { coverage: finalizeCoverage(coverage) };
}

export async function replayPropertyTest<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
>(
  source: TSource,
  fixture: PortablePropertyReplayFixture,
  options: {
    readonly invariant: PropertyInvariant<
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
  if (fixture.formatVersion !== 1) {
    throw new Error(`Unsupported property replay fixture version`);
  }
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
  const serializedStartingSnapshot =
    fixture.start.type === 'snapshot' ? fixture.start.snapshot : undefined;
  if (fixture.start.type === 'snapshot' && !startingSnapshot) {
    throw new Error(
      'Property replay fixture contains a snapshot but no restoreSnapshot function was provided'
    );
  }
  const coverage: MutableCoverage = {
    runs: 1,
    steps: 0,
    skipped: 0,
    prefixSteps: 0,
    generatedSteps: 0,
    invariantChecks: 0,
    clockAdvances: 0,
    sutComparisons: 0,
    states: {},
    configurations: {},
    statuses: {},
    events: {},
    frontiers: {},
    stateNodes: {},
    declaredStateNodes: []
  };
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
    fixture.prefixEvents as EventFromSource<TSource>[],
    undefined,
    undefined,
    options.invariant,
    (snapshot) => model.options.serializeState!(snapshot, undefined),
    new Map(),
    coverage
  );
  await runner.start();
  try {
    for (const event of fixture.events) {
      await runner.run(event as EventFromSource<TSource>);
    }
    return runner.getTrace();
  } finally {
    await runner.dispose();
  }
}

export function serializePropertyTrace<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(trace: PropertyTrace<TSnapshot, TEvent>): unknown {
  const serializeSnapshot = (snapshot: TSnapshot) =>
    'toJSON' in snapshot && typeof snapshot.toJSON === 'function'
      ? snapshot.toJSON()
      : snapshot;
  return {
    start:
      trace.start.type === 'snapshot'
        ? {
            type: 'snapshot',
            snapshot: serializeSnapshot(trace.start.snapshot)
          }
        : trace.start,
    initialSnapshot: serializeSnapshot(trace.initialSnapshot),
    prefixEvents: trace.prefixEvents,
    events: trace.events,
    commands: trace.commands,
    steps: trace.steps.map((step) => ({
      index: step.index,
      phase: step.phase,
      previousSnapshot: serializeSnapshot(step.previousSnapshot),
      event: step.event,
      snapshot: serializeSnapshot(step.snapshot),
      effects: step.effects,
      activeStateIds: step.activeStateIds
    })),
    finalSnapshot: serializeSnapshot(trace.finalSnapshot)
  };
}
