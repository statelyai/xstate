import {
  getPathsFromEvents,
  getAdjacencyMap,
  joinPaths,
  serializeSnapshot
} from './index.ts';
import type {
  AdjacencyMap,
  SerializedEvent,
  SerializedSnapshot,
  StatePath,
  TraversalOptions,
  PathGenerator,
  TestModelOptions,
  TestPath
} from './types.ts';
import type { TestExecutionOptions, TestPathRunResult } from './testPaths.ts';
import { testPaths } from './testPaths.ts';
import {
  EventObject,
  ActorLogic,
  Snapshot,
  isMachineSnapshot,
  AnyActorRef,
  AnyEventObject,
  AnyStateMachine,
  EventFromLogic,
  MachineContext,
  MachineSnapshot,
  SnapshotFrom,
  StateValue,
  TODO,
  InputFrom
} from '../index.ts';
import { deduplicatePaths } from './deduplicatePaths.ts';
import { getAllOwnEvents, matchesEvent } from '../utils.ts';
import {
  createShortestPathsGen,
  createSimplePathsGen
} from './pathGenerators.ts';
import { getDescription, simpleStringify } from './utils.ts';
import { validateMachine } from './validateMachine.ts';

type GetPathOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = Partial<TraversalOptions<TSnapshot, TEvent, TInput>> & {
  /**
   * Whether to allow deduplicate paths so that paths that are contained by
   * longer paths are included.
   *
   * @default false
   */
  allowDuplicatePaths?: boolean;
};

/**
 * Creates a test model that represents an abstract model of a system under test
 * (SUT).
 *
 * The test model is used to generate test paths, which are used to verify that
 * states in the model are reachable in the SUT.
 */
export class TestModel<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> {
  public options: TestModelOptions<TSnapshot, TEvent, TInput>;
  public defaultTraversalOptions?: TraversalOptions<TSnapshot, TEvent, TInput>;
  public getDefaultOptions(): TestModelOptions<TSnapshot, TEvent, TInput> {
    return {
      serializeState: (state) => simpleStringify(state) as SerializedSnapshot,
      serializeEvent: (event) => simpleStringify(event) as SerializedEvent,
      // For non-state-machine test models, we cannot identify
      // separate transitions, so just use event type
      serializeTransition: (state, event) =>
        `${simpleStringify(state)}|${event?.type}`,
      events: [],
      stateMatcher: (_, stateKey) => stateKey === '*',
      logger: {
        log: console.log.bind(console),
        error: console.error.bind(console)
      }
    };
  }

  constructor(
    public testLogic: ActorLogic<TSnapshot, TEvent, TInput>,
    options?: Partial<TestModelOptions<TSnapshot, TEvent, TInput>>
  ) {
    this.options = {
      ...this.getDefaultOptions(),
      ...options
    };
  }

  public getPaths(
    pathGenerator: PathGenerator<TSnapshot, TEvent, TInput>,
    options?: GetPathOptions<TSnapshot, TEvent, TInput>
  ): Array<TestPath<TSnapshot, TEvent>> {
    const allowDuplicatePaths = options?.allowDuplicatePaths ?? false;
    const paths = pathGenerator(this.testLogic, this._resolveOptions(options));
    return (allowDuplicatePaths ? paths : deduplicatePaths(paths)).map(
      this._toTestPath
    );
  }

  public getShortestPaths(
    options?: GetPathOptions<TSnapshot, TEvent, TInput>
  ): Array<TestPath<TSnapshot, TEvent>> {
    return this.getPaths(createShortestPathsGen(), options);
  }

  public getShortestPathsFrom(
    paths: Array<TestPath<TSnapshot, TEvent>>,
    options?: GetPathOptions<TSnapshot, TEvent, TInput>
  ): Array<TestPath<TSnapshot, TEvent>> {
    const resultPaths: TestPath<TSnapshot, TEvent>[] = [];

    for (const path of paths) {
      const shortestPaths = this.getShortestPaths({
        ...options,
        fromState: path.state
      });
      for (const shortestPath of shortestPaths) {
        resultPaths.push(this._toTestPath(joinPaths(path, shortestPath)));
      }
    }

    return resultPaths;
  }

  public getSimplePaths(
    options?: GetPathOptions<TSnapshot, TEvent, TInput>
  ): Array<TestPath<TSnapshot, TEvent>> {
    return this.getPaths(createSimplePathsGen(), options);
  }

  public getSimplePathsFrom(
    paths: Array<TestPath<TSnapshot, TEvent>>,
    options?: GetPathOptions<TSnapshot, TEvent, TInput>
  ): Array<TestPath<TSnapshot, TEvent>> {
    const resultPaths: TestPath<TSnapshot, TEvent>[] = [];

    for (const path of paths) {
      const shortestPaths = this.getSimplePaths({
        ...options,
        fromState: path.state
      });
      for (const shortestPath of shortestPaths) {
        resultPaths.push(this._toTestPath(joinPaths(path, shortestPath)));
      }
    }

    return resultPaths;
  }

  private _toTestPath = (
    statePath: StatePath<TSnapshot, TEvent>
  ): TestPath<TSnapshot, TEvent> => {
    function formatEvent(event: EventObject): string {
      const { type, ...other } = event;

      const propertyString = Object.keys(other).length
        ? ` (${JSON.stringify(other)})`
        : '';

      return `${type}${propertyString}`;
    }

    const eventsString = statePath.steps
      .map((s) => formatEvent(s.event))
      .join(' → ');
    return {
      ...statePath,
      test: (options?: TestExecutionOptions<TSnapshot, TEvent, unknown>) =>
        this.testPath(
          statePath,
          options as TestExecutionOptions<TSnapshot, TEvent, TInput>
        ),
      description: isMachineSnapshot(statePath.state)
        ? `Reaches ${getDescription(
            statePath.state as any
          ).trim()}: ${eventsString}`
        : JSON.stringify(statePath.state)
    };
  };

  public getPathsFromEvents(
    events: TEvent[],
    options?: GetPathOptions<TSnapshot, TEvent, TInput>
  ): Array<TestPath<TSnapshot, TEvent>> {
    const paths = getPathsFromEvents(this.testLogic, events, options);

    return paths.map(this._toTestPath);
  }

  /**
   * An array of adjacencies, which are objects that represent each `state` with
   * the `nextState` given the `event`.
   */
  public getAdjacencyMap(): AdjacencyMap<TSnapshot, TEvent> {
    const adjMap = getAdjacencyMap(this.testLogic, this.options);
    return adjMap;
  }

  /**
   * Executes `paths` (the shortest paths by default) against the system under
   * test, returning the same coverage object `propertyTest()` produces.
   */
  public async testPaths(
    paths?: Array<StatePath<TSnapshot, TEvent>>,
    options?: TestExecutionOptions<TSnapshot, TEvent, TInput>
  ) {
    return testPaths(this as any, {
      ...(options as any),
      ...(paths ? { paths } : {})
    });
  }

  /** Executes a single path. See {@link TestModel.testPaths}. */
  public async testPath(
    path: StatePath<TSnapshot, TEvent>,
    options?: TestExecutionOptions<TSnapshot, TEvent, TInput>
  ): Promise<TestPathRunResult<TSnapshot, TEvent>> {
    const { results } = await this.testPaths([path], options);
    return results[0] as TestPathRunResult<TSnapshot, TEvent>;
  }

  private _resolveOptions(
    options?: Partial<TestModelOptions<TSnapshot, TEvent, TInput>>
  ): TestModelOptions<TSnapshot, TEvent, TInput> {
    return { ...this.defaultTraversalOptions, ...this.options, ...options };
  }
}

function stateValuesEqual(
  a: StateValue | undefined,
  b: StateValue | undefined
): boolean {
  if (a === b) {
    return true;
  }

  if (a === undefined || b === undefined) {
    return false;
  }

  if (typeof a === 'string' || typeof b === 'string') {
    return a === b;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => stateValuesEqual(a[key], b[key]))
  );
}

function serializeMachineTransition(
  snapshot: MachineSnapshot<
    MachineContext,
    EventObject,
    Record<string, AnyActorRef | undefined>,
    StateValue,
    string,
    unknown,
    TODO, // TMeta
    TODO // TStateSchema
  >,
  event: AnyEventObject | undefined,
  previousSnapshot:
    | MachineSnapshot<
        MachineContext,
        EventObject,
        Record<string, AnyActorRef | undefined>,
        StateValue,
        string,
        unknown,
        TODO, // TMeta
        TODO // TStateSchema
      >
    | undefined,
  { serializeEvent }: { serializeEvent: (event: AnyEventObject) => string }
): string {
  // TODO: the stateValuesEqual check here is very likely not exactly correct
  // but I'm not sure what the correct check is and what this is trying to do
  if (
    !event ||
    (previousSnapshot &&
      stateValuesEqual(previousSnapshot.value, snapshot.value))
  ) {
    return '';
  }

  const prevStateString = previousSnapshot
    ? ` from ${simpleStringify(previousSnapshot.value)}`
    : '';

  return ` via ${serializeEvent(event)}${prevStateString}`;
}

/**
 * Creates a test model that represents an abstract model of a system under test
 * (SUT).
 *
 * The test model is used to generate test paths, which are used to verify that
 * states in the `machine` are reachable in the SUT.
 *
 * @example
 *
 * ```js
 * const toggleModel = createModel(toggleMachine).withEvents({
 *   TOGGLE: {
 *     exec: async (page) => {
 *       await page.click('input');
 *     }
 *   }
 * });
 * ```
 *
 * @param machine The state machine used to represent the abstract model.
 * @param options Options for the created test model:
 *
 *   - `events`: an object mapping string event types (e.g., `SUBMIT`) to an event
 *       test config (e.g., `{exec: () => {...}, cases: [...]}`)
 */
export function createTestModel<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: Partial<
    TestModelOptions<
      SnapshotFrom<TMachine>,
      EventFromLogic<TMachine>,
      InputFrom<TMachine>
    >
  >
): TestModel<SnapshotFrom<TMachine>, EventFromLogic<TMachine>, unknown> {
  validateMachine(machine);

  const serializeEvent = (options?.serializeEvent ?? simpleStringify) as (
    event: AnyEventObject
  ) => string;
  const serializeTransition =
    options?.serializeTransition ?? serializeMachineTransition;
  const { events: getEvents, ...otherOptions } = options ?? {};

  const testModel = new TestModel<
    SnapshotFrom<TMachine>,
    EventFromLogic<TMachine>,
    unknown
  >(machine as any, {
    serializeState: (state, event, prevState) => {
      // Only consider the `state` if `serializeTransition()` is opted out (empty string)
      return `${serializeSnapshot(state)}${serializeTransition(
        state,
        event,
        prevState,
        {
          serializeEvent
        }
      )}` as SerializedSnapshot;
    },
    stateMatcher: (state, key) => {
      return key.startsWith('#')
        ? (state as any).nodes.includes(machine.getStateNodeById(key))
        : (state as any).matches(key);
    },
    events: (state) => {
      const events =
        typeof getEvents === 'function' ? getEvents(state) : (getEvents ?? []);

      return getAllOwnEvents(state).flatMap((defaultEvent: AnyEventObject) => {
        if (
          events.some((event) =>
            matchesEvent(event as EventObject, defaultEvent)
          )
        ) {
          return events.filter((event) =>
            matchesEvent(event as EventObject, defaultEvent)
          );
        }

        return [defaultEvent as any];
      });
    },
    ...otherOptions
  });

  return testModel;
}
