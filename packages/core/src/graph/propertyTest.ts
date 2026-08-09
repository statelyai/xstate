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
  readonly failedAt: number;
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
  readonly steps: readonly PropertyStep<TSnapshot, TEvent>[];
  readonly finalSnapshot: TSnapshot;
}

export interface PropertyCoverage {
  readonly runs: number;
  readonly steps: number;
  readonly skipped: number;
  readonly states: Readonly<Record<string, number>>;
  readonly events: Readonly<Record<string, number>>;
  readonly frontiers: Readonly<Record<string, number>>;
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
  states: Record<string, number>;
  events: Record<string, number>;
  frontiers: Record<string, number>;
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

export class PropertyScenarioRunner<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  private snapshot!: TSnapshot;
  private initialSnapshot!: TSnapshot;
  private initialEffects: readonly unknown[] = [];
  private readonly steps: PropertyStep<TSnapshot, TEvent>[] = [];
  private started = false;

  public constructor(
    private readonly logic: ActorLogic<TSnapshot, TEvent, unknown>,
    private readonly input: unknown,
    private readonly startingSnapshot: TSnapshot | undefined,
    private readonly serializeStartingSnapshot:
      | ((snapshot: TSnapshot) => unknown)
      | undefined,
    private readonly prefixEvents: readonly TEvent[],
    private readonly frontierId: string | undefined,
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
    increment(this.coverage.states, this.serializeState(snapshot));
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

  private async execute(
    event: TEvent,
    phase: PropertyStep<TSnapshot, TEvent>['phase']
  ): Promise<void> {
    const previousSnapshot = this.snapshot;
    const [snapshot, effects] = transition(this.logic, previousSnapshot, event);
    const step: PropertyStep<TSnapshot, TEvent> = {
      index: this.steps.length,
      phase,
      previousSnapshot,
      event,
      snapshot,
      effects
    };
    this.steps.push(step);
    this.snapshot = snapshot;
    this.coverage.steps++;
    increment(this.coverage.events, event.type);
    increment(this.coverage.states, this.serializeState(snapshot));
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
      steps: this.steps.slice(),
      finalSnapshot: this.snapshot
    };
  }

  private async checkInvariant(
    event: TEvent | undefined,
    previousSnapshot: TSnapshot,
    snapshot: TSnapshot,
    effects: readonly unknown[],
    step: number
  ): Promise<void> {
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
  const coverage: MutableCoverage = {
    runs: 0,
    steps: 0,
    skipped: 0,
    states: {},
    events: {},
    frontiers: {}
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

  return { coverage };
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
    states: {},
    events: {},
    frontiers: {}
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
    options.invariant,
    (snapshot) => model.options.serializeState!(snapshot, undefined),
    new Map(),
    coverage
  );
  await runner.start();
  for (const event of fixture.events) {
    await runner.run(event as EventFromSource<TSource>);
  }
  return runner.getTrace();
}
