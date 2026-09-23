/**
 * `@xstate/test/vitest` — registers model tests with Vitest.
 *
 * Vitest is imported for its types only. `it` and `test` delegate to Vitest's
 * globals (`test.globals: true`); without globals, wrap Vitest's own `it` with
 * `withModelTests()`.
 */
import type { TestAPI } from 'vitest';
import type { ActorLogic } from 'xstate';
import {
  formatTestCoverage,
  testCoverageToJSON,
  type TestCoverage,
  type TestModel
} from 'xstate/graph';
import type { FailuresOption } from './failures.ts';
import { propertyTest, testPaths } from './propertyTest.ts';

type Source = ActorLogic<any, any, any> | TestModel<any, any, any>;

/** The parts of Vitest's test context the model tests read. */
interface ModelTestContext {
  readonly task: {
    readonly name: string;
    readonly meta: object;
    readonly file?: { readonly name: string };
    readonly suite?: ModelTestSuite;
  };
}

interface ModelTestSuite {
  readonly name: string;
  readonly suite?: ModelTestSuite;
}

/** A Vitest-compatible `it` or `test`: `(name, fn, timeout?) => void`. */
export type ModelTestBase = (
  name: string,
  fn: (context: any) => Promise<void>,
  timeout?: number
) => unknown;

/** What an expected failure must look like. See `it.model.fails`. */
export interface ModelTestFailureExpectation {
  /** A substring of, or a pattern matching, the failure message. */
  readonly message?: string | RegExp;
}

export interface ModelTestFunction {
  /**
   * Registers a test that runs `propertyTest(source, options)`. Failures are
   * saved under the test file and name, and replayed first on the next run.
   * On failure, the coverage report is printed.
   */
  <TSource extends Source>(
    name: string,
    source: TSource,
    options: Parameters<typeof propertyTest<TSource>>[1],
    timeout?: number
  ): void;
  /**
   * Registers a test that passes only when `propertyTest(source, options)`
   * fails, and its message matches `expected.message`.
   */
  fails<TSource extends Source>(
    name: string,
    source: TSource,
    options: Parameters<typeof propertyTest<TSource>>[1],
    expected?: ModelTestFailureExpectation
  ): void;
}

export interface PathsTestFunction {
  /** Registers a test that runs `testPaths(source, options)`. */
  <TSource extends Source>(
    name: string,
    source: TSource,
    options?: Parameters<typeof testPaths<TSource>>[1],
    timeout?: number
  ): void;
}

/** The members `withModelTests()` adds to `it` or `test`. */
export interface ModelTestAPI {
  readonly model: ModelTestFunction;
  readonly paths: PathsTestFunction;
}

function getTestKey(context: ModelTestContext): string {
  const names = [context.task.name];
  for (let suite = context.task.suite; suite; suite = suite.suite) {
    if (suite.name) {
      names.unshift(suite.name);
    }
  }
  return [context.task.file?.name, ...names].filter(Boolean).join(' > ');
}

/**
 * Keys the failure database by the test, unless `failures` is `false`, a
 * custom store, or sets its own `key`.
 */
function withTestFailures<T extends { readonly failures?: FailuresOption }>(
  options: T,
  context: ModelTestContext
): T {
  const failures = options.failures;
  if (failures === false) {
    return options;
  }
  if (
    failures &&
    typeof failures === 'object' &&
    ('load' in failures || failures.key !== undefined)
  ) {
    return options;
  }
  return {
    ...options,
    failures: {
      ...(typeof failures === 'object' ? failures : {}),
      key: getTestKey(context)
    }
  };
}

/** The test timeout for a campaign bounded by `until: { timeMs }`. */
function getTimeout(options: unknown, timeout: number | undefined) {
  if (timeout !== undefined) {
    return timeout;
  }
  const until = (options as { until?: { timeMs?: unknown } } | undefined)
    ?.until;
  return typeof until === 'object' && typeof until.timeMs === 'number'
    ? until.timeMs + 5_000
    : undefined;
}

function getCoverage(error: unknown): TestCoverage | undefined {
  return (error as { coverage?: TestCoverage } | undefined)?.coverage;
}

function attachCoverage(
  context: ModelTestContext,
  coverage: TestCoverage | undefined
) {
  if (coverage) {
    (context.task.meta as Record<string, unknown>).xstateTestCoverage =
      testCoverageToJSON(coverage);
  }
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function matchesExpectation(
  error: unknown,
  expected: ModelTestFailureExpectation | undefined
): boolean {
  const pattern = expected?.message;
  if (pattern === undefined) {
    return true;
  }
  const message = getMessage(error);
  return typeof pattern === 'string'
    ? message.includes(pattern)
    : pattern.test(message);
}

/**
 * Adds `model` and `paths` to a Vitest `it` or `test`:
 *
 * ```ts
 * import { it as vitestIt } from 'vitest';
 * import { withModelTests } from '@xstate/test/vitest';
 *
 * const it = withModelTests(vitestIt);
 * it.model('the cart matches the model', cartMachine, { sut });
 * ```
 */
export function withModelTests<TBase extends ModelTestBase>(
  base: TBase
): TBase & ModelTestAPI {
  return withModelAPI(() => base);
}

/**
 * A callable that forwards everything to the base `it`, plus `model` and
 * `paths`. The base is not modified.
 */
function withModelAPI<TBase extends ModelTestBase>(
  resolve: () => TBase
): TBase & ModelTestAPI {
  const api = createModelTestAPI(resolve);
  return new Proxy(function () {} as unknown as TBase & ModelTestAPI, {
    apply: (_target, thisArg, args) => Reflect.apply(resolve(), thisArg, args),
    get: (_target, property) =>
      property === 'model' || property === 'paths'
        ? api[property]
        : Reflect.get(resolve(), property)
  });
}

function createModelTestAPI(getBase: () => ModelTestBase): ModelTestAPI {
  const run = async (
    context: ModelTestContext,
    campaign: () => Promise<{ coverage: TestCoverage }>
  ) => {
    try {
      const { coverage } = await campaign();
      attachCoverage(context, coverage);
    } catch (error) {
      const coverage = getCoverage(error);
      attachCoverage(context, coverage);
      if (coverage) {
        console.log(formatTestCoverage(coverage));
      }
      throw error;
    }
  };
  const model = ((name, source, options, timeout) => {
    getBase()(
      name,
      (context: ModelTestContext) =>
        run(context, () =>
          propertyTest(source, withTestFailures(options, context))
        ),
      getTimeout(options, timeout)
    );
  }) as ModelTestFunction;
  (model as { fails: ModelTestFunction['fails'] }).fails = (
    name,
    source,
    options,
    expected
  ) => {
    getBase()(
      name,
      async (context: ModelTestContext) => {
        let failure: unknown;
        try {
          const { coverage } = await propertyTest(
            source,
            withTestFailures(options, context)
          );
          attachCoverage(context, coverage);
        } catch (error) {
          failure = error;
          attachCoverage(context, getCoverage(error));
        }
        if (failure === undefined) {
          throw new Error(
            `Expected "${name}" to fail, but the campaign passed.`
          );
        }
        if (!matchesExpectation(failure, expected)) {
          throw new Error(
            `Expected "${name}" to fail with a message matching ${String(
              expected!.message
            )}, but it failed with:\n${getMessage(failure)}`,
            { cause: failure }
          );
        }
      },
      getTimeout(options, undefined)
    );
  };
  const paths: PathsTestFunction = (name, source, options, timeout) => {
    getBase()(
      name,
      (context: ModelTestContext) =>
        run(context, () =>
          testPaths(source, withTestFailures(options ?? {}, context) as never)
        ),
      getTimeout(options, timeout)
    );
  };
  return { model, paths };
}

/** A global `it` or `test`, resolved when it is first used. */
function fromGlobal(name: 'it' | 'test'): TestAPI & ModelTestAPI {
  return withModelAPI((): TestAPI => {
    const base = (globalThis as Record<string, unknown>)[name];
    if (typeof base !== 'function') {
      throw new Error(
        `\`${name}\` from @xstate/test/vitest uses Vitest's global \`${name}\`, which is not defined. Set \`test.globals: true\` in the Vitest config, or wrap Vitest's own: \`withModelTests(${name})\`.`
      );
    }
    return base as TestAPI;
  });
}

/** Vitest's global `it`, with `it.model` and `it.paths`. */
export const it: TestAPI & ModelTestAPI = fromGlobal('it');
/** Vitest's global `test`, with `test.model` and `test.paths`. */
export const test: TestAPI & ModelTestAPI = fromGlobal('test');
