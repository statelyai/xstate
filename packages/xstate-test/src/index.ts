import { getShortestPaths, getSimplePaths, getStateNodes } from '@xstate/graph';
import { StateMachine, EventObject, State, StateValue } from 'xstate';
import { StatePathsMap } from '@xstate/graph/lib/types';
import chalk from 'chalk';
import {
  TestModelCoverage,
  TestModelOptions,
  TestPlan,
  StatePredicate,
  TestPathResult,
  TestSegmentResult,
  TestMeta,
  EventExecutor
} from './types';
import { ValueAdjMapOptions } from '@xstate/graph/lib/graph';

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

  public getShortestPathPlans(
    options?: Partial<ValueAdjMapOptions<TContext, any>>
  ): Array<TestPlan<T, TContext>> {
    const shortestPaths = getShortestPaths(this.machine, {
      ...options,
      events: getEventSamples<T>(this.options.events)
    }) as StatePathsMap<TContext, any>;

    return this.getTestPlans(shortestPaths);
  }

  public getShortestPathPlansTo(
    stateValue: StateValue | StatePredicate<TContext>
  ): Array<TestPlan<T, TContext>> {
    let minWeight = Infinity;
    let shortestPlans: Array<TestPlan<T, TContext>> = [];

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
    stateValue: StateValue | StatePredicate<TContext>,
    testPlans: Array<TestPlan<T, TContext>>
  ): Array<TestPlan<T, TContext>> {
    const predicate =
      typeof stateValue === 'function'
        ? plan => stateValue(plan.state)
        : plan => plan.state.matches(stateValue);
    return testPlans.filter(predicate);
  }

  public getSimplePathPlans(
    options?: Partial<ValueAdjMapOptions<TContext, any>>
  ): Array<TestPlan<T, TContext>> {
    const simplePaths = getSimplePaths(this.machine, {
      ...options,
      events: getEventSamples(this.options.events)
    }) as StatePathsMap<TContext, any>;

    return this.getTestPlans(simplePaths);
  }

  public getSimplePathPlansTo(
    stateValue: StateValue | StatePredicate<TContext>
  ): Array<TestPlan<T, TContext>> {
    return this.filterPathsTo(stateValue, this.getSimplePathPlans());
  }

  public getTestPlans(
    statePathsMap: StatePathsMap<TContext, any>
  ): Array<TestPlan<T, TContext>> {
    return Object.keys(statePathsMap).map(key => {
      const testPlan = statePathsMap[key];
      const paths = testPlan.paths.map(path => {
        const segments = path.segments.map(segment => {
          return {
            ...segment,
            description: getDescription(segment.state),
            test: testContext => this.testState(segment.state, testContext),
            exec: testContext => this.executeEvent(segment.event, testContext)
          };
        });

        function formatEvent(event: EventObject): string {
          const { type, ...other } = event;

          const propertyString = Object.keys(other).length
            ? ` (${JSON.stringify(other)})`
            : '';

          return `${type}${propertyString}`;
        }

        const eventsString = path.segments
          .map(s => formatEvent(s.event))
          .join(' → ');

        return {
          ...path,
          segments,
          description: `via ${eventsString}`,
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
              const targetStateString = `${JSON.stringify(path.state.value)} ${
                path.state.context === undefined
                  ? ''
                  : JSON.stringify(path.state.context)
              }`;

              let hasFailed = false;
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
                      hasFailed
                        ? chalk.gray(stateString)
                        : s.state.error
                        ? ((hasFailed = true), chalk.redBright(stateString))
                        : chalk.greenBright(stateString)
                    }`;
                    const eventResult = `\tEvent: ${
                      hasFailed
                        ? chalk.gray(eventString)
                        : s.event.error
                        ? ((hasFailed = true), chalk.red(eventString))
                        : chalk.green(eventString)
                    }`;

                    return [stateResult, eventResult].join('\n');
                  })
                  .concat(
                    `\tState: ${
                      hasFailed
                        ? chalk.gray(targetStateString)
                        : testPathResult.state.error
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
      });

      return {
        ...testPlan,
        test: async testContext => {
          for (const path of paths) {
            await path.test(testContext);
          }
        },
        description: `reaches ${getDescription(testPlan.state)}`,
        paths
      } as TestPlan<T, TContext>;
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

  public getEventExecutor(event: EventObject): EventExecutor<T> | undefined {
    const testEvent = this.options.events[event.type];

    if (!testEvent) {
      throw new Error(`Missing config for event "${event.type}".`);
    }

    if (typeof testEvent === 'function') {
      return testEvent;
    }

    return testEvent.exec;
  }

  public async executeEvent(event: EventObject, testContext: T) {
    const executor = this.getEventExecutor(event);

    if (executor) {
      await executor(testContext, event);
    }
  }

  public getCoverage(): { stateNodes: Record<string, number> } {
    const stateNodes = getStateNodes(this.machine);
    const coverage = {
      stateNodes: stateNodes.reduce((acc, stateNode) => {
        acc[stateNode.id] = 0;
        return acc;
      }, {})
    };

    for (const key of this.coverage.stateNodes.keys()) {
      coverage.stateNodes[key] = this.coverage.stateNodes.get(key);
    }

    return coverage;
  }

  public testCoverage(): void {
    const coverage = this.getCoverage();
    const missingStateNodes = Object.keys(coverage.stateNodes).filter(id => {
      return !coverage.stateNodes[id];
    });

    if (missingStateNodes.length) {
      throw new Error(
        'Missing coverage for state nodes:\n' +
          missingStateNodes.map(id => `\t${id}`).join('\n')
      );
    }
  }

  public withEvents(
    eventMap: TestModelOptions<T>['events']
  ): TestModel<T, TContext> {
    return new TestModel<T, TContext>(this.machine, {
      events: eventMap
    });
  }
}

function getDescription<T, TContext>(state: State<TContext>): string {
  return Object.keys(state.meta)
    .map(id => {
      const { description } = state.meta[id] as TestMeta<T, TContext>;
      const contextString =
        state.context === undefined ? '' : `(${JSON.stringify(state.context)})`;

      return typeof description === 'function'
        ? description(state)
        : description ||
            `state: ${JSON.stringify(state.value)} ${contextString}`;
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

    result[key] = eventConfig.cases
      ? eventConfig.cases.map(sample => ({
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
