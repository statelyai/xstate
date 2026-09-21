/**
 * `@xstate/test` — model-based and property-based testing for XState, built on
 * fast-check.
 *
 * The whole property-testing surface is re-exported here, so
 * `import { ... } from '@xstate/test'` is the only import a test file needs.
 *
 * `propertyTest()` and `generateTestSuite()` are the fast-check-backed
 * wrappers: they build the adapter themselves and take fast-check's options at
 * the top level. They shadow the generator-neutral versions of the same name
 * from `xstate/graph`, which stay available from that entry point.
 */
export * from 'xstate/graph';

export {
  generatePropertySuite,
  generateTestSuite,
  propertyTest,
  testPaths,
  type FastCheckGeneratePropertySuiteOptions,
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
