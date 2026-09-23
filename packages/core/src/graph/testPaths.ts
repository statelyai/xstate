import type {
  ActorLogic,
  AnyEventObject,
  EventObject,
  Snapshot
} from '../index.ts';
import { XSTATE_INIT } from '../constants.ts';
import { createMockActorScope } from './actorScope.ts';
import { getAllOwnEvents } from '../utils.ts';
import type { TestModel } from './TestModel.ts';
import { deduplicatePaths } from './deduplicatePaths.ts';
import {
  createSeededRng,
  deriveCaseSeed,
  isEventDescriptorObject,
  normalizeEventDescriptors,
  sampleGenerator,
  type AnyTestEventDescriptor,
  type NormalizedEventCase,
  type TestGenerator
} from './eventDescriptors.ts';
import { getPropertyEventCaseId, type TestCoverage } from './coverage.ts';
import {
  ModelTestFailure,
  propertyTest,
  type TestSut,
  type TestStateAssertions,
  type PropertyScenarioRunner,
  type TestAdapter,
  type TestAdapterRequest,
  type TestAdapterResult,
  type TestActorOutcome,
  type TestMode,
  type TestOptions,
  type PropertyGeneratorKind
} from './propertyTest.ts';
import { getShortestPaths } from './shortestPaths.ts';
import { getSimplePaths } from './simplePaths.ts';
import { getPathsFromEvents } from './pathFromEvents.ts';
import type {
  PathGenerator,
  StatePath,
  TestParam,
  TraversalOptions
} from './types.ts';

/** How `testPaths()` produced the paths it executed. */
export type TestPathGeneratorKind = 'shortest' | 'simple' | 'events' | 'custom';

/** The result of executing one path. */
export interface TestPathRunResult<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly path: StatePath<TSnapshot, TEvent>;
  readonly passed: boolean;
  readonly error?: unknown;
}

/** Path-generation options. The counterpart of the property-only options. */
export interface PathOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> {
  /**
   * Paths to execute. Defaults to the shortest paths through the machine, or
   * to whatever `pathGenerator` produces.
   */
  readonly paths?: readonly StatePath<TSnapshot, TEvent>[];
  /**
   * `'shortest'` (the default), `'simple'`, or a custom
   * {@link PathGenerator}. `'events'` is implied by `fromEvents`.
   */
  readonly pathGenerator?:
    | 'shortest'
    | 'simple'
    | PathGenerator<TSnapshot, TEvent, TInput>;
  /** Executes a single path built from this literal event sequence. */
  readonly fromEvents?: readonly TEvent[];
  /** Traversal limit. Traversal throws once it is exceeded. Defaults to `Infinity`. */
  readonly limit?: number;
  /** Keeps only the paths that end in a state matching this predicate. */
  readonly toState?: (snapshot: TSnapshot) => boolean;
  /** Starts traversal from this snapshot instead of the initial state. */
  readonly fromState?: TSnapshot;
  /** Stops expanding a state when this returns `true`. */
  readonly stopWhen?: (snapshot: TSnapshot) => boolean;
  /**
   * Concrete values sampled from each event case's `generate` before
   * traversal. Must be an integer of at least `1`. Defaults to `3`.
   */
  readonly samples?: number;
  /**
   * Seed for the sampling PRNG. Defaults to `0`. Each event case draws from
   * its own stream, derived from `seed` and the case id, so adding or removing
   * a case leaves the other cases' payloads unchanged.
   */
  readonly seed?: number;
  /** Identifies a traversal state. Two snapshots with the same string are one node. */
  readonly serializeState?: (
    snapshot: TSnapshot,
    event: TEvent | undefined,
    previousSnapshot?: TSnapshot
  ) => string;
  /** Identifies a traversal event. */
  readonly serializeEvent?: (event: TEvent) => string;
  /**
   * Keeps paths that are prefixes of longer paths instead of dropping them.
   *
   * @default false
   */
  readonly allowDuplicatePaths?: boolean;
}

/**
 * The generator kind path generation understands natively: a plain
 * `(rng) => value` function, or an object with a `sample(rng)` method.
 * `@xstate/test` adapts fast-check arbitraries into this shape before calling
 * `testPaths()`, so `xstate/graph` never depends on fast-check.
 */
export interface SeededGeneratorKind extends PropertyGeneratorKind {
  readonly generator: TestGenerator<this['target']>;
}

export type TestPathsOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TKind extends PropertyGeneratorKind = SeededGeneratorKind
> = TestOptions<TSnapshot, TEvent, TInput, TKind> &
  PathOptions<TSnapshot, TEvent, TInput>;

/** The shared options, without the keys that select which paths to run. */
export type TestExecutionOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TKind extends PropertyGeneratorKind = SeededGeneratorKind
> = Omit<
  TestPathsOptions<TSnapshot, TEvent, TInput, TKind>,
  'paths' | 'pathGenerator' | 'fromEvents'
>;

const DEFAULT_SAMPLES = 3;

/** Internal event types path generation drives explicitly. */
const DONE_ACTOR_EVENT = 'xstate.done.actor';
const ERROR_ACTOR_EVENT = 'xstate.error.actor';
const AFTER_EVENT = 'xstate.after';
const DONE_STATE_EVENT = 'xstate.done.state';

/**
 * The internal events traversal offers. The other internal events (state and
 * invoke timeouts, actor snapshots) are left out: nothing here can drive them
 * in executed mode, and a path that assumed one would desynchronize.
 */
const TRAVERSED_INTERNAL_EVENTS: ReadonlySet<string> = new Set([
  DONE_ACTOR_EVENT,
  ERROR_ACTOR_EVENT,
  AFTER_EVENT
]);

/** Internal events are the machine's own; only user events have declared cases. */
function isInternalEventType(type: string): boolean {
  return type.startsWith('xstate.');
}

function assertGeneratedOutcome(
  value: unknown,
  src: string
): asserts value is TestActorOutcome {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { ok?: unknown }).ok !== 'boolean'
  ) {
    throw new Error(
      `The \`outcomes\` generator for "${src}" produced ${JSON.stringify(
        value
      )} instead of an actor outcome. Generate \`{ ok: true, output }\` or \`{ ok: false, error }\`.`
    );
  }
}

/**
 * Samples concrete actor outcomes from `outcomes`, the same way event payloads
 * are sampled from `events`, so traversal can label each `xstate.done.actor` /
 * `xstate.error.actor` step with the outcome that produced it.
 */
function sampleTestOutcomes(
  outcomes: Readonly<Record<string, unknown>> | undefined,
  samples: number,
  seed: number
): ReadonlyMap<string, readonly TestActorOutcome[]> {
  const sampled = new Map<string, readonly TestActorOutcome[]>();
  for (const [src, configured] of Object.entries(outcomes ?? {})) {
    const generator = isEventDescriptorObject(configured)
      ? (configured as { generate?: unknown }).generate
      : configured;
    if (generator === undefined) {
      continue;
    }
    const rng = createSeededRng(deriveCaseSeed(seed, `outcome:${src}`));
    const values = sampleGenerator(generator, rng, samples);
    for (const value of values) {
      assertGeneratedOutcome(value, src);
    }
    sampled.set(src, values as readonly TestActorOutcome[]);
  }
  return sampled;
}

/** Resolves an `after` delay reference to the milliseconds to advance. */
function resolveTestDelay(logic: unknown, delayRef: number | string): number {
  if (typeof delayRef === 'number') {
    return delayRef;
  }
  const configured = (
    logic as { sources?: { delays?: Record<string, unknown> } }
  )?.sources?.delays?.[delayRef];
  if (typeof configured === 'number') {
    return configured;
  }
  throw new Error(
    `Cannot advance the clock for the delayed transition "${delayRef}": ${
      configured === undefined
        ? `the machine declares no \`delays.${delayRef}\``
        : `\`delays.${delayRef}\` is computed at runtime, and path generation needs a fixed number`
    }. Provide a numeric delay, or run this case through \`propertyTest()\` with a generated \`advance\` command.`
  );
}

/** How an internal path step is driven in executed mode. */
interface InternalStepPlan {
  readonly mode: TestMode;
  readonly outcomeByEvent: WeakMap<
    object,
    { readonly src: string; readonly outcome: TestActorOutcome }
  >;
  readonly delayByEvent: WeakMap<object, number | string>;
  readonly resolveDelay: (delayRef: number | string) => number;
}

const LEGACY_EVENT_EXECUTOR_MESSAGE =
  'A pre-2.0 event executor was passed as an event generator. `events` now declares how event *payloads* are generated; the functions that drive the system under test belong in `sut`. Wrap the old shape with `fromTestParam({ events, states })`, or write the `sut` directly.';

/**
 * A `generate` value without a `resolve` must produce the event payload, so a
 * sample that is not a plain object is a pre-2.0 executor called with the PRNG
 * rather than a generator.
 */
function assertGeneratedPayload(value: unknown, type: string): void {
  if (value === undefined) {
    return;
  }
  const isPayload =
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { then?: unknown }).then !== 'function';
  if (!isPayload) {
    throw new Error(
      `Event "${type}" generated ${
        typeof value === 'object' ? 'a non-payload value' : `a ${typeof value}`
      } instead of an event payload object. ${LEGACY_EVENT_EXECUTOR_MESSAGE}`
    );
  }
}

/**
 * Detects the pre-2.0 `TestParam` shape (`{ events, states }`, both maps of
 * functions, and nothing else) passed where the unified options are expected.
 *
 * `events` generators and top-level `states` assertions are both functions in
 * the unified API too, so the presence of a `sut` — which `TestParam` has no
 * equivalent of — settles the ambiguity in favor of the new shape.
 */
export function assertNotTestParam(options: unknown): void {
  if (!options || typeof options !== 'object') {
    return;
  }
  const { events, states, sut } = options as {
    events?: unknown;
    states?: unknown;
    sut?: unknown;
  };
  const isFunctionMap = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const entries = Object.values(value as Record<string, unknown>);
    return (
      entries.length > 0 &&
      entries.every((entry) => typeof entry === 'function')
    );
  };
  if (sut === undefined && isFunctionMap(events) && isFunctionMap(states)) {
    throw new Error(LEGACY_EVENT_EXECUTOR_MESSAGE);
  }
}

/**
 * Expands an event type into the concrete events traversal should offer,
 * applying each declared case's `generate`, `resolve`, and `when`.
 */
function createEventExpander<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  cases: readonly NormalizedEventCase<TSnapshot, TEvent>[],
  samples: number,
  seed: number,
  caseIds: WeakMap<object, string>
) {
  const drawn = new Map<string, readonly unknown[]>();
  const byType = new Map<string, NormalizedEventCase<TSnapshot, TEvent>[]>();
  for (const eventCase of cases) {
    if (eventCase.generator !== undefined) {
      // Each case draws from its own stream so that adding an event type does
      // not shift the payloads sampled for the cases already declared.
      const rng = createSeededRng(deriveCaseSeed(seed, eventCase.caseId));
      const values = sampleGenerator(eventCase.generator, rng, samples);
      if (!eventCase.descriptor.resolve) {
        for (const value of values) {
          assertGeneratedPayload(value, eventCase.type);
        }
      }
      drawn.set(eventCase.caseId, values);
    }
    const list = byType.get(eventCase.type) ?? [];
    list.push(eventCase);
    byType.set(eventCase.type, list);
  }

  return {
    /** The event types `events` declares, whether or not the machine owns them. */
    declaredTypes: [...byType.keys()],
    expand(snapshot: TSnapshot, template: TEvent): TEvent[] {
      const configured = byType.get(template.type);
      if (!configured) {
        return [template];
      }
      const expanded: TEvent[] = [];
      for (const eventCase of configured) {
        const descriptor: AnyTestEventDescriptor<TSnapshot, TEvent> =
          eventCase.descriptor;
        const generated = drawn.get(eventCase.caseId) ?? [undefined];
        for (const value of generated) {
          const payload = descriptor.resolve
            ? descriptor.resolve({ snapshot, generated: value })
            : (value as object | undefined);
          if (descriptor.resolve && payload === undefined) {
            continue;
          }
          const event = {
            ...template,
            ...(payload ?? {}),
            type: template.type
          } as TEvent;
          if (descriptor.when && !descriptor.when({ snapshot, event })) {
            continue;
          }
          caseIds.set(event, eventCase.caseId);
          expanded.push(event);
        }
      }
      return expanded;
    }
  };
}

/**
 * An adapter that executes a fixed list of paths instead of generating
 * command sequences. One path is one run; there is no shrinking.
 */
function createPathAdapter<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  paths: readonly StatePath<TSnapshot, TEvent>[],
  caseIds: WeakMap<object, string>,
  results: TestPathRunResult<TSnapshot, TEvent>[],
  plan: InternalStepPlan
): TestAdapter<any> {
  return {
    async run<TS extends Snapshot<unknown>, TE extends EventObject>(
      request: TestAdapterRequest<TS, TE>
    ): Promise<TestAdapterResult> {
      let runs = 0;
      let error: unknown;
      let maximumSequenceLength = 0;
      for (const path of paths) {
        const steps = path.steps.filter(
          (step) => step.event.type !== XSTATE_INIT
        );
        maximumSequenceLength = Math.max(maximumSequenceLength, steps.length);
        const runner =
          request.createRunner() as unknown as PropertyScenarioRunner<
            TSnapshot,
            TEvent
          >;
        let pathError: unknown;
        try {
          await runner.start();
          for (const step of steps) {
            const event = step.event;
            if (plan.mode === 'executed') {
              const resolved = plan.outcomeByEvent.get(
                event as unknown as object
              );
              if (resolved) {
                // The invoke source is stubbed, so the step resolves it with
                // the outcome traversal took this branch for.
                if (runner.canRunOutcome()) {
                  await runner.outcome(resolved.src, resolved.outcome);
                }
                continue;
              }
              const delayRef = plan.delayByEvent.get(
                event as unknown as object
              );
              if (delayRef !== undefined) {
                await runner.advance(plan.resolveDelay(delayRef));
                continue;
              }
              if (event.type === DONE_STATE_EVENT) {
                // Raised by the machine itself once the region reaches its
                // final state; there is nothing to drive.
                continue;
              }
            }
            const caseId =
              caseIds.get(event as unknown as object) ??
              getPropertyEventCaseId(event.type, 'default');
            if (!runner.canRun(event, caseId)) {
              continue;
            }
            await runner.run(event, caseId);
          }
          runner.finish();
        } catch (cause) {
          pathError = cause;
        } finally {
          try {
            await runner.dispose();
          } catch (cause) {
            pathError ??= cause;
          }
        }
        runs++;
        results.push({ path, passed: !pathError, error: pathError });
        if (pathError) {
          error = pathError;
          break;
        }
      }
      return {
        runs,
        exploration: {
          configuredRuns: paths.length,
          maximumSequenceLength,
          engine: 'paths',
          truncated: error !== undefined && runs < paths.length,
          truncationReasons:
            error !== undefined && runs < paths.length
              ? ['counterexample found before every path ran']
              : []
        },
        ...(error === undefined ? {} : { error })
      };
    }
  };
}

function withPathExploration(
  coverage: TestCoverage,
  pathCount: number,
  pathGenerator: TestPathGeneratorKind
): TestCoverage {
  return {
    ...coverage,
    exploration: {
      ...coverage.exploration,
      strategy: 'paths',
      pathCount,
      pathGenerator
    }
  };
}

type SnapshotFromSource<T> =
  T extends TestModel<infer TSnapshot, any, any>
    ? TSnapshot
    : T extends ActorLogic<infer TSnapshot, any, any>
      ? TSnapshot
      : never;
type EventFromSource<T> =
  T extends TestModel<any, infer TEvent, any>
    ? TEvent
    : T extends ActorLogic<any, infer TEvent, any>
      ? TEvent
      : never;
type InputFromSource<T> =
  T extends TestModel<any, any, infer TInput>
    ? TInput
    : T extends ActorLogic<any, any, infer TInput>
      ? TInput
      : never;

/**
 * Executes model paths against a system under test.
 *
 * `testPaths()` and `propertyTest()` share their `events`, `sut`, `states`,
 * `invariant`, `temporal`, and `reference` options and produce the same
 * coverage object and the same failure type. They differ only in how the event
 * sequences are produced: traversal of the model's state graph here, generated
 * command sequences there.
 */
export async function testPaths<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
>(
  source: TSource,
  options: TestPathsOptions<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>,
    InputFromSource<TSource>
  > = {} as never
): Promise<{
  readonly coverage: TestCoverage;
  readonly results: readonly TestPathRunResult<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>
  >[];
}> {
  type TSnapshot = SnapshotFromSource<TSource>;
  type TEvent = EventFromSource<TSource>;

  assertNotTestParam(options);
  if ((options as Record<string, unknown>).commands !== undefined) {
    throw new Error(
      '`commands` is not supported by path generation; use `propertyTest()`. Paths decide their own `advance` and `outcome` commands from the internal events the traversal took.'
    );
  }
  const samples = options.samples ?? DEFAULT_SAMPLES;
  if (!Number.isInteger(samples) || samples < 1) {
    throw new Error(
      `\`samples\` must be an integer of at least 1 (received ${String(
        options.samples
      )}).`
    );
  }

  // Duck-typed rather than `instanceof TestModel`: `TestModel` imports this
  // module, so a value import here would be an import cycle. Only the logic is
  // needed for traversal; `propertyTest()` normalizes the source itself.
  const testLogic = (
    typeof (source as { getShortestPaths?: unknown }).getShortestPaths ===
    'function'
      ? (source as unknown as TestModel<TSnapshot, TEvent, unknown>).testLogic
      : source
  ) as ActorLogic<TSnapshot, TEvent, unknown>;
  const { cases } = normalizeEventDescriptors<TSnapshot, TEvent>(
    (options.events ?? {}) as Readonly<Record<string, unknown>>
  );
  const caseIds = new WeakMap<object, string>();
  const expander = createEventExpander<TSnapshot, TEvent>(
    cases,
    samples,
    options.seed ?? 0,
    caseIds
  );

  const mode: TestMode = options.mode ?? 'pure';
  const sampledOutcomes = sampleTestOutcomes(
    options.outcomes as Readonly<Record<string, unknown>> | undefined,
    samples,
    options.seed ?? 0
  );
  /** Invoke `id` to invoke `src`, collected from the state nodes as seen. */
  const invokeSrcById = new Map<string, string>();
  const outcomeByEvent = new WeakMap<
    object,
    { readonly src: string; readonly outcome: TestActorOutcome }
  >();
  const delayByEvent = new WeakMap<object, number | string>();

  /**
   * Turns one synthesized internal event into the concrete events traversal
   * should offer, and remembers what executed mode has to do to reach it.
   */
  const expandInternalEvent = (event: AnyEventObject): TEvent[] => {
    if (event.type === AFTER_EVENT) {
      const offered = { ...event } as unknown as TEvent;
      delayByEvent.set(
        offered as unknown as object,
        (event as unknown as { delay: number | string }).delay
      );
      return [offered];
    }
    const ok = event.type === DONE_ACTOR_EVENT;
    const src = invokeSrcById.get(
      (event as unknown as { actorId?: string }).actorId!
    );
    const declared = src === undefined ? undefined : sampledOutcomes.get(src);
    const matching = declared?.filter((outcome) => outcome.ok === ok) ?? [];
    const outcomes: readonly TestActorOutcome[] = matching.length
      ? matching
      : [
          ok
            ? { ok: true, output: undefined }
            : { ok: false, error: new Error('generated failure') }
        ];
    return outcomes.map((outcome) => {
      // `sessionId` identifies one incarnation of the invoked actor, which the
      // pure graph invents per traversal and the run invents again. Leaving it
      // out makes the event match whichever incarnation is live.
      const { sessionId: _sessionId, ...rest } = event as AnyEventObject & {
        sessionId?: string;
      };
      const offered = {
        ...rest,
        ...(outcome.ok ? { output: outcome.output } : { error: outcome.error })
      } as unknown as TEvent;
      if (src !== undefined) {
        outcomeByEvent.set(offered as unknown as object, { src, outcome });
      }
      return offered;
    });
  };

  const traversalEvents = (snapshot: TSnapshot): readonly TEvent[] => {
    // A machine's own events exclude anything only a wildcard (`'*'`) handler
    // accepts, so the declared types are unioned in rather than replaced.
    const types = new Set<string>(expander.declaredTypes);
    const internal: TEvent[] = [];
    if (typeof (snapshot as { nodes?: unknown }).nodes === 'object') {
      for (const stateNode of (
        snapshot as unknown as {
          nodes: readonly { invoke?: readonly { id: string; src: string }[] }[];
        }
      ).nodes) {
        for (const invokeDef of stateNode.invoke ?? []) {
          invokeSrcById.set(invokeDef.id, invokeDef.src);
        }
      }
      for (const event of getAllOwnEvents(snapshot as never)) {
        const { type } = event as AnyEventObject;
        if (!isInternalEventType(type)) {
          types.add(type);
        } else if (TRAVERSED_INTERNAL_EVENTS.has(type)) {
          // Internal events carry the fields the transition matches on
          // (`actorId`, `delay`, `stateId`), so they are offered whole rather
          // than as a bare `{ type }` template.
          internal.push(...expandInternalEvent(event as AnyEventObject));
        }
      }
    }
    const templates: TEvent[] = [...types].map(
      (type) => ({ type }) as unknown as TEvent
    );
    return [
      ...templates.flatMap((template) => expander.expand(snapshot, template)),
      ...internal
    ];
  };

  const traversalOptions: TraversalOptions<TSnapshot, TEvent, unknown> = {
    events: traversalEvents,
    input: options.input,
    ...(options.limit === undefined ? {} : { limit: options.limit }),
    ...(options.toState === undefined ? {} : { toState: options.toState }),
    ...(options.fromState === undefined
      ? {}
      : { fromState: options.fromState }),
    ...(options.stopWhen === undefined ? {} : { stopWhen: options.stopWhen }),
    ...(options.serializeState === undefined
      ? {}
      : { serializeState: options.serializeState }),
    ...(options.serializeEvent === undefined
      ? {}
      : { serializeEvent: options.serializeEvent })
  };

  let pathGeneratorKind: TestPathGeneratorKind = 'shortest';
  let paths: readonly StatePath<TSnapshot, TEvent>[];
  if (options.paths) {
    pathGeneratorKind = 'custom';
    paths = options.paths;
  } else if (options.fromEvents) {
    pathGeneratorKind = 'events';
    // The literal sequence is the event list; the expander must not replace it.
    const { events: _traversalEvents, ...fromEventsOptions } = traversalOptions;
    paths = getPathsFromEvents(
      testLogic,
      options.fromEvents as TEvent[],
      fromEventsOptions as never
    );
  } else {
    let generated: readonly StatePath<TSnapshot, TEvent>[];
    if (typeof options.pathGenerator === 'function') {
      pathGeneratorKind = 'custom';
      generated = options.pathGenerator(testLogic, traversalOptions as never);
    } else {
      pathGeneratorKind = options.pathGenerator ?? 'shortest';
      generated =
        pathGeneratorKind === 'simple'
          ? getSimplePaths(testLogic, traversalOptions)
          : getShortestPaths(testLogic, traversalOptions);
    }
    paths = options.allowDuplicatePaths
      ? generated
      : deduplicatePaths(generated as StatePath<TSnapshot, TEvent>[]);
  }

  // Coverage declares its event-case universe from `events`; paths may also
  // exercise the machine's own events, which have no declared case.
  const declaredTypes = new Set(cases.map((eventCase) => eventCase.type));
  const extraEvents: Record<string, unknown> = {};
  /** Invoke sources a path resolves, so executed mode can stub them. */
  const stubbedSources = new Set<string>();
  for (const path of paths) {
    for (const step of path.steps) {
      const { type } = step.event;
      if (
        type === XSTATE_INIT ||
        declaredTypes.has(type) ||
        caseIds.has(step.event as unknown as object)
      ) {
        continue;
      }
      if (isInternalEventType(type)) {
        const resolved = outcomeByEvent.get(step.event as unknown as object);
        if (resolved) {
          stubbedSources.add(resolved.src);
        }
        if (mode === 'executed') {
          // Driven as an `outcome` or `advance` command, not sent as an event.
          continue;
        }
      }
      extraEvents[type] = { generate: undefined };
    }
  }

  const results: TestPathRunResult<TSnapshot, TEvent>[] = [];
  const adapter = createPathAdapter(paths, caseIds, results, {
    mode,
    outcomeByEvent,
    delayByEvent,
    resolveDelay: (delayRef) => resolveTestDelay(testLogic, delayRef)
  });
  const {
    paths: _paths,
    pathGenerator: _pathGenerator,
    fromEvents: _fromEvents,
    limit: _limit,
    toState: _toState,
    fromState: _fromState,
    stopWhen: _stopWhen,
    samples: _samples,
    seed: _seed,
    serializeState: _serializeState,
    serializeEvent: _serializeEvent,
    allowDuplicatePaths: _allowDuplicatePaths,
    events: configuredEvents,
    outcomes: configuredOutcomes,
    ...shared
  } = options;

  // `outcomes` only reaches `propertyTest()` to install the stubs the
  // `outcome` commands resolve, which is an executed-mode concern; the
  // sampled values themselves are already baked into the path steps.
  const stubs: Record<string, unknown> = {};
  if (mode === 'executed') {
    for (const src of stubbedSources) {
      stubs[src] = { generate: undefined };
    }
    Object.assign(stubs, configuredOutcomes ?? {});
  }

  try {
    const { coverage } = await propertyTest(
      source as never,
      {
        ...(shared as object),
        adapter,
        ...(Object.keys(stubs).length ? { outcomes: stubs } : {}),
        events: { ...(configuredEvents ?? {}), ...extraEvents }
      } as never
    );
    return {
      coverage: withPathExploration(coverage, paths.length, pathGeneratorKind),
      results
    };
  } catch (error) {
    if (error instanceof ModelTestFailure && error.coverage) {
      throw new ModelTestFailure(
        error.summary,
        error.trace,
        error.cause,
        error.replay,
        error.fixture,
        withPathExploration(error.coverage, paths.length, pathGeneratorKind)
      );
    }
    throw error;
  }
}

/**
 * Adapts the pre-2.0 `{ events, states }` shape to the unified `sut` option.
 *
 * ```ts
 * await testPaths(machine, { sut: fromTestParam({ events, states }) });
 * ```
 *
 * @deprecated Write the `sut` directly.
 */
export function fromTestParam<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(params: TestParam<TSnapshot, TEvent>): TestSut<TSnapshot, TEvent> {
  return {
    create: (context) => {
      // `Step.state` was the snapshot the event was sent *from*, so the shim
      // keeps the previous snapshot rather than passing the resulting one.
      let previous =
        (context.snapshot as TSnapshot | undefined) ??
        (context.logic.getInitialSnapshot(
          createMockActorScope(),
          context.input
        ) as TSnapshot);
      return {
        send: async (event, sendContext) => {
          const executor = (
            params.events as
              | Record<string, ((step: unknown) => unknown) | undefined>
              | undefined
          )?.[event.type];
          const state = previous;
          previous = sendContext.snapshot;
          await executor?.({ event, state });
        },
        states: params.states as TestStateAssertions<TSnapshot, TEvent>
      };
    }
  };
}
