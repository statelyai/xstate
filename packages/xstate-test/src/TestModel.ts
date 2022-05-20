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
import { EventObject, SingleOrArray } from 'xstate';
import {
  CoverageFunction,
  coversAllStates,
  coversAllTransitions
} from './coverage';
import { pathGeneratorWithDedup } from './dedupPaths';
import { getShortestPaths, getSimplePaths } from './pathGenerators';
import type {
  CriterionResult,
  EventExecutor,
  GetPathsOptions,
  PathGenerator,
  StatePredicate,
  TestModelCoverage,
  TestModelOptions,
  TestPathResult,
  TestStepResult
} from './types';
import {
  flatten,
  formatPathTestResult,
  mapPlansToPaths,
  simpleStringify
} from './utils';

export interface TestModelDefaults<TState, TEvent extends EventObject> {
  coverage: Array<CoverageFunction<TState, TEvent>>;
  pathGenerator: PathGenerator<TState, TEvent>;
}

export const testModelDefaults: TestModelDefaults<any, any> = {
  coverage: [coversAllStates<any, any>(), coversAllTransitions<any, any>()],
  pathGenerator: getShortestPaths
};

/**
 * Creates a test model that represents an abstract model of a
 * system under test (SUT).
 *
 * The test model is used to generate test plans, which are used to
 * verify that states in the model are reachable in the SUT.
 */
export class TestModel<TState, TEvent extends EventObject> {
  private _coverage: TestModelCoverage<TState, TEvent> = {
    states: {},
    transitions: {}
  };
  public options: TestModelOptions<TState, TEvent>;
  public defaultTraversalOptions?: TraversalOptions<TState, TEvent>;
  public getDefaultOptions(): TestModelOptions<TState, TEvent> {
    return {
      serializeState: (state) => simpleStringify(state) as SerializedState,
      serializeEvent: (event) => simpleStringify(event) as SerializedEvent,
      getEvents: () => [],
      states: {},
      events: {},
      stateMatcher: (_, stateKey) => stateKey === '*',
      getStates: () => [],
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
  ): Array<StatePath<TState, TEvent>> {
    return this.getPaths({ ...options, pathGenerator: getShortestPaths });
  }

  public getPaths(
    options?: Partial<GetPathsOptions<TState, TEvent>>
  ): Array<StatePath<TState, TEvent>> {
    const pathGenerator = pathGeneratorWithDedup<TState, TEvent>(
      options?.pathGenerator || TestModel.defaults.pathGenerator
    );
    const paths = pathGenerator(this.behavior, this.resolveOptions(options));

    return paths;
  }

  public getShortestPathsTo(
    stateValue: StatePredicate<TState>
  ): Array<StatePath<TState, TEvent>> {
    let minWeight = Infinity;
    let shortestPaths: Array<StatePath<TState, TEvent>> = [];

    const paths = this.filterPathsTo(stateValue, this.getShortestPaths());

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
  ): Array<StatePath<TState, TEvent>> {
    return this.getPaths({
      ...options,
      pathGenerator: getSimplePaths
    });
  }

  public getSimplePathsTo(
    predicate: StatePredicate<TState>
  ): Array<StatePath<TState, TEvent>> {
    return mapPlansToPaths(
      traverseSimplePathsTo(this.behavior, predicate, this.options)
    );
  }

  private filterPathsTo(
    statePredicate: StatePredicate<TState>,
    testPaths: Array<StatePath<TState, TEvent>>
  ): Array<StatePath<TState, TEvent>> {
    const predicate: StatePredicate<TState> = (state) => statePredicate(state);

    return testPaths.filter((testPath) => {
      return predicate(testPath.state);
    });
  }

  public getPathFromEvents(
    events: TEvent[],
    statePredicate: StatePredicate<TState>
  ): StatePath<TState, TEvent> {
    const path = getPathFromEvents(this.behavior, events);

    if (!statePredicate(path.state)) {
      throw new Error(
        `The last state ${JSON.stringify(
          (path.state as any).value
        )} does not match the target}`
      );
    }

    return path;
  }

  public getAllStates(): TState[] {
    const adj = performDepthFirstTraversal(this.behavior, this.options);
    return Object.values(adj).map((x) => x.state);
  }

  public testPathSync(
    path: StatePath<TState, TEvent>,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ) {
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
          this.testStateSync(step.state, options);
        } catch (err) {
          testStepResult.state.error = err;

          throw err;
        }

        try {
          this.testTransitionSync(step);
        } catch (err) {
          testStepResult.event.error = err;

          throw err;
        }
      }

      try {
        this.testStateSync(path.state, options);
      } catch (err) {
        testPathResult.state.error = err.message;
        throw err;
      }
    } catch (err) {
      // TODO: make option
      err.message += formatPathTestResult(path, testPathResult, this.options);
      throw err;
    }
  }

  public async testPath(
    path: StatePath<TState, TEvent>,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ) {
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
          await this.testState(step.state, options);
        } catch (err) {
          testStepResult.state.error = err;

          throw err;
        }

        try {
          await this.testTransition(step);
        } catch (err) {
          testStepResult.event.error = err;

          throw err;
        }
      }

      try {
        await this.testState(path.state, options);
      } catch (err) {
        testPathResult.state.error = err.message;
        throw err;
      }
    } catch (err) {
      // TODO: make option
      err.message += formatPathTestResult(path, testPathResult, this.options);
      throw err;
    }
  }

  public async testState(
    state: TState,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): Promise<void> {
    const resolvedOptions = this.resolveOptions(options);

    const stateTestKeys = this.getStateTestKeys(state, resolvedOptions);

    for (const stateTestKey of stateTestKeys) {
      await resolvedOptions.states[stateTestKey](state);
    }

    this.afterTestState(state, resolvedOptions);
  }

  private getStateTestKeys(
    state: TState,
    resolvedOptions: TestModelOptions<TState, TEvent>
  ) {
    const stateTestKeys = Object.keys(resolvedOptions.states).filter(
      (stateKey) => {
        return resolvedOptions.stateMatcher(state, stateKey);
      }
    );

    // Fallthrough state tests
    if (!stateTestKeys.length && '*' in resolvedOptions.states) {
      stateTestKeys.push('*');
    }

    return stateTestKeys;
  }

  private afterTestState(
    state: TState,
    resolvedOptions: TestModelOptions<TState, TEvent>
  ) {
    resolvedOptions.execute(state);

    this.addStateCoverage(state);
  }

  public testStateSync(
    state: TState,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): void {
    const resolvedOptions = this.resolveOptions(options);

    const stateTestKeys = this.getStateTestKeys(state, resolvedOptions);

    for (const stateTestKey of stateTestKeys) {
      errorIfPromise(
        resolvedOptions.states[stateTestKey](state),
        `The test for '${stateTestKey}' returned a promise - did you mean to use the sync method?`
      );
    }

    this.afterTestState(state, resolvedOptions);
  }

  private addStateCoverage(state: TState) {
    const stateSerial = this.options.serializeState(state, null as any); // TODO: fix

    const existingCoverage = this._coverage.states[stateSerial];

    if (existingCoverage) {
      existingCoverage.count++;
    } else {
      this._coverage.states[stateSerial] = {
        state,
        count: 1
      };
    }
  }

  private getEventExec(step: Step<TState, TEvent>) {
    const eventConfig = this.options.events?.[
      (step.event as any).type as TEvent['type']
    ];

    const eventExec =
      typeof eventConfig === 'function' ? eventConfig : eventConfig?.exec;

    return eventExec;
  }

  public async testTransition(step: Step<TState, TEvent>): Promise<void> {
    const eventExec = this.getEventExec(step);
    await (eventExec as EventExecutor<TState, TEvent>)?.(step);

    this.addTransitionCoverage(step);
  }

  public testTransitionSync(step: Step<TState, TEvent>): void {
    const eventExec = this.getEventExec(step);

    errorIfPromise(
      (eventExec as EventExecutor<TState, TEvent>)?.(step),
      `The event '${step.event.type}' returned a promise - did you mean to use the sync method?`
    );

    this.addTransitionCoverage(step);
  }

  private addTransitionCoverage(step: Step<TState, TEvent>) {
    const transitionSerial = `${this.options.serializeState(
      step.state,
      null as any
    )} | ${this.options.serializeEvent(step.event)}`;

    const existingCoverage = this._coverage.transitions[transitionSerial];

    if (existingCoverage) {
      existingCoverage.count++;
    } else {
      this._coverage.transitions[transitionSerial] = {
        step,
        count: 1
      };
    }
  }

  public resolveOptions(
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): TestModelOptions<TState, TEvent> {
    return { ...this.defaultTraversalOptions, ...this.options, ...options };
  }

  public getCoverage(
    criteriaFn: SingleOrArray<CoverageFunction<TState, TEvent>> = TestModel
      .defaults.coverage
  ): Array<CriterionResult<TState, TEvent>> {
    const criteriaFns = criteriaFn
      ? Array.isArray(criteriaFn)
        ? criteriaFn
        : [criteriaFn]
      : [];
    const criteriaResult = flatten(criteriaFns.map((fn) => fn(this)));

    return criteriaResult.map((criterion) => {
      return {
        criterion,
        status: criterion.skip
          ? 'skipped'
          : criterion.predicate(this._coverage)
          ? 'covered'
          : 'uncovered'
      };
    });
  }

  // TODO: consider options
  public testCoverage(
    criteriaFn: SingleOrArray<CoverageFunction<TState, TEvent>> = TestModel
      .defaults.coverage
  ): void {
    const criteriaFns = Array.isArray(criteriaFn) ? criteriaFn : [criteriaFn];
    const criteriaResult = flatten(
      criteriaFns.map((fn) => this.getCoverage(fn))
    );

    const unmetCriteria = criteriaResult.filter(
      (c) => c.status === 'uncovered'
    );

    if (unmetCriteria.length) {
      const criteriaMessage = `Coverage criteria not met:\n${unmetCriteria
        .map((c) => '\t' + c.criterion.description)
        .join('\n')}`;

      throw new Error(criteriaMessage);
    }
  }
}

/**
 * Specifies default configuration for `TestModel` instances for coverage and plan generation options
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
