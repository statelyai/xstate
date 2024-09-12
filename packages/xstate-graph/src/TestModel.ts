import {
  getPathsFromEvents,
  getAdjacencyMap,
  joinPaths,
  AdjacencyValue,
  serializeSnapshot
} from '@xstate/graph';
import type {
  AdjacencyMap,
  SerializedEvent,
  SerializedSnapshot,
  StatePath,
  Step,
  TraversalOptions
} from '@xstate/graph';
import {
  EventObject,
  ActorLogic,
  Snapshot,
  isMachineSnapshot,
  __unsafe_getAllOwnEventDescriptors,
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
} from 'xstate';
import { deduplicatePaths } from './deduplicatePaths.ts';
import {
  createShortestPathsGen,
  createSimplePathsGen
} from './pathGenerators.ts';
import type {
  EventExecutor,
  PathGenerator,
  TestModelOptions,
  TestParam,
  TestPath,
  TestPathResult,
  TestStepResult
} from './types.ts';
import {
  formatPathTestResult,
  getDescription,
  simpleStringify
} from './utils.ts';
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
      test: (params: TestParam<TSnapshot, TEvent>) =>
        this.testPath(statePath, params),
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

  public async testPath(
    path: StatePath<TSnapshot, TEvent>,
    params: TestParam<TSnapshot, TEvent>,
    options?: Partial<TestModelOptions<TSnapshot, TEvent, TInput>>
  ): Promise<TestPathResult> {
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
          await this.testTransition(params, step);
        } catch (err: any) {
          testStepResult.event.error = err;

          throw err;
        }

        try {
          await this.testState(params, step.state, options);
        } catch (err: any) {
          testStepResult.state.error = err;

          throw err;
        }
      }
    } catch (err: any) {
      // TODO: make option
      err.message += formatPathTestResult(path, testPathResult, this.options);
      throw err;
    }

    return testPathResult;
  }

  public async testState(
    params: TestParam<TSnapshot, TEvent>,
    state: TSnapshot,
    options?: Partial<TestModelOptions<TSnapshot, TEvent, TInput>>
  ): Promise<void> {
    const resolvedOptions = this._resolveOptions(options);

    const stateTestKeys = this._getStateTestKeys(
      params,
      state,
      resolvedOptions
    );

    for (const stateTestKey of stateTestKeys) {
      await params.states?.[stateTestKey](state);
    }
  }

  private _getStateTestKeys(
    params: TestParam<TSnapshot, TEvent>,
    state: TSnapshot,
    resolvedOptions: TestModelOptions<TSnapshot, TEvent, TInput>
  ) {
    const states = params.states || {};
    const stateTestKeys = Object.keys(states).filter((stateKey) => {
      return resolvedOptions.stateMatcher(state, stateKey);
    });

    // Fallthrough state tests
    if (!stateTestKeys.length && '*' in states) {
      stateTestKeys.push('*');
    }

    return stateTestKeys;
  }

  private _getEventExec(
    params: TestParam<TSnapshot, TEvent>,
    step: Step<TSnapshot, TEvent>
  ) {
    const eventExec =
      params.events?.[(step.event as any).type as TEvent['type']];

    return eventExec;
  }

  public async testTransition(
    params: TestParam<TSnapshot, TEvent>,
    step: Step<TSnapshot, TEvent>
  ): Promise<void> {
    const eventExec = this._getEventExec(params, step);
    await (eventExec as EventExecutor<TSnapshot, TEvent>)?.(step);
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
        ? (state as any)._nodes.includes(machine.getStateNodeById(key))
        : (state as any).matches(key);
    },
    events: (state) => {
      const events =
        typeof getEvents === 'function' ? getEvents(state) : getEvents ?? [];

      return __unsafe_getAllOwnEventDescriptors(state).flatMap(
        (eventType: string) => {
          if (events.some((e) => (e as EventObject).type === eventType)) {
            return events.filter((e) => (e as EventObject).type === eventType);
          }

          return [{ type: eventType } as any]; // TODO: fix types
        }
      );
    },
    ...otherOptions
  });

  return testModel;
}
