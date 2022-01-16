import {
  getPathFromEvents,
  serializeState,
  SimpleBehavior,
  StatePath,
  StatePlan,
  TraversalOptions
} from '@xstate/graph';
import {
  depthShortestPaths,
  depthSimplePathsTo
} from '@xstate/graph/src/graph';
import {
  StateMachine,
  EventObject,
  State,
  StateValue,
  StateFrom,
  EventFrom
} from 'xstate';
import { isMachine } from 'xstate/src/utils';
import {
  TestModelCoverage,
  TestModelOptions,
  StatePredicate,
  TestMeta,
  CoverageOptions,
  TestEventsConfig
} from './types';

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
  public coverage: TestModelCoverage = {
    stateNodes: new Map(),
    transitions: new Map()
  };
  public options: TestModelOptions<TState, TEvent, TTestContext>;
  public defaultTraversalOptions?: TraversalOptions<TState, TEvent>;
  public getDefaultOptions(): TestModelOptions<TState, TEvent, TTestContext> {
    return {
      serializeState: isMachine(this.behavior)
        ? (serializeState as any)
        : serializeState,
      getEvents: () => [],
      testState: () => void 0,
      execEvent: () => void 0
    };
  }

  constructor(
    public behavior: SimpleBehavior<TState, TEvent>,
    public testContext: TTestContext,
    options?: Partial<TestModelOptions<TState, TEvent, TTestContext>>
  ) {
    this.options = {
      ...this.getDefaultOptions(),
      ...options
    };
  }

  public getShortestPathPlans(
    options?: TraversalOptions<TState, TEvent>
  ): Array<StatePlan<TState, TEvent>> {
    const shortestPaths = depthShortestPaths(
      this.behavior,
      this.resolveOptions(options)
    );

    return Object.values(shortestPaths);
  }

  public getShortestPathPlansTo(
    stateValue: StateValue | StatePredicate<TState>
  ): Array<StatePlan<TState, TEvent>> {
    let minWeight = Infinity;
    let shortestPlans: Array<StatePlan<TState, TEvent>> = [];

    const plans = this.filterPathsTo(stateValue, this.getShortestPathPlans());

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

  private filterPathsTo(
    stateValue: StateValue | StatePredicate<TState>,
    testPlans: Array<StatePlan<TState, TEvent>>
  ): Array<StatePlan<TState, TEvent>> {
    const predicate: StatePredicate<TState> =
      typeof stateValue === 'function'
        ? (state) => stateValue(state)
        : (state) => (state as any).matches(stateValue);

    return testPlans.filter((testPlan) => {
      return predicate(testPlan.state);
    });
  }

  public getPlanFromEvents(
    events: TEvent[],
    assertion: (state: TState) => boolean
  ): StatePlan<TState, TEvent> {
    const path = getPathFromEvents<TState, TEvent>(this.behavior, events);

    if (!assertion(path.state)) {
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

  // public getSimplePathPlans(
  //   options?: Partial<TraversalOptions<TState, any>>
  // ): Array<StatePlan<TState, TEvent>> {
  //   const simplePaths = depthSimplePaths(
  //     this.behavior.transition,
  //     this.behavior.initialState,
  //     {
  //       serializeState,
  //       getEvents: () => getEventSamples(this.options.events),
  //       ...options
  //     }
  //   );

  //   return this.getTestPlans(simplePaths);
  // }

  public getSimplePathPlansTo(
    predicate: (state: TState) => boolean
  ): Array<StatePlan<TState, TEvent>> {
    return depthSimplePathsTo(this.behavior, predicate, this.options);
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
    for (const step of path.steps) {
      await this.testState(step.state, testContext);

      await this.executeEvent(step.event, testContext);
    }

    await this.testState(path.state, testContext);
  }

  // public getTestPlans(
  //   statePathsMap: StatePathsMap<TState, any>
  // ): Array<TestPlan<TTestContext, TState>> {
  //   return Object.keys(statePathsMap).map((key) => {
  //     const testPlan = statePathsMap[key];
  //     const paths = testPlan.paths.map((path) => {
  //       const steps = path.steps.map((step) => {
  //         return {
  //           ...step,
  //           description: getDescription(step.state),
  //           test: (testContext) => this.testState(step.state, testContext),
  //           exec: (testContext) => this.executeEvent(step.event, testContext)
  //         };
  //       });

  //       function formatEvent(event: EventObject): string {
  //         const { type, ...other } = event;

  //         const propertyString = Object.keys(other).length
  //           ? ` (${JSON.stringify(other)})`
  //           : '';

  //         return `${type}${propertyString}`;
  //       }

  //       const eventsString = path.steps
  //         .map((s) => formatEvent(s.event))
  //         .join(' → ');

  //       return {
  //         ...path,
  //         steps,
  //         description: `via ${eventsString}`,
  //         test: async (testContext) => {
  //           const testPathResult: TestPathResult = {
  //             steps: [],
  //             state: {
  //               error: null
  //             }
  //           };

  //           try {
  //             for (const step of steps) {
  //               const testStepResult: TestStepResult = {
  //                 step,
  //                 state: { error: null },
  //                 event: { error: null }
  //               };

  //               testPathResult.steps.push(testStepResult);

  //               try {
  //                 await step.test(testContext);
  //               } catch (err) {
  //                 testStepResult.state.error = err;

  //                 throw err;
  //               }

  //               try {
  //                 await step.exec(testContext);
  //               } catch (err) {
  //                 testStepResult.event.error = err;

  //                 throw err;
  //               }
  //             }

  //             try {
  //               await this.testState(testPlan.state, testContext);
  //             } catch (err) {
  //               testPathResult.state.error = err;
  //               throw err;
  //             }
  //           } catch (err) {
  //             const targetStateString = `${JSON.stringify(path.state.value)} ${
  //               path.state.context === undefined
  //                 ? ''
  //                 : JSON.stringify(path.state.context)
  //             }`;

  //             let hasFailed = false;
  //             err.message +=
  //               '\nPath:\n' +
  //               testPathResult.steps
  //                 .map((s) => {
  //                   const stateString = `${JSON.stringify(
  //                     s.step.state.value
  //                   )} ${
  //                     s.step.state.context === undefined
  //                       ? ''
  //                       : JSON.stringify(s.step.state.context)
  //                   }`;
  //                   const eventString = `${JSON.stringify(s.step.event)}`;

  //                   const stateResult = `\tState: ${
  //                     hasFailed
  //                       ? slimChalk('gray', stateString)
  //                       : s.state.error
  //                       ? ((hasFailed = true),
  //                         slimChalk('redBright', stateString))
  //                       : slimChalk('greenBright', stateString)
  //                   }`;
  //                   const eventResult = `\tEvent: ${
  //                     hasFailed
  //                       ? slimChalk('gray', eventString)
  //                       : s.event.error
  //                       ? ((hasFailed = true), slimChalk('red', eventString))
  //                       : slimChalk('green', eventString)
  //                   }`;

  //                   return [stateResult, eventResult].join('\n');
  //                 })
  //                 .concat(
  //                   `\tState: ${
  //                     hasFailed
  //                       ? slimChalk('gray', targetStateString)
  //                       : testPathResult.state.error
  //                       ? slimChalk('red', targetStateString)
  //                       : slimChalk('green', targetStateString)
  //                   }`
  //                 )
  //                 .join('\n\n');

  //             throw err;
  //           }

  //           return testPathResult;
  //         }
  //       };
  //     });

  //     return {
  //       ...testPlan,
  //       test: async (testContext) => {
  //         for (const path of paths) {
  //           await path.test(testContext);
  //         }
  //       },
  //       description: `reaches ${getDescription(testPlan.state)}`,
  //       paths
  //     } as TestPlan<TTestContext, TState>;
  //   });
  // }

  public async testState(state: TState, testContext: TTestContext) {
    return await this.options.testState(state, testContext);
  }

  public async executeEvent(event: TEvent, testContext: TTestContext) {
    return await this.options.execEvent(event, testContext);
  }

  public getCoverage(options?: CoverageOptions<TState>) {
    return options;
    // const filter = options ? options.filter : undefined;
    // const stateNodes = getStateNodes(this.behavior);
    // const filteredStateNodes = filter ? stateNodes.filter(filter) : stateNodes;
    // const coverage = {
    //   stateNodes: filteredStateNodes.reduce((acc, stateNode) => {
    //     acc[stateNode.id] = 0;
    //     return acc;
    //   }, {})
    // };

    // for (const key of this.coverage.stateNodes.keys()) {
    //   coverage.stateNodes[key] = this.coverage.stateNodes.get(key);
    // }

    // return coverage;
  }

  public testCoverage(options?: CoverageOptions<TState>): void {
    return void options;
    // const coverage = this.getCoverage(options);
    // const missingStateNodes = Object.keys(coverage.stateNodes).filter((id) => {
    //   return !coverage.stateNodes[id];
    // });

    // if (missingStateNodes.length) {
    //   throw new Error(
    //     'Missing coverage for state nodes:\n' +
    //       missingStateNodes.map((id) => `\t${id}`).join('\n')
    //   );
    // }
  }

  public withEvents(
    eventMap: TestEventsConfig<TTestContext>
  ): TestModel<TState, TEvent, TTestContext> {
    return new TestModel(this.behavior, this.testContext, {
      ...this.options,
      getEvents: () => getEventSamples(eventMap),
      execEvent: async (event, testContext) => {
        const eventConfig = eventMap[event.type];

        if (!eventConfig) {
          return;
        }

        const exec =
          typeof eventConfig === 'function' ? eventConfig : eventConfig.exec;

        await exec?.(testContext, event);
      }
    });
  }

  public resolveOptions(
    options?: Partial<TestModelOptions<TState, TEvent, TTestContext>>
  ): TestModelOptions<TState, TEvent, TTestContext> {
    return { ...this.defaultTraversalOptions, ...this.options, ...options };
  }
}

export function getDescription<T, TContext>(
  state: State<TContext, any>
): string {
  const contextString =
    state.context === undefined ? '' : `(${JSON.stringify(state.context)})`;

  const stateStrings = state.configuration
    .filter((sn) => sn.type === 'atomic' || sn.type === 'final')
    .map(({ id }) => {
      const meta = state.meta[id] as TestMeta<T, TContext>;
      if (!meta) {
        return `"#${id}"`;
      }

      const { description } = meta;

      if (typeof description === 'function') {
        return description(state);
      }

      return description ? `"${description}"` : JSON.stringify(state.value);
    });

  return (
    `state${stateStrings.length === 1 ? '' : 's'}: ` +
    stateStrings.join(', ') +
    ` ${contextString}`
  );
}

export function getEventSamples<TEvent extends EventObject>(
  eventsOptions: TestEventsConfig<any>
): TEvent[] {
  const result: TEvent[] = [];

  Object.keys(eventsOptions).forEach((key) => {
    const eventConfig = eventsOptions[key];
    if (typeof eventConfig === 'function') {
      result.push({
        type: key
      } as any);
      return;
    }

    const events = eventConfig.cases
      ? eventConfig.cases.map((sample) => ({
          type: key,
          ...sample
        }))
      : [
          {
            type: key
          }
        ];

    result.push(...(events as any[]));
  });

  return result;
}

async function assertState(state: State<any, any, any>, testContext: any) {
  for (const id of Object.keys(state.meta)) {
    const stateNodeMeta = state.meta[id];
    if (typeof stateNodeMeta.test === 'function' && !stateNodeMeta.skip) {
      // this.coverage.stateNodes.set(
      //   id,
      //   (this.coverage.stateNodes.get(id) || 0) + 1
      // );

      await stateNodeMeta.test(testContext, state);
    }
  }
}

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
 * @param machine The state machine used to represent the abstract model.
 * @param options Options for the created test model:
 * - `events`: an object mapping string event types (e.g., `SUBMIT`)
 * to an event test config (e.g., `{exec: () => {...}, cases: [...]}`)
 */
export function createTestModel<
  TMachine extends StateMachine<any, any, any>,
  TestContext = any
>(
  machine: TMachine,
  testContext: TestContext,
  options?: Partial<
    TestModelOptions<StateFrom<TMachine>, EventFrom<TMachine>, TestContext>
  >
): TestModel<StateFrom<TMachine>, EventFrom<TMachine>, TestContext> {
  const testModel = new TestModel<
    StateFrom<TMachine>,
    EventFrom<TMachine>,
    TestContext
  >(machine as SimpleBehavior<any, any>, testContext, {
    serializeState,
    testState: assertState,
    ...options
  });

  return testModel;
}
