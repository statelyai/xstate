/**
 * `@xstate/test` — model-based and property-based testing for XState, built on
 * fast-check.
 *
 * `import { ... } from '@xstate/test'` is the only import a test file needs.
 *
 * `propertyTest()`, `generateTestSuite()` and `testPaths()` are the
 * fast-check-backed entry points: they build the adapter themselves and take
 * fast-check's options at the top level. Pass `adapter` to use another
 * generator.
 */
export {
  ModelTestFailure,
  PropertyScenarioRunner,
  ReplayNotReproducedError,
  TestCampaignError,
  assertTestCoverage,
  checkLinearizable,
  describeTestSuite,
  formatTestCoverage,
  formatTestCoverageHTML,
  formatTestCoverageJUnit,
  formatTestStatistics,
  parseTestSuite,
  replayTest,
  replayTestSuite,
  replayTestSuiteFixture,
  runParallelPropertyCommands,
  serializeTestSuite,
  serializeTestTrace,
  testCoverageToJSON,
  type AnyTestEventDescriptor,
  type DescribeTestSuiteOptions,
  type FormatTestCoverageHTMLOptions,
  type FormatTestCoverageJUnitOptions,
  type FormatTestCoverageOptions,
  type LinearizabilityEntry,
  type LinearizabilityModel,
  type LinearizabilityOptions,
  type LinearizabilityResult,
  type ParallelPropertyCommandsOptions,
  type ParallelPropertyCommandsResult,
  type PropertyExecutionConfig,
  type PropertyTargetObservation,
  type ReplayTestSuiteOptions,
  type TestActorOutcome,
  type TestAdapter,
  type TestCommand,
  type TestCoverage,
  type TestCoverageDimension,
  type TestCoverageJSON,
  type TestCoverageThresholds,
  type TestEventDescriptor,
  type TestEventGenerators,
  type TestExplorationBounds,
  type TestFailureExtras,
  type TestFailureFormatOptions,
  type TestFailureStore,
  type TestFixture,
  type TestInvariant,
  type TestInvariantContext,
  type TestMode,
  type TestPathRunResult,
  type TestPathsResult,
  type TestPickDescriptor,
  type TestReference,
  type TestReferenceSession,
  type TestReplayMetadata,
  type TestStateAssertion,
  type TestStateAssertions,
  type TestStep,
  type TestStopCondition,
  type TestSuite,
  type TestSuiteReplayResult,
  type TestSut,
  type TestSutContext,
  type TestSutSendContext,
  type TestSutSession,
  type TestTemporal,
  type TestTrace
} from './engine/index.ts';

export {
  generateTestSuite,
  propertyTest,
  testPaths,
  type FastCheckGenerateTestSuiteOptions,
  type FastCheckPropertyTestOptions,
  type FastCheckTestPathsOptions
} from './propertyTest.ts';
export {
  extractReplayPath,
  fastCheckAdapter,
  type FastCheckAdapterOptions,
  type FastCheckGeneratorKind,
  type FastCheckSchedulerOptions,
  type FastCheckSchedulerReport
} from './adapter.ts';
export { pick } from './pick.ts';
export {
  createFailureDatabase,
  type FailureDatabaseOptions,
  type FailuresOption
} from './failures.ts';
export {
  getCurrentScheduler,
  withScheduledReference,
  withScheduledSut
} from './scheduler.ts';
export {
  arbitraryFromSchema,
  eventsFromSchemas,
  mergeEventGenerators
} from './schema.ts';
export type { EventsFromSchemasOptions, SchemaConverter } from './schema.ts';
