/**
 * Pre-2.0 names for the exports that path-based and property-based testing now
 * share. Each is a direct alias of its current name and will be removed in a
 * future major version.
 */
import type { ActorLogic, EventObject, Snapshot } from '../index.ts';
import type { TestModel } from './TestModel.ts';
import type { PropertyGeneratorKind } from './propertyTest.ts';
import type {
  TestActorOutcome,
  TestAdapter,
  TestAdapterRequest,
  TestAdapterResult,
  TestCommand,
  TestEventGenerators,
  TestFixture,
  TestInvariant,
  TestInvariantContext,
  TestMode,
  TestObservation,
  TestOutcomeRecord,
  TestReference,
  TestReferenceSession,
  TestStep,
  TestStopCondition,
  TestSut,
  TestSutContext,
  TestSutSendContext,
  TestSutSession,
  TestTemporal,
  TestTimelineEntry,
  TestTrace
} from './propertyTest.ts';
import type {
  TestCoverage,
  TestCoverageDimension,
  TestCoverageStatus,
  TestDynamicTransitionCoverage,
  TestEventCaseCounts,
  TestExplorationBounds,
  TestExplorationFrontier,
  TestExplorationSeed,
  TestExplorationSwarm,
  TestExplorationTarget,
  TestLabelCoverage,
  TestStoppedBecause
} from './coverage.ts';
import type {
  DescribeTestSuiteOptions,
  GenerateTestSuiteOptions,
  ReplayTestSuiteOptions,
  TestSuite,
  TestSuiteReplayFailure,
  TestSuiteReplayResult
} from './suite.ts';
import type {
  FormatTestCoverageHTMLOptions,
  FormatTestCoverageJUnitOptions,
  FormatTestCoverageOptions,
  TestCoverageDimensionJSON,
  TestCoverageJSON,
  TestCoverageThresholds
} from './report.ts';

export {
  ModelTestFailure as PropertyTestFailure,
  formatTestTrace as formatPropertyTrace,
  replayTest as replayPropertyTest,
  serializeTestTrace as serializePropertyTrace
} from './propertyTest.ts';
export { ReplayNotReproducedError as PropertyReplayNotReproducedError } from './propertyTest.ts';
export {
  assertTestCoverage as assertPropertyCoverage,
  formatTestCoverage as formatPropertyCoverage,
  formatTestCoverageHTML as formatPropertyCoverageHTML,
  formatTestCoverageJUnit as formatPropertyCoverageJUnit,
  formatTestCoverageId as formatPropertyCoverageId,
  testCoverageToJSON as propertyCoverageToJSON
} from './report.ts';
export {
  describeTestSuite as describePropertySuite,
  generateTestSuite as generatePropertySuite,
  formatTestSuiteFixtureTitle as formatPropertySuiteFixtureTitle,
  parseTestSuite as parsePropertySuite,
  replayTestSuite as replayPropertySuite,
  replayTestSuiteFixture as replayPropertySuiteFixture,
  serializeTestSuite as serializePropertySuite
} from './suite.ts';

/** @deprecated Use `TestCoverage`. */
export type PropertyCoverage = TestCoverage;
/** @deprecated Use `TestCoverageDimension`. */
export type PropertyCoverageDimension = TestCoverageDimension;
/** @deprecated Use `TestCoverageStatus`. */
export type PropertyCoverageStatus = TestCoverageStatus;
/** @deprecated Use `TestDynamicTransitionCoverage`. */
export type PropertyDynamicTransitionCoverage = TestDynamicTransitionCoverage;
/** @deprecated Use `TestEventCaseCounts`. */
export type PropertyEventCaseCounts = TestEventCaseCounts;
/** @deprecated Use `TestExplorationBounds`. */
export type PropertyExplorationBounds = TestExplorationBounds;
/** @deprecated Use `TestExplorationFrontier`. */
export type PropertyExplorationFrontier = TestExplorationFrontier;
/** @deprecated Use `TestExplorationSeed`. */
export type PropertyExplorationSeed = TestExplorationSeed;
/** @deprecated Use `TestExplorationSwarm`. */
export type PropertyExplorationSwarm = TestExplorationSwarm;
/** @deprecated Use `TestExplorationTarget`. */
export type PropertyExplorationTarget = TestExplorationTarget;
/** @deprecated Use `TestLabelCoverage`. */
export type PropertyLabelCoverage = TestLabelCoverage;
/** @deprecated Use `TestStoppedBecause`. */
export type PropertyStoppedBecause = TestStoppedBecause;
/** @deprecated Use `TestSuite`. */
export type PropertySuite = TestSuite;
/** @deprecated Use `TestSut`. */
export type PropertySut<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = TestSut<TSnapshot, TEvent>;
/** @deprecated Use `TestSutContext`. */
export type PropertySutContext<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = TestSutContext<TSnapshot, TEvent>;
/** @deprecated Use `TestSutSendContext`. */
export type PropertySutSendContext<TSnapshot = unknown> =
  TestSutSendContext<TSnapshot>;
/** @deprecated Use `TestSutSession`. */
export type PropertySutSession<TEvent extends EventObject> = TestSutSession<
  any,
  TEvent
>;
/** @deprecated Use `TestTrace`. */
export type PropertyTrace<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = TestTrace<TSnapshot, TEvent>;
/** @deprecated Use `TestTimelineEntry`. */
export type PropertyTimelineEntry<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = TestTimelineEntry<TSnapshot, TEvent>;
/** @deprecated Use `TestStep`. */
export type PropertyStep<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = TestStep<TSnapshot, TEvent>;
/** @deprecated Use `TestFixture`. */
export type PortablePropertyReplayFixture = TestFixture;
/** @deprecated Use `TestInvariant`. */
export type PropertyInvariant<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = TestInvariant<TSnapshot, TEvent>;
/** @deprecated Use `TestInvariantContext`. */
export type PropertyInvariantContext<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = TestInvariantContext<TSnapshot, TEvent>;
/** @deprecated Use `TestTemporal`. */
export type PropertyTemporal<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = TestTemporal<TSnapshot, TEvent>;
/** @deprecated Use `TestReference`. */
export type PropertyReferenceOracle<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = TestReference<TSnapshot, TEvent>;
/** @deprecated Use `TestReferenceSession`. */
export type PropertyReferenceSession<TEvent extends EventObject> =
  TestReferenceSession<TEvent>;
/** @deprecated Use `TestMode`. */
export type PropertyTestMode = TestMode;
/** @deprecated Use `TestCommand`. */
export type PropertyCommand<TEvent extends EventObject = any> =
  TestCommand<TEvent>;
/** @deprecated Use `TestActorOutcome`. */
export type PropertyActorOutcome = TestActorOutcome;
/** @deprecated Use `TestOutcomeRecord`. */
export type PropertyOutcomeRecord = TestOutcomeRecord;
/** @deprecated Use `TestObservation`. */
export type PropertyObservation = TestObservation;
/** @deprecated Use `TestAdapter`. */
export type PropertyTestAdapter<
  TKind extends PropertyGeneratorKind = PropertyGeneratorKind
> = TestAdapter<TKind>;
/** @deprecated Use `TestAdapterRequest`. */
export type PropertyTestAdapterRequest<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = TestAdapterRequest<TSnapshot, TEvent>;
/** @deprecated Use `TestAdapterResult`. */
export type PropertyTestAdapterResult = TestAdapterResult;
/** @deprecated Use `TestStopCondition`. */
export type PropertyStopCondition = TestStopCondition;
/** @deprecated Use `TestEventGenerators`. */
export type PropertyEventGenerators<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TKind extends PropertyGeneratorKind
> = TestEventGenerators<TSnapshot, TEvent, TKind>;

/** @deprecated Use `TestCoverageJSON`. */
export type PropertyCoverageJSON = TestCoverageJSON;
/** @deprecated Use `TestCoverageDimensionJSON`. */
export type PropertyCoverageDimensionJSON = TestCoverageDimensionJSON;
/** @deprecated Use `TestCoverageThresholds`. */
export type PropertyCoverageThresholds = TestCoverageThresholds;
/** @deprecated Use `FormatTestCoverageOptions`. */
export type FormatPropertyCoverageOptions = FormatTestCoverageOptions;
/** @deprecated Use `FormatTestCoverageJUnitOptions`. */
export type FormatPropertyCoverageJUnitOptions = FormatTestCoverageJUnitOptions;
/** @deprecated Use `FormatTestCoverageHTMLOptions`. */
export type FormatPropertyCoverageHTMLOptions = FormatTestCoverageHTMLOptions;
/** @deprecated Use `TestSuiteReplayFailure`. */
export type PropertySuiteReplayFailure = TestSuiteReplayFailure;
/** @deprecated Use `TestSuiteReplayResult`. */
export type PropertySuiteReplayResult = TestSuiteReplayResult;
/** @deprecated Use `GenerateTestSuiteOptions`. */
export type GeneratePropertySuiteOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TKind extends PropertyGeneratorKind
> = GenerateTestSuiteOptions<TSnapshot, TEvent, TInput, TKind>;
/** @deprecated Use `ReplayTestSuiteOptions`. */
export type ReplayPropertySuiteOptions<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
> = ReplayTestSuiteOptions<TSource>;
/** @deprecated Use `DescribeTestSuiteOptions`. */
export type DescribePropertySuiteOptions<
  TSource extends ActorLogic<any, any, any> | TestModel<any, any, any>
> = DescribeTestSuiteOptions<TSource>;
