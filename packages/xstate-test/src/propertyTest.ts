/**
 * `xstate/graph`'s property-testing entry points with the fast-check adapter
 * already applied.
 *
 * `xstate/graph` is generator-neutral: every entry point there takes an
 * `adapter`. fast-check is the standard generator, so the wrappers here accept
 * its options at the top level and build the adapter themselves. Passing an
 * explicit `adapter` still overrides that.
 */
import * as fc from 'fast-check';
import type {
  ActorLogic,
  AnyStateMachine,
  EventObject,
  InputFrom,
  Snapshot,
  SnapshotFrom
} from 'xstate';
import {
  generateTestSuite as baseGeneratePropertySuite,
  propertyTest as basePropertyTest,
  testPaths as baseTestPaths,
  deriveCaseSeed,
  isEventDescriptorObject,
  type TestPathsOptions,
  type GenerateTestSuiteOptions,
  type TestCoverage,
  type TestEventGenerators,
  type TestSuite,
  type TestAdapter,
  type PropertyTestOptions,
  TestModel
} from 'xstate/graph';
import {
  fastCheckAdapter,
  type FastCheckAdapterOptions,
  type FastCheckGeneratorKind
} from './adapter.ts';
import { eventsFromSchemas, isTypeOnlySchema } from './schema.ts';

/**
 * Every key {@link FastCheckAdapterOptions} accepts. Options are routed by
 * name, so this list is the single place the split between adapter options and
 * `propertyTest()` options is decided.
 */
const ADAPTER_OPTION_KEYS = [
  'asyncReporter',
  'endOnFailure',
  'ignoreEqualValues',
  'includeErrorInReport',
  'interruptAfterTimeLimit',
  'markInterruptAsFailure',
  'maxCommands',
  'maxSkipsPerRun',
  'numRuns',
  'path',
  'plugins',
  'randomType',
  'replayPath',
  'reporter',
  'scheduler',
  'seed',
  'skipAllAfterTimeLimit',
  'skipEqualValues',
  'timeout',
  'unbiased',
  'verbose'
] as const satisfies readonly (keyof FastCheckAdapterOptions)[];

const ADAPTER_OPTION_KEY_SET: ReadonlySet<string> = new Set(
  ADAPTER_OPTION_KEYS
);

/** The schema-derivation option shared by the wrappers. */
interface DeriveEventsOptions {
  /**
   * Derives a generator, via `eventsFromSchemas()`, for every event type the
   * machine declares in `schemas.events` and that `events` does not already
   * configure. Defaults to `true`; machines that declare no `schemas.events`
   * are unaffected either way.
   *
   * Only declared runtime schemas are derived from. An event type the machine
   * handles but declares no schema for is left out rather than generated as
   * `{}`, and a type-only `types<...>()` declaration is skipped because it
   * carries no runtime structure. A runtime schema the converters do not
   * recognize throws, unless `events` already covers that event type.
   */
  readonly deriveEvents?: boolean;
}

/**
 * {@link PropertyTestOptions} with the generator kind fixed to fast-check:
 * `events`, `commands` and `outcomes` take `fc.Arbitrary` values, and every
 * fast-check option is accepted at the top level.
 */
export type FastCheckPropertyTestOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = Omit<
  PropertyTestOptions<TSnapshot, TEvent, TInput, FastCheckGeneratorKind>,
  'adapter' | 'events'
> &
  FastCheckAdapterOptions &
  DeriveEventsOptions & {
    /**
     * Overrides the implicit fast-check adapter. Any generator kind is
     * accepted here, so a non-fast-check adapter can be dropped in; `events`
     * and `commands` are still typed against fast-check, so such an adapter
     * usually wants `propertyTest()` from `xstate/graph` instead.
     */
    readonly adapter?: TestAdapter<any>;
    /**
     * Optional when the machine declares `schemas.events`; the generators are
     * derived from those schemas, and entries here override the derived ones.
     */
    readonly events?: TestEventGenerators<
      TSnapshot,
      TEvent,
      FastCheckGeneratorKind
    >;
  };

export type FastCheckGenerateTestSuiteOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = FastCheckPropertyTestOptions<TSnapshot, TEvent, TInput> &
  Omit<
    GenerateTestSuiteOptions<TSnapshot, TEvent, TInput, FastCheckGeneratorKind>,
    keyof PropertyTestOptions<TSnapshot, TEvent, TInput, FastCheckGeneratorKind>
  >;

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

/**
 * Derives generators for the event types the machine declares a runtime schema
 * for and that `events` does not already cover.
 *
 * Event types configured explicitly, and type-only `types<...>()` declarations,
 * are filtered out before `eventsFromSchemas()` sees them. Anything left that
 * the converters do not recognize still throws, so an unsupported schema
 * library is reported rather than silently ignored.
 */
function deriveMissingEvents(
  source: unknown,
  events: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const logic = (source as { testLogic?: unknown })?.testLogic ?? source;
  const schemas = (logic as AnyStateMachine | undefined)?.schemas?.events as
    | Record<string, unknown>
    | undefined;
  if (!schemas) {
    return undefined;
  }
  const missing = Object.fromEntries(
    Object.entries(schemas).filter(
      // A `types<...>()` declaration carries no runtime structure, so nothing
      // can be derived from it. Implicit derivation leaves those event types
      // to the caller rather than failing the campaign.
      ([type, schema]) => !events?.[type] && !isTypeOnlySchema(schema)
    )
  );
  if (!Object.keys(missing).length) {
    return undefined;
  }
  // Only the declared schemas are derived from: an event type the machine
  // handles but declares no schema for is left out rather than generated as
  // `{}`, so the wrapper never invents events the caller did not describe.
  return eventsFromSchemas(
    { schemas: { events: missing }, events: [] } as unknown as AnyStateMachine,
    { eventsWithoutSchema: 'skip' }
  ) as Record<string, unknown>;
}

function splitOptions(options: Record<string, unknown>): {
  adapterOptions: Record<string, unknown>;
  rest: Record<string, unknown>;
} {
  const adapterOptions: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (ADAPTER_OPTION_KEY_SET.has(key)) {
      adapterOptions[key] = value;
    } else {
      rest[key] = value;
    }
  }
  return { adapterOptions, rest };
}

/**
 * Builds the options `xstate/graph` expects: the implicit adapter, and the
 * schema-derived `events` map that explicit entries are layered onto.
 */
function resolveOptions(source: unknown, options: object): object {
  const { adapterOptions, rest } = splitOptions(
    options as Record<string, unknown>
  );
  const { deriveEvents, adapter, events, ...propertyOptions } = rest as {
    deriveEvents?: boolean;
    adapter?: unknown;
    events?: Record<string, unknown>;
  };
  const derived =
    deriveEvents === false ? undefined : deriveMissingEvents(source, events);
  return {
    ...propertyOptions,
    events: derived ? { ...derived, ...events } : (events ?? {}),
    adapter: adapter ?? fastCheckAdapter(adapterOptions)
  };
}

/**
 * Runs a property-testing campaign with fast-check as the generator.
 *
 * Identical to `propertyTest()` from `xstate/graph`, except that fast-check
 * options (`seed`, `numRuns`, `maxCommands`, `scheduler`, …) are top-level
 * options rather than `fastCheckAdapter()` arguments, and `events` is derived
 * from the machine's `schemas.events` when it declares them.
 */
export async function propertyTest<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
>(
  source: TSource,
  options: FastCheckPropertyTestOptions<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>,
    InputFromSource<TSource>
  >
): Promise<{ coverage: TestCoverage }> {
  return basePropertyTest(
    source as any,
    resolveOptions(source, options) as any
  );
}

/**
 * Records an offline property suite from a passing campaign, with fast-check
 * as the generator. See `generateTestSuite()` in `xstate/graph`.
 */
export async function generateTestSuite<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
>(
  source: TSource,
  options: FastCheckGenerateTestSuiteOptions<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>,
    InputFromSource<TSource>
  >
): Promise<TestSuite> {
  return baseGeneratePropertySuite(
    source as any,
    resolveOptions(source, options) as any
  );
}

/**
 * {@link TestPathsOptions} with the generator kind fixed to fast-check:
 * `events` takes `fc.Arbitrary` values, which are sampled into concrete
 * payloads before traversal.
 */
export type FastCheckTestPathsOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = Omit<TestPathsOptions<TSnapshot, TEvent, TInput>, 'events'> &
  DeriveEventsOptions & {
    readonly events?: TestEventGenerators<
      TSnapshot,
      TEvent,
      FastCheckGeneratorKind
    >;
  };

/** fast-check arbitraries expose a `generate` method; plain generators do not. */
function isArbitrary(value: unknown): value is fc.Arbitrary<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { generate?: unknown }).generate === 'function'
  );
}

/**
 * Replaces every fast-check arbitrary with a plain `(rng) => value` generator
 * backed by `fc.sample`, so `xstate/graph` can expand it without depending on
 * fast-check.
 */
function sampleArbitraries(
  events: Record<string, unknown> | undefined,
  samples: number,
  seed: number
): Record<string, unknown> {
  const sampled = (generator: unknown, caseId: string): unknown => {
    if (!isArbitrary(generator)) {
      return generator;
    }
    // Each case samples from a seed derived from its own id, so declaring a
    // new event type does not change the payloads drawn for the existing ones.
    const values = fc.sample(generator, {
      seed: deriveCaseSeed(seed, caseId),
      numRuns: Math.max(1, samples)
    });
    let index = 0;
    return () => values[index++ % values.length];
  };
  const one = (eventCase: unknown, type: string): unknown => {
    if (!isEventDescriptorObject(eventCase)) {
      return sampled(eventCase, `${type}:default`);
    }
    const descriptor = eventCase as { generate?: unknown; case?: string };
    return {
      ...descriptor,
      generate: sampled(
        descriptor.generate,
        `${type}:${descriptor.case ?? 'default'}`
      )
    };
  };
  return Object.fromEntries(
    Object.entries(events ?? {}).map(([type, configured]) => [
      type,
      Array.isArray(configured)
        ? configured.map((eventCase) => one(eventCase, type))
        : one(configured, type)
    ])
  );
}

/**
 * Executes model paths against a system under test.
 *
 * The same options as `propertyTest()`, minus the generation controls
 * (`numRuns`, `maxCommands`, `swarm`, `frontiers`, …) and plus the traversal
 * controls (`pathGenerator`, `limit`, `toState`, `samples`, `seed`). fast-check
 * arbitraries are accepted in `events` and sampled into `samples` concrete
 * payloads before traversal.
 */
export async function testPaths<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
>(
  source: TSource,
  options: FastCheckTestPathsOptions<
    SnapshotFromSource<TSource>,
    EventFromSource<TSource>,
    InputFromSource<TSource>
  > = {} as never
) {
  const { deriveEvents, events, ...rest } = options as {
    deriveEvents?: boolean;
    events?: Record<string, unknown>;
  } & Record<string, unknown>;
  const derived =
    deriveEvents === false ? undefined : deriveMissingEvents(source, events);
  const merged = derived ? { ...derived, ...events } : (events ?? {});
  return baseTestPaths(
    source as any,
    {
      ...rest,
      events: sampleArbitraries(
        merged,
        (options.samples as number | undefined) ?? 3,
        (options.seed as number | undefined) ?? 0
      )
    } as any
  );
}

/**
 * Pre-2.0 name for {@link generateTestSuite}. Re-exported here (rather than
 * inherited from `xstate/graph`) so it keeps the implicit fast-check adapter;
 * the generator-neutral one requires an explicit `adapter`.
 *
 * @deprecated Use `generateTestSuite()`.
 */
export const generatePropertySuite = generateTestSuite;

/** @deprecated Use {@link FastCheckGenerateTestSuiteOptions}. */
export type FastCheckGeneratePropertySuiteOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = FastCheckGenerateTestSuiteOptions<TSnapshot, TEvent, TInput>;
