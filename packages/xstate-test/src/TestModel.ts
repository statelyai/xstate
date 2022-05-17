import {
  getPathFromEvents,
  performDepthFirstTraversal,
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePath,
  StatePlan,
  Step,
  TraversalOptions,
  traverseShortestPlans,
  traverseSimplePathsTo,
  traverseSimplePlans
} from '@xstate/graph';
import { EventObject, SingleOrArray } from 'xstate';
import {
  CoverageFunction,
  coversAllStates,
  coversAllTransitions
} from './coverage';
import { planGeneratorWithDedup } from './dedupPathPlans';
import type {
  CriterionResult,
  GetPlansOptions,
  PlanGenerator,
  StatePredicate,
  TestModelCoverage,
  TestModelOptions,
  TestPathResult,
  TestStepResult
} from './types';
import { flatten, formatPathTestResult, simpleStringify } from './utils';

export interface TestModelDefaults<TState, TEvent extends EventObject> {
  coverage: Array<CoverageFunction<TState, TEvent>>;
  planGenerator: PlanGenerator<TState, TEvent>;
}

export const testModelDefaults: TestModelDefaults<any, any> = {
  coverage: [coversAllStates<any, any>(), coversAllTransitions<any, any>()],
  planGenerator: traverseShortestPlans
};

/**
 * Creates a test model that represents an abstract model of a
 * system under test (SUT).
 *
 * The test model is used to generate test plans, which are used to
 * verify that states in the `machine` are reachable in the SUT.
 *
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
      testTransition: () => void 0,
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

  public getPlans(
    options?: GetPlansOptions<TState, TEvent>
  ): Array<StatePlan<TState, TEvent>> {
    const planGenerator = planGeneratorWithDedup<TState, TEvent>(
      options?.planGenerator || TestModel.defaults.planGenerator
    );
    const plans = planGenerator(this.behavior, this.resolveOptions(options));

    return plans;
  }

  public getShortestPlans(
    options?: Partial<TraversalOptions<TState, TEvent>>
  ): Array<StatePlan<TState, TEvent>> {
    return this.getPlans({ ...options, planGenerator: traverseShortestPlans });
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
    return this.getPlans({
      ...options,
      planGenerator: traverseSimplePlans
    });
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
    plans: StatePlan<TState, TEvent>[],
    options?: TraversalOptions<TState, TEvent>
  ): Promise<void>;
  public async testPlans(
    options?: TraversalOptions<TState, TEvent>
  ): Promise<void>;

  public async testPlans(...args: any[]) {
    const [plans, options]: [
      StatePlan<TState, TEvent>[],
      TraversalOptions<TState, TEvent>
    ] =
      args[0] instanceof Array
        ? [args[0], args[1]]
        : [this.getPlans(args[0]), args[0]];

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

    const stateTestKeys = Object.keys(resolvedOptions.states).filter(
      (stateKey) => {
        return resolvedOptions.stateMatcher(state, stateKey);
      }
    );

    // Fallthrough state tests
    if (!stateTestKeys.length && '*' in resolvedOptions.states) {
      stateTestKeys.push('*');
    }

    for (const stateTestKey of stateTestKeys) {
      await resolvedOptions.states[stateTestKey](state);
    }

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
