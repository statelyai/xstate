import {
  getShortestPaths,
  getSimplePaths
} from '../node_modules/@xstate/graph';
import { StateMachine, EventObject, State, StateValue } from 'xstate';
import { StatePathsMap } from '@xstate/graph/lib/types';
import chalk from 'chalk';

interface TestMeta<T, TContext> {
  test?: (testContext: T, state: State<TContext>) => Promise<void> | void;
  description?: string | ((state: State<TContext>) => string);
  skip?: boolean;
}

interface TestSegment<T> {
  state: State<any>;
  event: EventObject;
  description: string;
  test: (testContext: T) => Promise<void>;
  exec: (testContext: T) => Promise<void>;
}

interface TestStateResult {
  error: null | Error;
}

interface TestSegmentResult {
  segment: TestSegment<any>;
  state: TestStateResult;
  event: {
    error: null | Error;
  };
}

interface TestPath<T> {
  weight: number;
  segments: Array<TestSegment<T>>;
  /**
   * Tests and executes each segment in `segments` sequentially, and then
   * tests the postcondition that the `state` is reached.
   */
  test: (testContext: T) => Promise<TestPathResult>;
}

interface TestPathResult {
  segments: TestSegmentResult[];
  state: TestStateResult;
}

interface TestPlan<T, TContext> {
  state: State<TContext>;
  paths: Array<TestPath<T>>;
  description: string;
  /**
   * Tests the postcondition that the `state` is reached.
   *
   * This should be tested after navigating any path in `paths`.
   */
  test: (testContext: T) => Promise<void>;
}

interface EventSample {
  type: never;
  [prop: string]: any;
}

type StatePredicate<TContext> = (state: State<TContext, any>) => boolean;

type EventExecutor<T> = (
  testContext: T,
  event: EventObject
) => Promise<any> | void;

interface TestModelOptions<T> {
  events: {
    [eventType: string]:
      | EventExecutor<T>
      | {
          exec: EventExecutor<T>;
          samples?: EventSample[];
        };
  };
}

interface TestModelCoverage {
  stateNodes: Map<string, number>;
  transitions: Map<string, Map<EventObject, number>>;
}

export class TestModel<T, TContext> {
  public coverage: TestModelCoverage = {
    stateNodes: new Map(),
    transitions: new Map()
  };
  public options: TestModelOptions<T>;
  public static defaultOptions: TestModelOptions<any> = {
    events: {}
  };

  constructor(
    public machine: StateMachine<TContext, any, any>,
    options?: Partial<TestModelOptions<T>>
  ) {
    this.options = {
      ...TestModel.defaultOptions,
      ...options
    };
  }

  public getShortestPaths(
    options?: Parameters<typeof getShortestPaths>[1]
  ): Array<TestPlan<T, TContext>> {
    const shortestPaths = getShortestPaths(this.machine, {
      ...options,
      events: getEventSamples<T>(this.options.events)
    }) as StatePathsMap<TContext, any>;

    return this.getTestPlans(shortestPaths);
  }

  public getShortestPathsTo(
    stateValue: StateValue | StatePredicate<TContext>
  ): Array<TestPlan<T, TContext>> {
    let minWeight = Infinity;
    let shortestPlans: Array<TestPlan<T, TContext>> = [];

    const plans = this.filterPathsTo(stateValue, this.getShortestPaths());

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
    stateValue: StateValue | StatePredicate<TContext>,
    testPlans: Array<TestPlan<T, TContext>>
  ): Array<TestPlan<T, TContext>> {
    const predicate =
      typeof stateValue === 'function'
        ? plan => stateValue(plan.state)
        : plan => plan.state.matches(stateValue);
    return testPlans.filter(predicate);
  }

  public getSimplePaths(
    options?: Parameters<typeof getSimplePaths>[1]
  ): Array<TestPlan<T, TContext>> {
    const simplePaths = getSimplePaths(this.machine, {
      ...options,
      events: getEventSamples(this.options.events)
    }) as StatePathsMap<TContext, any>;

    return this.getTestPlans(simplePaths);
  }

  public getSimplePathsTo(
    stateValue: StateValue | StatePredicate<TContext>
  ): Array<TestPlan<T, TContext>> {
    return this.filterPathsTo(stateValue, this.getSimplePaths());
  }

  public getTestPlans(
    statePathsMap: StatePathsMap<TContext, any>
  ): Array<TestPlan<T, TContext>> {
    return Object.keys(statePathsMap).map(key => {
      const testPlan = statePathsMap[key];

      return {
        ...testPlan,
        test: testContext => this.testState(testPlan.state, testContext),
        description: getDescription(testPlan.state),
        paths: testPlan.paths.map(path => {
          const segments = path.segments.map(segment => {
            return {
              ...segment,
              description: getDescription(segment.state),
              test: testContext => this.testState(segment.state, testContext),
              exec: testContext => this.executeEvent(segment.event, testContext)
            };
          });

          return {
            ...path,
            segments,
            test: async testContext => {
              const testPathResult: TestPathResult = {
                segments: [],
                state: {
                  error: null
                }
              };

              try {
                for (const segment of segments) {
                  const testSegmentResult: TestSegmentResult = {
                    segment,
                    state: { error: null },
                    event: { error: null }
                  };

                  testPathResult.segments.push(testSegmentResult);

                  try {
                    await segment.test(testContext);
                  } catch (err) {
                    testSegmentResult.state.error = err;

                    throw err;
                  }

                  try {
                    await segment.exec(testContext);
                  } catch (err) {
                    testSegmentResult.event.error = err;

                    throw err;
                  }
                }

                try {
                  await this.testState(testPlan.state, testContext);
                } catch (err) {
                  testPathResult.state.error = err;
                  throw err;
                }
              } catch (err) {
                const targetStateString = `${JSON.stringify(
                  path.state.value
                )} ${
                  path.state.context === undefined
                    ? ''
                    : JSON.stringify(path.state.context)
                }`;

                err.message +=
                  '\nPath:\n' +
                  testPathResult.segments
                    .map(s => {
                      const stateString = `${JSON.stringify(
                        s.segment.state.value
                      )} ${
                        s.segment.state.context === undefined
                          ? ''
                          : JSON.stringify(s.segment.state.context)
                      }`;
                      const eventString = `${JSON.stringify(s.segment.event)}`;

                      const stateResult = `\tState: ${
                        s.state.error
                          ? chalk.redBright(stateString)
                          : chalk.greenBright(stateString)
                      }`;
                      const eventResult = `\tEvent: ${
                        s.event.error
                          ? chalk.red(eventString)
                          : s.state.error
                          ? chalk.grey(eventString)
                          : chalk.green(eventString)
                      }`;

                      return [stateResult, eventResult].join('\n');
                    })
                    .concat(
                      `\tState: ${
                        testPathResult.state.error
                          ? chalk.red(targetStateString)
                          : chalk.green(targetStateString)
                      }`
                    )
                    .join('\n\n');

                throw err;
              }

              return testPathResult;
            }
          };
        })
      };
    });
  }

  public async testState(state: State<TContext>, testContext: T) {
    for (const id of Object.keys(state.meta)) {
      const stateNodeMeta = state.meta[id] as TestMeta<T, TContext>;
      if (typeof stateNodeMeta.test === 'function' && !stateNodeMeta.skip) {
        this.coverage.stateNodes.set(
          id,
          (this.coverage.stateNodes.get(id) || 0) + 1
        );

        await stateNodeMeta.test(testContext, state);
      }
    }
  }

  public getEventExecutor(event: EventObject): EventExecutor<T> {
    const testEvent = this.options.events[event.type];

    if (typeof testEvent === 'function') {
      return testEvent;
    }

    return testEvent.exec;
  }

  public async executeEvent(event: EventObject, testContext: T) {
    const executor = this.getEventExecutor(event);

    if (!executor) {
      throw new Error(`no event configured for ${event.type}`);
    }

    await executor(testContext, event);
  }

  public getCoverage(): { stateNodes: Record<string, number> } {
    const coverage = {
      stateNodes: {}
    };

    for (const key of this.coverage.stateNodes.keys()) {
      coverage.stateNodes[key] = this.coverage.stateNodes.get(key);
    }

    return coverage;
  }
}

function getDescription<T, TContext>(state: State<TContext>): string {
  return Object.keys(state.meta)
    .map(id => {
      const { description } = state.meta[id] as TestMeta<T, TContext>;

      return typeof description === 'function'
        ? description(state)
        : description ||
            `state: ${JSON.stringify(state.value)} (${JSON.stringify(
              state.context
            )})`;
    })
    .join('\n');
}

function getEventSamples<T>(eventsOptions: TestModelOptions<T>['events']) {
  const result = {};

  Object.keys(eventsOptions).forEach(key => {
    const eventConfig = eventsOptions[key];
    if (typeof eventConfig === 'function') {
      return [
        {
          type: key
        }
      ];
    }

    result[key] = eventConfig.samples
      ? eventConfig.samples.map(sample => ({
          type: key,
          ...sample
        }))
      : [
          {
            type: key
          }
        ];
  });

  return result;
}

export function createModel<TestContext, TContext = any>(
  machine: StateMachine<TContext, any, any>,
  options?: TestModelOptions<TestContext>
): TestModel<TestContext, TContext> {
  return new TestModel<TestContext, TContext>(machine, options);
}
