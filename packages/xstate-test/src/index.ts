import { getShortestPaths } from '../node_modules/@xstate/graph';
import { StateMachine, EventObject, State } from 'xstate';

interface TestPlan {
  state: State<any>;
  paths: Array<{
    weight: number;
    path: Array<{
      state: State<any>;
      event: EventObject;
      test: () => Promise<void>;
      exec: () => Promise<void>;
    }>;
  }>;
  test: () => Promise<void>;
}

interface EventSample {
  type: never;
  [prop: string]: any;
}

interface TestModelOptions {
  events: {
    [eventType: string]: {
      exec: (context: any, event: EventObject) => Promise<any>;
      samples?: EventSample[];
    };
  };
}

export class TestModel {
  constructor(
    public machine: StateMachine<any, any, any>,
    public options: TestModelOptions
  ) {}

  public shortestPaths(): TestPlan[] {
    const shortestPaths = getShortestPaths(this.machine, {
      events: getEventSamples(this.options.events)
    });

    return Object.keys(shortestPaths).map(key => {
      const testPlan = shortestPaths[key];

      return {
        ...testPlan,
        test: () => TestModel.test(testPlan.state),
        paths: [
          {
            weight: testPlan.weight || 0,
            path: testPlan.path.map(segment => {
              return {
                ...segment,
                test: () => TestModel.test(segment.state),
                exec: () => this.exec(segment.event, segment.state)
              };
            })
          }
        ]
      };
    });
  }

  public static async test(state: State<any, any>) {
    for (const key of Object.keys(state.meta)) {
      const stateNodeMeta = state.meta[key];
      if (typeof stateNodeMeta.test === 'function') {
        await stateNodeMeta.test();
      }
    }
  }

  public async exec(event: EventObject, state: State<any, any>) {
    const testEvent = this.options.events[event.type];

    if (!testEvent) {
      throw new Error(`no event configured for ${event.type}`);
    }

    await testEvent.exec(state.context, event);
  }
}

function getEventSamples(eventsOptions: TestModelOptions['events']) {
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

export function createModel(
  machine: StateMachine<any, any, any>,
  options: TestModelOptions
) {
  return new TestModel(machine, options);
}
