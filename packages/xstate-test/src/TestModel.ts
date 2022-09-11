import {
  getPathFromEvents,
  performDepthFirstTraversal,
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePath,
  Step,
  TraversalOptions,
  traverseSimplePathsTo
} from '@xstate/graph';
import { joinPaths } from '@xstate/graph';
import { EventObject } from 'xstate';
import { isStateLike } from 'xstate/lib/utils';
import { deduplicatePaths } from './deduplicatePaths';
import { getShortestPaths, getSimplePaths } from './pathGenerators';
import type {
  EventExecutor,
  GetPathsOptions,
  PathGenerator,
  StatePredicate,
  TestModelOptions,
  TestParam,
  TestPath,
  TestPathResult,
  TestStepResult
} from './types';
import {
  formatPathTestResult,
  getDescription,
  mapPlansToPaths,
  simpleStringify
} from './utils';

export interface TestModelDefaults<TState, TEvent extends EventObject> {
  pathGenerator: PathGenerator<TState, TEvent>;
}

export const testModelDefaults: TestModelDefaults<any, any> = {
  pathGenerator: getShortestPaths
};

/**
 * Creates a test model that represents an abstract model of a
 * system under test (SUT).
 *
 * The test model is used to generate test paths, which are used to
 * verify that states in the model are reachable in the SUT.
 */
export class TestModel<TState, TEvent extends EventObject> {
  public options: TestModelOptions<TState, TEvent>;
  public defaultTraversalOptions?: TraversalOptions<TState, TEvent>;
  public getDefaultOptions(): TestModelOptions<TState, TEvent> {
    return {
      serializeState: (state) => simpleStringify(state) as SerializedState,
      serializeEvent: (event) => simpleStringify(event) as SerializedEvent,
      // For non-state-machine test models, we cannot identify
      // separate transitions, so just use event type
      serializeTransition: (state, event) =>
        `${simpleStringify(state)}|${event?.type ?? ''}`,
      getEvents: () => [],
      stateMatcher: (_, stateKey) => stateKey === '*',
      eventCases: {},
      execute: () => void 0,
      logger: {
        log: console.log.bind(console),
        error: console.error.bind(console)
      }
    };
  }
  public static defaults: TestModelDefaults<any, any> = testModelDefaults;

  constructor(
    public behavior: SimpleBehavior<TState, TEvent>,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ) {
    this.options = {
      ...this.getDefaultOptions(),
      ...options
    };
  }

  public getShortestPaths(
    options?: Partial<TraversalOptions<TState, TEvent>>
  ): Array<TestPath<TState, TEvent>> {
    return this.getPaths(getShortestPaths, { ...options });
  }

  private _getStatePaths(
    options?: Partial<GetPathsOptions<TState, TEvent>>
  ): Array<StatePath<TState, TEvent>> {
    const pathGenerator =
      options?.pathGenerator || TestModel.defaults.pathGenerator;
    return pathGenerator(this.behavior, this.resolveOptions(options));
  }

  public getPaths(
    pathGenerator: PathGenerator<TState, TEvent>,
    options?: Partial<TraversalOptions<TState, TEvent>>
  ): Array<TestPath<TState, TEvent>> {
    const paths = pathGenerator(this.behavior, this.resolveOptions(options));
    return deduplicatePaths(paths).map(this.toTestPath);
  }

  public getShortestPathsTo(
    statePredicate: StatePredicate<TState>
  ): Array<TestPath<TState, TEvent>> {
    let minWeight = Infinity;
    let shortestPaths: Array<TestPath<TState, TEvent>> = [];

    const paths = deduplicatePaths(
      this.filterPathsTo(
        statePredicate,
        this._getStatePaths({ pathGenerator: getShortestPaths })
      )
    ).map(this.toTestPath);

    for (const path of paths) {
      const currWeight = path.weight;
      if (currWeight < minWeight) {
        minWeight = currWeight;
        shortestPaths = [path];
      } else if (currWeight === minWeight) {
        shortestPaths.push(path);
      }
    }

    return shortestPaths;
  }

  public getSimplePaths(
    options?: Partial<TraversalOptions<TState, any>>
  ): Array<TestPath<TState, TEvent>> {
    return this.getPaths(getSimplePaths, {
      ...options
    });
  }

  public getSimplePathsTo(
    predicate: StatePredicate<TState>
  ): Array<TestPath<TState, TEvent>> {
    return mapPlansToPaths(
      traverseSimplePathsTo(this.behavior, predicate, this.options)
    ).map(this.toTestPath);
  }

  private filterPathsTo(
    statePredicate: StatePredicate<TState>,
    statePaths: Array<StatePath<TState, TEvent>>
  ): Array<StatePath<TState, TEvent>> {
    return statePaths.filter((statePath) => {
      return statePredicate(statePath.state);
    });
  }

  private toTestPath = (
    statePath: StatePath<TState, TEvent>
  ): TestPath<TState, TEvent> => {
    function formatEvent(event: EventObject): string {
      const { type, ...other } = event;

      const propertyString = Object.keys(other).length
        ? ` (${JSON.stringify(other)})`
        : '';

      return `${type}${propertyString}`;
    }

    const eventsString = statePath.steps
      .map((s) => formatEvent(s.event))
      .join(' → ');
    return {
      ...statePath,
      test: (params: TestParam<TState, TEvent>) =>
        this.testPath(statePath, params),
      testSync: (params: TestParam<TState, TEvent>) =>
        this.testPathSync(statePath, params),
      description: isStateLike(statePath.state)
        ? `Reaches ${getDescription(
            statePath.state as any
          ).trim()}: ${eventsString}`
        : JSON.stringify(statePath.state)
    };
  };

  public getPathFromEvents(
    events: TEvent[],
    statePredicate: StatePredicate<TState>
  ): TestPath<TState, TEvent> {
    const path = getPathFromEvents(this.behavior, events);

    if (!statePredicate(path.state)) {
      throw new Error(
        `The last state ${JSON.stringify(
          (path.state as any).value
        )} does not match the target}`
      );
    }

    return this.toTestPath(path);
  }

  public getAllStates(): TState[] {
    const adj = performDepthFirstTraversal(this.behavior, this.options);
    return Object.values(adj).map((x) => x.state);
  }

  public testPathSync(
    path: StatePath<TState, TEvent>,
    params: TestParam<TState, TEvent>,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): TestPathResult {
    const testPathResult: TestPathResult = {
      steps: [],
      state: {
        error: null
      }
    };

    try {
      for (const step of path.steps) {
        const testStepResult: TestStepResult = {
          step,
          state: { error: null },
          event: { error: null }
        };

        testPathResult.steps.push(testStepResult);

        try {
          this.testStateSync(params, step.state, options);
        } catch (err) {
          testStepResult.state.error = err;

          throw err;
        }

        try {
          this.testTransitionSync(params, step);
        } catch (err) {
          testStepResult.event.error = err;

          throw err;
        }
      }

      try {
        this.testStateSync(params, path.state, options);
      } catch (err) {
        testPathResult.state.error = err.message;
        throw err;
      }
    } catch (err) {
      // TODO: make option
      err.message += formatPathTestResult(path, testPathResult, this.options);
      throw err;
    }

    return testPathResult;
  }

  public async testPath(
    path: StatePath<TState, TEvent>,
    params: TestParam<TState, TEvent>,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): Promise<TestPathResult> {
    const testPathResult: TestPathResult = {
      steps: [],
      state: {
        error: null
      }
    };

    try {
      for (const step of path.steps) {
        const testStepResult: TestStepResult = {
          step,
          state: { error: null },
          event: { error: null }
        };

        testPathResult.steps.push(testStepResult);

        try {
          await this.testState(params, step.state, options);
        } catch (err) {
          testStepResult.state.error = err;

          throw err;
        }

        try {
          await this.testTransition(params, step);
        } catch (err) {
          testStepResult.event.error = err;

          throw err;
        }
      }

      try {
        await this.testState(params, path.state, options);
      } catch (err) {
        testPathResult.state.error = err.message;
        throw err;
      }
    } catch (err) {
      // TODO: make option
      err.message += formatPathTestResult(path, testPathResult, this.options);
      throw err;
    }

    return testPathResult;
  }

  public async testState(
    params: TestParam<TState, TEvent>,
    state: TState,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): Promise<void> {
    const resolvedOptions = this.resolveOptions(options);

    const stateTestKeys = this.getStateTestKeys(params, state, resolvedOptions);

    for (const stateTestKey of stateTestKeys) {
      await params.states?.[stateTestKey](state);
    }

    this.afterTestState(state, resolvedOptions);
  }

  private getStateTestKeys(
    params: TestParam<TState, TEvent>,
    state: TState,
    resolvedOptions: TestModelOptions<TState, TEvent>
  ) {
    const states = params.states || {};
    const stateTestKeys = Object.keys(states).filter((stateKey) => {
      return resolvedOptions.stateMatcher(state, stateKey);
    });

    // Fallthrough state tests
    if (!stateTestKeys.length && '*' in states) {
      stateTestKeys.push('*');
    }

    return stateTestKeys;
  }

  private afterTestState(
    state: TState,
    resolvedOptions: TestModelOptions<TState, TEvent>
  ) {
    resolvedOptions.execute(state);
  }

  public testStateSync(
    params: TestParam<TState, TEvent>,
    state: TState,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): void {
    const resolvedOptions = this.resolveOptions(options);

    const stateTestKeys = this.getStateTestKeys(params, state, resolvedOptions);

    for (const stateTestKey of stateTestKeys) {
      errorIfPromise(
        params.states?.[stateTestKey](state),
        `The test for '${stateTestKey}' returned a promise - did you mean to use the sync method?`
      );
    }

    this.afterTestState(state, resolvedOptions);
  }

  private getEventExec(
    params: TestParam<TState, TEvent>,
    step: Step<TState, TEvent>
  ) {
    const eventExec =
      params.events?.[(step.event as any).type as TEvent['type']];

    return eventExec;
  }

  public async testTransition(
    params: TestParam<TState, TEvent>,
    step: Step<TState, TEvent>
  ): Promise<void> {
    const eventExec = this.getEventExec(params, step);
    await (eventExec as EventExecutor<TState, TEvent>)?.(step);
  }

  public testTransitionSync(
    params: TestParam<TState, TEvent>,
    step: Step<TState, TEvent>
  ): void {
    const eventExec = this.getEventExec(params, step);

    errorIfPromise(
      (eventExec as EventExecutor<TState, TEvent>)?.(step),
      `The event '${step.event.type}' returned a promise - did you mean to use the sync method?`
    );
  }

  public resolveOptions(
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): TestModelOptions<TState, TEvent> {
    return { ...this.defaultTraversalOptions, ...this.options, ...options };
  }

  public getShortestPathsFrom(
    paths: Array<TestPath<TState, TEvent>>,
    options?: Partial<TraversalOptions<TState, any>>
  ): Array<TestPath<TState, TEvent>> {
    const resultPaths: any[] = [];

    for (const path of paths) {
      const shortestPaths = this.getShortestPaths({
        ...options,
        fromState: path.state
      });
      for (const shortestPath of shortestPaths) {
        resultPaths.push(joinPaths(path, shortestPath));
      }
    }

    return resultPaths;
  }
}

/**
 * Specifies default configuration for `TestModel` instances for path generation options
 *
 * @param testModelConfiguration The partial configuration for all subsequent `TestModel` instances
 */
export function configure(
  testModelConfiguration: Partial<
    TestModelDefaults<any, any>
  > = testModelDefaults
): void {
  TestModel.defaults = { ...testModelDefaults, ...testModelConfiguration };
}

const errorIfPromise = (result: unknown, err: string) => {
  if (typeof result === 'object' && result && 'then' in result) {
    throw new Error(err);
  }
};
