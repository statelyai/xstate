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

export class TestModel<TState, TEvent extends EventObject> {
  private _coverage: TestModelCoverage<TState> = {
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
    options?: Partial<TestModelOptions<TState, TEvent>>
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

  public async testPlans(
    plans: Array<StatePlan<TState, TEvent>>,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ) {
    for (const plan of plans) {
      await this.testPlan(plan, options);
    }
  }

  public async testPlan(
    plan: StatePlan<TState, TEvent>,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ) {
    for (const path of plan.paths) {
      await this.testPath(path, options);
    }
  }

  public async testPath(
    path: StatePath<TState, TEvent>,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ) {
    const resolvedOptions = this.resolveOptions(options);

    await resolvedOptions.beforePath?.();

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
    } finally {
      await resolvedOptions.afterPath?.();
    }
  }

  public async testState(
    state: TState,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): Promise<void> {
    const resolvedOptions = this.resolveOptions(options);

    await resolvedOptions.testState(state);

    await resolvedOptions.execute(state);

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

  public async testTransition(step: Step<TState, TEvent>): Promise<void> {
    await this.options.testTransition(step);

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
    criteriaFn?: (testModel: this) => Array<Criterion<TState>>
  ): Array<CriterionResult<TState>> {
    const criteria = criteriaFn?.(this) ?? [];

    return criteria.map((criterion) => {
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
