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

interface TestModelOptions<T> {
  events: {
    [eventType: string]: {
      exec: (testContext: T, event: EventObject) => Promise<any>;
      samples?: EventSample[];
    };
  };
}

export class TestModel<T> {
  constructor(
    public machine: StateMachine<any, { meta: { test: string } }, any>,
    public options: TestModelOptions<T>
  ) {}

  public shortestPaths(
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

  public shortestPathsTo(stateValue: StateValue): Array<TestPlan<T>> {
    let minWeight = Infinity;
    let shortestPlans: Array<TestPlan<T>> = [];

    const plans = this.shortestPaths().filter(path =>
      path.state.matches(stateValue)
    );

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

  public simplePaths(): Array<TestPlan<T>> {
    const simplePaths = getSimplePaths(this.machine, {
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

export function createModel<TestContext>(
  machine: StateMachine<any, any, any>,
  options: TestModelOptions<TestContext>
) {
  return new TestModel(machine, options);
}
