import {
  initialTransition,
  isMachineSnapshot,
  isUnhandled,
  transition,
  type ActorLogic,
  type AnyEventObject,
  type EventObject,
  type Snapshot
} from 'xstate';
import { XSTATE_INIT, XSTATE_STOP } from './constants.ts';
import { planCoverPaths, type TestCoverOptions } from './coverPaths.ts';
import { deduplicatePaths } from './deduplicatePaths.ts';
import { planEdgePaths } from './edgePaths.ts';
import {
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
  ModelTestFailureError,
  propertyTest,
  type PropertyScenarioRunner,
  type TestAdapter,
  type TestAdapterRequest,
  type TestAdapterResult,
  type TestActorOutcome,
  type TestFailureStore,
  type TestMode,
  type TestOptions,
  type PropertyGeneratorKind,
  type EventForType,
  defaultFormatSnapshot
} from './propertyTest.ts';
import { createOutcomeStub, provideActors } from './outcomes.ts';
import { createSeededRng, getAllOwnEvents, simpleStringify } from './utils.ts';
import {
  getPathsFromEvents,
  getShortestPaths,
  getSimplePaths,
  serializeSnapshot
} from 'xstate/graph';
import type { PathGenerator, StatePath, TraversalOptions } from 'xstate/graph';

export type { TestCoverOptions, TestCoverStep } from './coverPaths.ts';

/**
 * How `testPaths()` produced the paths it executed.
 *
 * @experimental
 */
type TestPathGeneratorKind =
  | 'shortest'
  | 'simple'
  | 'edges'
  | 'events'
  | 'custom'
  | 'cover';

/**
 * The result of executing one path.
 *
 * @experimental
 */
export interface TestPathRunResult<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly path: StatePath<TSnapshot, TEvent>;
  readonly passed: boolean;
  readonly error?: unknown;
}

type ExactEventPayload<TEvent extends EventObject> = TEvent extends unknown
  ? Omit<TEvent, 'type'>
  : never;

/**
 * Path-generation options. The counterpart of the property-only options.
 *
 * @experimental
 */
interface PathOptions<
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
   * `'shortest'` (the default), `'simple'`, `'edges'`, or a custom
   * {@link PathGenerator}. `'events'` is implied by `fromEvents`.
   */
  readonly pathGenerator?:
    | 'shortest'
    | 'simple'
    | 'edges'
    | PathGenerator<TSnapshot, TEvent, TInput>;
  /** Exact payloads by event type. Return an empty array to omit a type. Implies 'edges'. */
  readonly cases?: {
    readonly [TType in TEvent['type']]?:
      | readonly ExactEventPayload<EventForType<TEvent, TType>>[]
      | ((
          snapshot: TSnapshot
        ) => readonly ExactEventPayload<EventForType<TEvent, TType>>[]);
  };
  /** Probes unhandled events as no-ops where the predicate permits. Implies 'edges'. */
  readonly checkUnhandled?: {
    readonly [TType in TEvent['type']]?:
      | true
      | ((context: {
          snapshot: TSnapshot;
          event: EventForType<TEvent, TType>;
        }) => boolean);
  };
  /** Executes a single path built from this literal event sequence. */
  readonly fromEvents?: readonly TEvent[];
  /** Plans walks that cover every named step pattern before executing them. */
  readonly cover?: TestCoverOptions<TSnapshot, TEvent>;
  /**
   * The most traversal steps path generation takes before it gives up and
   * throws. Defaults to `10_000`. A machine whose context grows without bound
   * reaches it, since every distinct context is a distinct state; merge
   * equivalent states with `serializeState`, or prune with `stopWhen`.
   */
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
 * @experimental
 */
interface SeededGeneratorKind extends PropertyGeneratorKind {
  readonly generator: TestGenerator<this['target']>;
}

/** @experimental */
export type TestPathsOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TKind extends PropertyGeneratorKind = SeededGeneratorKind
> = TestOptions<TSnapshot, TEvent, TInput, TKind> &
  PathOptions<TSnapshot, TEvent, TInput>;

const DEFAULT_SAMPLES = 3;
/** Default traversal bound; see {@link PathOptions.limit}. */
const DEFAULT_TRAVERSAL_LIMIT = 10_000;

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

const BUILTIN_INTERNAL_EVENTS = new Set([
  ...TRAVERSED_INTERNAL_EVENTS,
  XSTATE_INIT,
  XSTATE_STOP,
  DONE_STATE_EVENT,
  'xstate.snapshot.actor',
  'xstate.timeout.actor',
  'xstate.timeout.state',
  'xstate.error.execution',
  'xstate.route'
]);

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

/** How an internal path step is driven, and how a step is checked. */
interface PathRunPlan<TSnapshot extends Snapshot<unknown>> {
  readonly mode: TestMode;
  readonly outcomeByEvent: WeakMap<
    object,
    { readonly src: string; readonly outcome: TestActorOutcome }
  >;
  /** Traversal state identity; a step passes when both sides serialize equal. */
  readonly serialize: (snapshot: TSnapshot) => string;
  /** Renders a snapshot in divergence messages. */
  readonly format: (snapshot: TSnapshot) => string;
}

const LEGACY_EVENT_EXECUTOR_MESSAGE =
  'A pre-2.0 event executor was passed as an event generator. `events` now declares how event *payloads* are generated; the functions that drive the system under test belong in `sut`. Write the `sut` directly.';

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
 * Whether the options have the pre-2.0 `TestParam` shape: `events` and
 * `states` both maps of functions, and no `sut`. The unified API allows that
 * shape too (bare `(rng) => payload` generators plus top-level `states`), so
 * it only decides how a generator that does not produce a payload is
 * reported, never whether the options are rejected up front.
 */
function hasTestParamShape(options: {
  readonly events?: unknown;
  readonly states?: unknown;
  readonly sut?: unknown;
}): boolean {
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
  return (
    options.sut === undefined &&
    isFunctionMap(options.events) &&
    isFunctionMap(options.states)
  );
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
  caseIds: WeakMap<object, string>,
  testParamShaped: boolean
) {
  const drawn = new Map<string, readonly unknown[]>();
  const byType = new Map<string, NormalizedEventCase<TSnapshot, TEvent>[]>();
  for (const eventCase of cases) {
    if (eventCase.generator !== undefined) {
      // Each case draws from its own stream so that adding an event type does
      // not shift the payloads sampled for the cases already declared.
      const rng = createSeededRng(deriveCaseSeed(seed, eventCase.caseId));
      // A pre-2.0 executor has the same shape as a bare generator, so it is
      // only told apart by what it does when called with the PRNG.
      const legacyCandidate =
        testParamShaped &&
        typeof eventCase.generator === 'function' &&
        !eventCase.descriptor.resolve;
      let values: unknown[];
      try {
        values = sampleGenerator(eventCase.generator, rng, samples);
      } catch (cause) {
        if (legacyCandidate) {
          throw new Error(
            `Event "${eventCase.type}" threw when called as a payload generator. ${LEGACY_EVENT_EXECUTOR_MESSAGE}`,
            { cause }
          );
        }
        throw cause;
      }
      if (!eventCase.descriptor.resolve) {
        for (const value of values) {
          if (
            legacyCandidate &&
            typeof (value as { then?: unknown } | undefined)?.then ===
              'function'
          ) {
            // An async executor was started with the PRNG; its rejection is
            // not the error worth reporting.
            (value as PromiseLike<unknown>).then(undefined, () => {});
          }
          if (legacyCandidate && value === undefined) {
            throw new Error(
              `Event "${eventCase.type}" generated \`undefined\` instead of an event payload object. ${LEGACY_EVENT_EXECUTOR_MESSAGE}`
            );
          }
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

function formatEventForPath(event: EventObject): string {
  const { type, ...payload } = event as EventObject & Record<string, unknown>;
  return Object.keys(payload).length
    ? `${type} ${JSON.stringify(payload)}`
    : type;
}

/** A short, human-readable name for a path: its event types, in order. */
function describePath(path: StatePath<any, any>): string {
  const described = (path as { description?: unknown }).description;
  if (typeof described === 'string' && described) {
    return described;
  }
  const events = path.steps
    .map((step) => step.event.type)
    .filter((type) => type !== XSTATE_INIT);
  return events.length ? events.join(' → ') : 'initial state';
}

/**
 * An adapter that executes a fixed list of paths instead of generating
 * command sequences. One path is one run; there is no shrinking.
 *
 * After every step the run's snapshot is compared with the snapshot the
 * traversal planned for that step, so a run that departs from its path fails
 * instead of passing on a different path.
 */
function createPathAdapter<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  paths: readonly StatePath<TSnapshot, TEvent>[],
  caseIds: WeakMap<object, string>,
  results: TestPathRunResult<TSnapshot, TEvent>[],
  plan: PathRunPlan<TSnapshot>
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
          await runner.start('paths');
          for (let index = 0; index < steps.length; index++) {
            const step = steps[index];
            const event = step.event;
            const diverge = (reason: string): never =>
              runner.diverge(`Path diverged at step ${index + 1}: ${reason}`, {
                expected: step.state,
                actual: runner.getSnapshot()
              });
            const describeStatus = () =>
              `the model is ${plan.format(runner.getSnapshot())}`;
            if (plan.mode === 'executed') {
              const resolved = plan.outcomeByEvent.get(
                event as unknown as object
              );
              if (resolved) {
                // The invoke source is stubbed, so the step resolves it with
                // the outcome traversal took this branch for.
                if (!runner.canRunOutcome()) {
                  diverge(
                    `${formatEventForPath(event)} could not be resolved: ${describeStatus()}`
                  );
                }
                await runner.outcome(resolved.src, resolved.outcome);
              } else if (event.type === AFTER_EVENT) {
                // Advance exactly to the timer's due time: earlier timers
                // already fired on earlier steps, and time spent in enclosing
                // states counts towards it.
                await runner.advance(
                  runner.getAfterTimerRemaining(event) ??
                    diverge(
                      `no timer is pending for ${formatEventForPath(event)}: ${describeStatus()}`
                    )
                );
              } else if (event.type === DONE_STATE_EVENT) {
                // Raised by the machine itself once the region reaches its
                // final state; there is nothing to drive.
                continue;
              }
              if (resolved || event.type === AFTER_EVENT) {
                if (
                  plan.serialize(runner.getSnapshot()) !==
                  plan.serialize(step.state)
                ) {
                  diverge(
                    `expected ${plan.format(step.state)}, got ${plan.format(
                      runner.getSnapshot()
                    )}`
                  );
                }
                continue;
              }
            }
            const caseId =
              caseIds.get(event as unknown as object) ??
              getPropertyEventCaseId(event.type, 'default');
            if (!runner.canRun(event, caseId)) {
              diverge(
                `${formatEventForPath(event)} could not be sent: ${describeStatus()}`
              );
            }
            await runner.run(event, caseId);
            if (
              plan.serialize(runner.getSnapshot()) !==
              plan.serialize(step.state)
            ) {
              diverge(
                `expected ${plan.format(step.state)}, got ${plan.format(
                  runner.getSnapshot()
                )}`
              );
            }
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
  // Paths are a fixed plan, not a budget: reaching the longest path is not a
  // truncation, and running every path is why the campaign stopped.
  const truncationReasons = coverage.exploration.truncationReasons.filter(
    (reason) => reason !== 'maximum sequence length reached'
  );
  return {
    ...coverage,
    exploration: {
      ...coverage.exploration,
      strategy: 'paths',
      pathCount,
      pathGenerator,
      stoppedBecause:
        coverage.exploration.stoppedBecause === 'failure' ||
        coverage.exploration.stoppedBecause === 'replay'
          ? coverage.exploration.stoppedBecause
          : 'paths',
      truncated: truncationReasons.length > 0,
      truncationReasons
    }
  };
}

type SnapshotFromSource<T> =
  T extends ActorLogic<infer TSnapshot, any, any> ? TSnapshot : never;
type EventFromSource<T> =
  T extends ActorLogic<any, infer TEvent, any> ? TEvent : never;
type InputFromSource<T> =
  T extends ActorLogic<any, any, infer TInput> ? TInput : never;

/**
 * What `testPaths()` resolves with.
 *
 * @experimental
 */
export interface TestPathsResult<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly coverage: TestCoverage;
  readonly results: readonly TestPathRunResult<TSnapshot, TEvent>[];
}

/**
 * Executes model paths against a system under test.
 *
 * `testPaths()` and `propertyTest()` share their `events`, `sut`, `states`,
 * `invariant`, `temporal`, and `reference` options and produce the same
 * coverage object and the same failure type. They differ only in how the event
 * sequences are produced: traversal of the model's state graph here, generated
 * command sequences there.
 * @experimental
 */
export async function testPaths<TSource extends ActorLogic<any, any, any>>(
  source: TSource,
  options: TestPathsOptions<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>,
    InputFromSource<TSource>
  > = {} as never
): Promise<
  TestPathsResult<SnapshotFromSource<TSource>, EventFromSource<TSource>>
> {
  type TSnapshot = SnapshotFromSource<TSource>;
  type TEvent = EventFromSource<TSource>;

  if ((options as Record<string, unknown>).commands !== undefined) {
    throw new Error(
      '`commands` is not supported by path generation; use `propertyTest()`. Paths decide their own `advance` and `outcome` commands from the internal events the traversal took.'
    );
  }
  const exactCases = options.cases as
    | Readonly<
        Record<
          string,
          readonly object[] | ((snapshot: TSnapshot) => readonly object[])
        >
      >
    | undefined;
  const probes = options.checkUnhandled as
    | Readonly<
        Record<
          string,
          true | ((context: { snapshot: TSnapshot; event: TEvent }) => boolean)
        >
      >
    | undefined;
  const useEdges =
    exactCases !== undefined ||
    probes !== undefined ||
    options.pathGenerator === 'edges';
  if (
    useEdges &&
    (options.cover ||
      options.paths ||
      options.fromEvents ||
      (options.pathGenerator !== undefined &&
        options.pathGenerator !== 'edges'))
  ) {
    throw new Error('Edge traversal requires its own path generation.');
  }
  if (
    options.cover &&
    (options.paths || options.fromEvents || options.pathGenerator)
  ) {
    throw new Error(
      'Use cover on its own, without paths, fromEvents, or pathGenerator.'
    );
  }
  if (options.cover && options.mode === 'executed') {
    throw new Error('The cover prototype supports pure model traversal.');
  }
  const samples = options.samples ?? DEFAULT_SAMPLES;
  if (!Number.isInteger(samples) || samples < 1) {
    throw new Error(
      `\`samples\` must be an integer of at least 1 (received ${String(
        options.samples
      )}).`
    );
  }

  const baseLogic = source as unknown as ActorLogic<TSnapshot, TEvent, unknown>;
  // Sources named in `outcomes` may have no implementation at all; they are
  // stubbed for traversal (and for pure-mode runs), since only the sampled
  // outcomes are ever used in their place.
  const outcomeSources = Object.keys(options.outcomes ?? {});
  const testLogic = outcomeSources.length
    ? provideActors(
        baseLogic,
        Object.fromEntries(
          outcomeSources.map((src) => [src, createOutcomeStub(src)])
        )
      )
    : baseLogic;
  function isInternalEventType(type: string): boolean {
    if (
      useEdges &&
      'isInternalEventType' in testLogic &&
      typeof testLogic.isInternalEventType === 'function'
    ) {
      return (
        BUILTIN_INTERNAL_EVENTS.has(type) || testLogic.isInternalEventType(type)
      );
    }
    return type.startsWith('xstate.');
  }

  const configuredEvents = Object.fromEntries(
    Object.entries(options.events ?? {}).filter(
      ([type]) => !exactCases || !Object.hasOwn(exactCases, type)
    )
  );
  const { cases } = normalizeEventDescriptors<TSnapshot, TEvent>(
    configuredEvents
  );
  const caseIds = new WeakMap<object, string>();
  const expander = createEventExpander<TSnapshot, TEvent>(
    cases,
    samples,
    options.seed ?? 0,
    caseIds,
    hasTestParamShape(options)
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

  /**
   * Virtual time. Timers fire in due order, so a state offers only its
   * earliest-due `after` transition, where "due" counts the time already
   * spent in enclosing states along the path that reached it. Timer objects
   * keep their identity across transitions that do not reschedule them.
   */
  const virtualNow = new WeakMap<object, number>();
  const timerScheduledAt = new WeakMap<object, number>();
  const afterFiresAt = new WeakMap<object, number>();

  /**
   * Turns one synthesized internal event into the concrete events traversal
   * should offer, and remembers what executed mode has to do to reach it.
   */
  const expandInternalEvent = (event: AnyEventObject): TEvent[] => {
    if (event.type === AFTER_EVENT) {
      return [{ ...event } as unknown as TEvent];
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

  /** Keeps only the earliest-due `after` events, recording their due time. */
  const selectDueAfterEvents = (
    snapshot: TSnapshot,
    afterEvents: readonly TEvent[]
  ): TEvent[] => {
    if (!afterEvents.length) {
      return [];
    }
    const now = virtualNow.get(snapshot as object) ?? 0;
    const timers =
      (
        snapshot as {
          timers?: ReadonlyArray<{
            readonly delay?: unknown;
            readonly event?: {
              type?: string;
              delay?: unknown;
              stateId?: unknown;
            };
          }>;
        }
      ).timers ?? [];
    for (const timer of timers) {
      if (!timerScheduledAt.has(timer)) {
        timerScheduledAt.set(timer, now);
      }
    }
    const due = afterEvents.map((event) => {
      const { delay, stateId } = event as unknown as {
        delay: number | string;
        stateId: string;
      };
      const timer = timers.find(
        ({ event: timerEvent }) =>
          timerEvent?.type === 'xstate.after' &&
          timerEvent.delay === delay &&
          timerEvent.stateId === stateId
      );
      const milliseconds =
        typeof timer?.delay === 'number'
          ? timer.delay
          : typeof delay === 'number'
            ? delay
            : Infinity;
      return (timer ? timerScheduledAt.get(timer)! : now) + milliseconds;
    });
    const earliest = Math.min(...due);
    return afterEvents.filter((event, index) => {
      if (due[index] !== earliest) {
        return false;
      }
      afterFiresAt.set(event as unknown as object, earliest);
      return true;
    });
  };

  const declaredEventTypes = [
    ...expander.declaredTypes,
    ...Object.keys(exactCases ?? {}),
    ...Object.keys(probes ?? {})
  ];
  const traversalEvents = (snapshot: TSnapshot): readonly TEvent[] => {
    // A machine's own events exclude anything only a wildcard (`'*'`) handler
    // accepts, so the declared types are unioned in rather than replaced.
    const types = new Set(declaredEventTypes);
    const internal: TEvent[] = [];
    const afterEvents: TEvent[] = [];
    if (typeof (snapshot as { nodes?: unknown }).nodes === 'object') {
      for (const stateNode of (
        snapshot as unknown as {
          nodes: readonly {
            invoke?: readonly { id: string; src: string | undefined }[];
          }[];
        }
      ).nodes) {
        for (const invokeDef of stateNode.invoke ?? []) {
          // Only registered sources have a key to declare outcomes under.
          if (invokeDef.src !== undefined) {
            invokeSrcById.set(invokeDef.id, invokeDef.src);
          }
        }
      }
      for (const event of getAllOwnEvents(snapshot as never)) {
        const { type } = event as AnyEventObject;
        if (!isInternalEventType(type)) {
          if (!useEdges || (type !== '*' && !type.endsWith('.*'))) {
            types.add(type);
          }
        } else if (TRAVERSED_INTERNAL_EVENTS.has(type)) {
          // Internal events carry the fields the transition matches on
          // (`actorId`, `delay`, `stateId`), so they are offered whole rather
          // than as a bare `{ type }` template.
          (type === AFTER_EVENT ? afterEvents : internal).push(
            ...expandInternalEvent(event as AnyEventObject)
          );
        }
      }
    }
    const templates: TEvent[] = [...types].map(
      (type) => ({ type }) as unknown as TEvent
    );
    return [
      ...templates.flatMap((template) => {
        const type = template.type;
        if (!exactCases || !Object.hasOwn(exactCases, type)) {
          return expander.expand(snapshot, template);
        }
        const entry = exactCases[type];
        const payloads = typeof entry === 'function' ? entry(snapshot) : entry;
        if (!Array.isArray(payloads)) {
          throw new Error(`Expected an array of payloads for cases.${type}.`);
        }
        return payloads.map((payload) => {
          if (payload === undefined) {
            throw new Error(`Expected a payload object in cases.${type}.`);
          }
          assertGeneratedPayload(payload, type);
          return { ...payload, type } as TEvent;
        });
      }),
      ...internal,
      ...selectDueAfterEvents(snapshot, afterEvents)
    ];
  };

  const limit = options.limit ?? DEFAULT_TRAVERSAL_LIMIT;
  const identity = (options.serializeState ??
    (isMachineLogic(testLogic) ? serializeSnapshot : simpleStringify)) as (
    snapshot: TSnapshot,
    event: TEvent | undefined,
    previousSnapshot: TSnapshot | undefined
  ) => string;
  // Every state is serialized before its events are expanded, which is
  // where its virtual time is fixed: the time it was reached at.
  const serializeTraversalState = (
    snapshot: TSnapshot,
    event: TEvent | undefined,
    previousSnapshot: TSnapshot | undefined
  ) => {
    if (!virtualNow.has(snapshot as object)) {
      const previousNow = previousSnapshot
        ? (virtualNow.get(previousSnapshot as object) ?? 0)
        : 0;
      virtualNow.set(
        snapshot as object,
        event ? (afterFiresAt.get(event) ?? previousNow) : previousNow
      );
    }
    return identity(snapshot, event, previousSnapshot);
  };
  const traversalOptions: TraversalOptions<TSnapshot, TEvent, unknown> = {
    events: traversalEvents,
    input: options.input,
    limit,
    ...(options.toState === undefined ? {} : { toState: options.toState }),
    ...(options.fromState === undefined
      ? {}
      : { fromState: options.fromState }),
    ...(options.stopWhen === undefined ? {} : { stopWhen: options.stopWhen }),
    serializeState: serializeTraversalState,
    ...(options.serializeEvent === undefined
      ? {}
      : { serializeEvent: options.serializeEvent })
  };

  // A declaration, since preconstruct's parser reads `<T>(` as JSX.
  function generatePaths<T>(generate: () => T): T {
    try {
      return generate();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Traversal limit exceeded'
      ) {
        throw new Error(
          `Path generation exceeded \`limit\` (${limit} traversal steps) before it exhausted the model. A machine whose context grows without bound never runs out of states, because every distinct context is a distinct state. Pass \`serializeState\` to merge equivalent states, prune traversal with \`stopWhen\` or \`toState\`, or raise \`limit\`.`,
          { cause: error }
        );
      }
      throw error;
    }
  }

  let pathGeneratorKind: TestPathGeneratorKind = 'shortest';
  let paths: readonly StatePath<TSnapshot, TEvent>[];
  if (options.cover) {
    pathGeneratorKind = 'cover';
    const initial =
      options.start?.snapshot ??
      options.fromState ??
      initialTransition(testLogic, options.input)[0];
    const names = new Map(
      cases.map(({ caseId, caseName }) => [caseId, caseName])
    );
    paths = planCoverPaths(initial, options.cover, {
      limit,
      events: (snapshot) =>
        traversalEvents(snapshot).filter(
          (event) => !isInternalEventType(event.type)
        ),
      transition: (snapshot, event) =>
        transition(testLogic, snapshot, event)[0],
      caseName: (event) => names.get(caseIds.get(event) ?? '') ?? 'default',
      serializeState: (snapshot) => identity(snapshot, undefined, undefined),
      stopWhen: options.stopWhen,
      toState: options.toState
    });
  } else if (useEdges) {
    pathGeneratorKind = 'edges';
    const initial =
      options.start?.snapshot ??
      options.fromState ??
      initialTransition(testLogic, options.input)[0];
    paths = generatePaths(() =>
      planEdgePaths(initial, {
        limit,
        events: traversalEvents,
        resolveStep: (snapshot, event) => {
          const result = transition(testLogic, snapshot, event);
          if (
            isInternalEventType(event.type) ||
            !isMachineSnapshot(snapshot) ||
            !isUnhandled(snapshot, result)
          ) {
            return { kind: 'edge', state: result[0] };
          }
          const probe =
            probes && Object.hasOwn(probes, event.type)
              ? probes[event.type]
              : undefined;
          if (probe === true || probe?.({ snapshot, event })) {
            return { kind: 'probe', state: snapshot };
          }
        },
        serializeState: serializeTraversalState,
        stopWhen: options.stopWhen,
        toState: options.toState
      })
    );
  } else if (options.paths) {
    pathGeneratorKind = 'custom';
    paths = options.paths;
  } else if (options.fromEvents) {
    pathGeneratorKind = 'events';
    // The literal sequence is the event list; the expander must not replace it.
    const { events: _traversalEvents, ...fromEventsOptions } = traversalOptions;
    paths = generatePaths(() =>
      getPathsFromEvents(
        testLogic,
        options.fromEvents as TEvent[],
        fromEventsOptions as never
      )
    );
  } else {
    let generated: readonly StatePath<TSnapshot, TEvent>[];
    if (typeof options.pathGenerator === 'function') {
      pathGeneratorKind = 'custom';
      const pathGenerator = options.pathGenerator;
      generated = generatePaths(() =>
        pathGenerator(testLogic, traversalOptions as never)
      );
    } else {
      pathGeneratorKind = options.pathGenerator ?? 'shortest';
      generated = generatePaths(() =>
        pathGeneratorKind === 'simple'
          ? getSimplePaths(testLogic, traversalOptions as never)
          : getShortestPaths(testLogic, traversalOptions as never)
      );
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

  const formatSnapshot = (options.formatSnapshot ?? defaultFormatSnapshot) as (
    snapshot: TSnapshot
  ) => unknown;
  const results: TestPathRunResult<TSnapshot, TEvent>[] = [];
  const adapter = createPathAdapter(paths, caseIds, results, {
    mode,
    outcomeByEvent,
    serialize: (snapshot) => identity(snapshot, undefined, undefined),
    format: (snapshot) => {
      try {
        return JSON.stringify(formatSnapshot(snapshot)) ?? String(snapshot);
      } catch {
        return String(snapshot);
      }
    }
  });
  const {
    paths: _paths,
    pathGenerator: _pathGenerator,
    cases: _cases,
    checkUnhandled: _checkUnhandled,
    fromEvents: _fromEvents,
    cover: _cover,
    limit: _limit,
    toState: _toState,
    fromState: _fromState,
    stopWhen: _stopWhen,
    samples: _samples,
    seed: _seed,
    serializeState: _serializeState,
    serializeEvent: _serializeEvent,
    allowDuplicatePaths: _allowDuplicatePaths,
    events: _events,
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
  // Pure-mode runs step the stubbed logic too, so a source named in
  // `outcomes` needs no implementation. Executed mode stubs through
  // `outcomes` instead, which `propertyTest()` provides itself.
  const runSource =
    mode === 'pure' && outcomeSources.length ? testLogic : source;

  const maxPaths = options.cover?.maxPaths;
  const failures =
    shared.failures && maxPaths !== undefined
      ? limitReplaySessions(shared.failures, maxPaths, paths.length)
      : shared.failures;

  try {
    const { coverage } = await propertyTest(
      runSource as never,
      {
        ...shared,
        failures,
        adapter,
        ...((options.cover || useEdges) && options.fromState && !shared.start
          ? {
              start: {
                snapshot: options.fromState,
                serializeSnapshot: (snapshot: TSnapshot) =>
                  testLogic.getPersistedSnapshot(snapshot)
              }
            }
          : {}),
        ...(Object.keys(stubs).length ? { outcomes: stubs } : {}),
        events: { ...(configuredEvents ?? {}), ...extraEvents }
      } as never
    );
    return {
      coverage: withPathExploration(coverage, paths.length, pathGeneratorKind),
      results
    };
  } catch (error) {
    if (error instanceof ModelTestFailureError && error.coverage) {
      const failedIndex = results.length - 1;
      const failedPath = results[failedIndex]?.path;
      const detail = error.summary.replace(/^Property /, '');
      throw new ModelTestFailureError(
        failedPath
          ? `Path ${failedIndex + 1} (${describePath(failedPath)}) failed: ${
              detail.charAt(0).toLowerCase() + detail.slice(1)
            }`
          : error.summary,
        error.trace,
        error.cause,
        error.replay,
        error.fixture,
        withPathExploration(error.coverage, paths.length, pathGeneratorKind),
        error.format,
        error.extras
      );
    }
    throw error;
  }
}

function limitReplaySessions(
  store: TestFailureStore,
  maxPaths: number,
  pathCount: number
): TestFailureStore {
  const planned = store.replay === 'only' ? 0 : pathCount;
  return {
    key: store.key,
    replay: store.replay,
    async load(key) {
      const stored = await store.load(key);
      if (stored.length + planned > maxPaths) {
        const fixtures = stored.length === 1 ? 'fixture' : 'fixtures';
        const walks = planned === 1 ? 'walk' : 'walks';
        throw new Error(
          `cover.maxPaths (${maxPaths}) cannot accommodate ${stored.length} stored ${fixtures} and ${planned} planned ${walks}.`
        );
      }
      return stored;
    },
    onFailure: store.onFailure.bind(store),
    remove: store.remove?.bind(store)
  };
}

/** Whether `logic` is a state machine (duck-typed, as `xstate/graph` does). */
function isMachineLogic(logic: unknown): boolean {
  const machine = logic as Record<string, unknown>;
  return (
    typeof machine.getStateNodeById === 'function' &&
    typeof machine.resolveState === 'function' &&
    typeof machine.getTransitionData === 'function'
  );
}
