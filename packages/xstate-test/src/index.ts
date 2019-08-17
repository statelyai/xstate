import {
  getShortestPaths,
  getSimplePaths
} from '../node_modules/@xstate/graph';
import { StateMachine, EventObject, State, StateValue } from 'xstate';

interface TestPlan<T> {
  state: State<any>;
  paths: Array<{
    weight: number;
    segments: Array<{
      state: State<any>;
      event: EventObject;
      test: (testContext: T) => Promise<void>;
      exec: (testContext: T) => Promise<void>;
    }>;
  }>;
  test: (testContext: T) => Promise<void>;
}

interface EventSample {
  type: never;
  [prop: string]: any;
}

type StatePredicate<TContext> = (state: State<TContext, any>) => boolean;

interface TestModelOptions<T> {
  events: {
    [eventType: string]: {
      exec: (testContext: T, event: EventObject) => Promise<any>;
      samples?: EventSample[];
    };
  };
}

export class TestModel<T, TContext> {
  constructor(
    public machine: StateMachine<TContext, any, any>,
    public options: TestModelOptions<T>
  ) {}

  public getShortestPaths(
    options?: Parameters<typeof getShortestPaths>[1]
  ): Array<TestPlan<T>> {
    const shortestPaths = getShortestPaths(this.machine, {
      ...options,
      events: getEventSamples<T>(this.options.events)
    });

    return Object.keys(shortestPaths).map(key => {
      const testPlan = shortestPaths[key];

      return {
        ...testPlan,
        test: testContext => this.test(testPlan.state, testContext),
        paths: [
          {
            weight: testPlan.weight || 0,
            segments: testPlan.path.map(segment => {
              return {
                ...segment,
                test: testContext => this.test(segment.state, testContext),
                exec: testContext => this.exec(segment.event, testContext)
              };
            })
          }
        ]
      };
    });
  }

  public getShortestPathsTo(
    stateValue: StateValue | StatePredicate<TContext>
  ): Array<TestPlan<T>> {
    let minWeight = Infinity;
    let shortestPlans: Array<TestPlan<T>> = [];

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
    testPlans: Array<TestPlan<T>>
  ): Array<TestPlan<T>> {
    const predicate =
      typeof stateValue === 'function'
        ? plan => stateValue(plan.state)
        : plan => plan.state.matches(stateValue);
    return testPlans.filter(predicate);
  }

  public getSimplePaths(
    options?: Parameters<typeof getSimplePaths>[1]
  ): Array<TestPlan<T>> {
    const simplePaths = getSimplePaths(this.machine, {
      ...options,
      events: getEventSamples(this.options.events)
    });

    return Object.keys(simplePaths).map(key => {
      const testPlan = simplePaths[key];

      return {
        ...testPlan,
        test: testContext => this.test(testPlan.state, testContext),
        paths: testPlan.paths.map(segments => {
          return {
            weight: 0,
            segments: segments.map(segment => {
              return {
                ...segment,
                test: testContext => this.test(segment.state, testContext),
                exec: testContext => this.exec(segment.event, testContext)
              };
            })
          };
        })
      };
    });
  }

  public getSimplePathsTo(
    stateValue: StateValue | StatePredicate<TContext>
  ): Array<TestPlan<T>> {
    return this.filterPathsTo(stateValue, this.getSimplePaths());
  }

  public async test(state: State<any, any>, testContext: T) {
    for (const key of Object.keys(state.meta)) {
      const stateNodeMeta = state.meta[key];
      if (typeof stateNodeMeta.test === 'function') {
        await stateNodeMeta.test(testContext);
      }
    }
  }

  public async exec(event: EventObject, testContext: T) {
    const testEvent = this.options.events[event.type];

    if (!testEvent) {
      throw new Error(`no event configured for ${event.type}`);
    }

    await testEvent.exec(testContext, event);
  }
}

function getEventSamples<T>(eventsOptions: TestModelOptions<T>['events']) {
  const result = {};

  Object.keys(eventsOptions).forEach(key => {
    const eventOptions = eventsOptions[key];
    result[key] = eventOptions.samples
      ? eventOptions.samples.map(sample => ({
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
  options: TestModelOptions<TestContext>
): TestModel<TestContext, TContext> {
  return new TestModel<TestContext, TContext>(machine, options);
}
