import {
  getPathFromEvents,
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePath,
  StatePlan,
  Step,
  TraversalOptions
} from '@xstate/graph';
import {
  performDepthFirstTraversal,
  traverseShortestPaths,
  traverseSimplePaths,
  traverseSimplePathsTo
} from '@xstate/graph/src/graph';
import { EventObject } from 'xstate';
import type {
  TestModelCoverage,
  TestModelOptions,
  StatePredicate,
  TestPathResult,
  TestStepResult,
  Criterion,
  CriterionResult
} from './types';
import { formatPathTestResult, simpleStringify } from './utils';

/**
 * Creates a test model that represents an abstract model of a
 * system under test (SUT).
 *
 * The test model is used to generate test plans, which are used to
 * verify that states in the `machine` are reachable in the SUT.
 *
 * @example
 *
 * ```js
 * const toggleModel = createModel(toggleMachine).withEvents({
 *   TOGGLE: {
 *     exec: async page => {
 *       await page.click('input');
 *     }
 *   }
 * });
 * ```
 *
 */

export class TestModel<TState, TEvent extends EventObject, TTestContext> {
  private _coverage: TestModelCoverage<TState> = {
    states: {},
    transitions: {}
  };
  public options: TestModelOptions<TState, TEvent, TTestContext>;
  public defaultTraversalOptions?: TraversalOptions<TState, TEvent>;
  public getDefaultOptions(): TestModelOptions<TState, TEvent, TTestContext> {
    return {
      serializeState: (state) => simpleStringify(state) as SerializedState,
      serializeEvent: (event) => simpleStringify(event) as SerializedEvent,
      getEvents: () => [],
      events: {},
      getStates: () => [],
      testState: () => void 0,
      testTransition: () => void 0,
      execute: () => void 0,
      logger: {
        log: console.log.bind(console),
        error: console.error.bind(console)
      }
    };
  }

  constructor(
    public behavior: SimpleBehavior<TState, TEvent>,
    options?: Partial<TestModelOptions<TState, TEvent, TTestContext>>
  ) {
    this.options = {
      ...this.getDefaultOptions(),
      ...options
    };
  }

  public getShortestPlans(
    options?: Partial<TraversalOptions<TState, TEvent>>
  ): Array<StatePlan<TState, TEvent>> {
    const shortestPaths = traverseShortestPaths(
      this.behavior,
      this.resolveOptions(options)
    );

    return Object.values(shortestPaths);
  }

  public getShortestPlansTo(
    stateValue: StatePredicate<TState>
  ): Array<StatePlan<TState, TEvent>> {
    let minWeight = Infinity;
    let shortestPlans: Array<StatePlan<TState, TEvent>> = [];

    const plans = this.filterPathsTo(stateValue, this.getShortestPlans());

    for (const plan of plans) {
      const currWeight = plan.paths[0].weight;
      if (currWeight < minWeight) {
        minWeight = currWeight;
        shortestPlans = [plan];
      } else if (currWeight === minWeight) {
        shortestPlans.push(plan);
      }
    }

    return shortestPlans;
  }

  public getSimplePlans(
    options?: Partial<TraversalOptions<TState, any>>
  ): Array<StatePlan<TState, TEvent>> {
    const simplePaths = traverseSimplePaths(
      this.behavior,
      this.resolveOptions(options)
    );

    return Object.values(simplePaths);
  }

  public getSimplePlansTo(
    predicate: StatePredicate<TState>
  ): Array<StatePlan<TState, TEvent>> {
    return traverseSimplePathsTo(this.behavior, predicate, this.options);
  }

  private filterPathsTo(
    statePredicate: StatePredicate<TState>,
    testPlans: Array<StatePlan<TState, TEvent>>
  ): Array<StatePlan<TState, TEvent>> {
    const predicate: StatePredicate<TState> = (state) => statePredicate(state);

    return testPlans.filter((testPlan) => {
      return predicate(testPlan.state);
    });
  }

  public getPlanFromEvents(
    events: TEvent[],
    statePredicate: StatePredicate<TState>
  ): StatePlan<TState, TEvent> {
    const path = getPathFromEvents(this.behavior, events);

    if (!statePredicate(path.state)) {
      throw new Error(
        `The last state ${JSON.stringify(
          (path.state as any).value
        )} does not match the target}`
      );
    }

    const plan: StatePlan<TState, TEvent> = {
      state: path.state,
      paths: [path]
    };

    return plan;
  }

  public getAllStates(): TState[] {
    const adj = performDepthFirstTraversal(this.behavior, this.options);
    return Object.values(adj).map((x) => x.state);
  }

  public async testPlan(
    plan: StatePlan<TState, TEvent>,
    testContext: TTestContext
  ) {
    for (const path of plan.paths) {
      await this.testPath(path, testContext);
    }
  }

  public async testPath(
    path: StatePath<TState, TEvent>,
    testContext: TTestContext
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
          await this.testState(step.state, testContext);
        } catch (err) {
          testStepResult.state.error = err;

          throw err;
        }

        try {
          await this.testTransition(step, testContext);
        } catch (err) {
          testStepResult.event.error = err;

          throw err;
        }
      }

      try {
        await this.testState(path.state, testContext);
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
    testContext: TTestContext
  ): Promise<void> {
    await this.options.testState(state, testContext);

    await this.options.execute(state, testContext);

    this.addStateCoverage(state);
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

  public async testTransition(
    step: Step<TState, TEvent>,
    testContext: TTestContext
  ): Promise<void> {
    await this.options.testTransition(step, testContext);

    this.addTransitionCoverage(step);
  }

  private addTransitionCoverage(_step: Step<TState, TEvent>) {
    // TODO
  }

  public resolveOptions(
    options?: Partial<TestModelOptions<TState, TEvent, TTestContext>>
  ): TestModelOptions<TState, TEvent, TTestContext> {
    return { ...this.defaultTraversalOptions, ...this.options, ...options };
  }

  public getCoverage(
    criteriaFn?: (testModel: this) => Array<Criterion<TState>>
  ): Array<CriterionResult<TState>> {
    const criteria = criteriaFn?.(this) ?? [];
    const stateCoverages = Object.values(this._coverage.states);

    return criteria.map((criterion) => {
      return {
        criterion,
        status: criterion.skip
          ? 'skipped'
          : stateCoverages.some((sc) => criterion.predicate(sc))
          ? 'covered'
          : 'uncovered'
      };
    });
  }

  public testCoverage(
    criteriaFn?: (testModel: this) => Array<Criterion<TState>>
  ): void {
    const criteriaResult = this.getCoverage(criteriaFn);

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
