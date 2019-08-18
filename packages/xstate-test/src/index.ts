import {
  getShortestPaths,
  getSimplePaths
} from '../node_modules/@xstate/graph';
import { StateMachine, EventObject, State, StateValue } from 'xstate';

interface TestMeta<T> {
  test?: (testContext: T) => Promise<void>;
  description?: string | ((state: State<any, any>) => string);
  skip?: boolean;
}

interface TestSegment<T> {
  state: State<any>;
  event: EventObject;
  description: string;
  test: (testContext: T) => Promise<void>;
  exec: (testContext: T) => Promise<void>;
}

interface TestPlan<T> {
  state: State<any>;
  paths: Array<{
    weight: number;
    segments: Array<TestSegment<T>>;
  }>;
  description: string;
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

interface TestModelCoverage {
  stateNodes: Map<string, number>;
  transitions: Map<string, Map<EventObject, number>>;
}

export class TestModel<T, TContext> {
  public coverage: TestModelCoverage = {
    stateNodes: new Map(),
    transitions: new Map()
  };

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
        description: getDescription(testPlan.state),
        paths: [
          {
            weight: testPlan.weight || 0,
            segments: testPlan.path.map(segment => {
              return {
                ...segment,
                description: getDescription(segment.state),
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
        description: getDescription(testPlan.state),
        paths: testPlan.paths.map(segments => {
          return {
            weight: 0,
            segments: segments.map(segment => {
              return {
                ...segment,
                description: getDescription(segment.state),
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
    for (const id of Object.keys(state.meta)) {
      const stateNodeMeta = state.meta[id] as TestMeta<T>;
      if (typeof stateNodeMeta.test === 'function' && !stateNodeMeta.skip) {
        this.coverage.stateNodes.set(
          id,
          (this.coverage.stateNodes.get(id) || 0) + 1
        );

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

function getDescription<T>(state: State<any, any>): string {
  return Object.keys(state.meta)
    .map(id => {
      const { description } = state.meta[id] as TestMeta<T>;

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
