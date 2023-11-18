import {
  getPathsFromEvents,
  getAdjacencyMap,
  joinPaths,
  AdjacencyValue
} from '@xstate/graph';
import type {
  SerializedEvent,
  SerializedState,
  StatePath,
  Step,
  TraversalOptions
} from '@xstate/graph';
import {
  EventObject,
  AnyMachineSnapshot,
  ActorLogic,
  Snapshot,
  isMachineSnapshot
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

/**
 * Creates a test model that represents an abstract model of a
 * system under test (SUT).
 *
 * The test model is used to generate test paths, which are used to
 * verify that states in the model are reachable in the SUT.
 */
export class TestModel<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> {
  public options: TestModelOptions<TSnapshot, TEvent>;
  public defaultTraversalOptions?: TraversalOptions<TSnapshot, TEvent>;
  public getDefaultOptions(): TestModelOptions<TSnapshot, TEvent> {
    return {
      serializeState: (state) => simpleStringify(state) as SerializedState,
      serializeEvent: (event) => simpleStringify(event) as SerializedEvent,
      // For non-state-machine test models, we cannot identify
      // separate transitions, so just use event type
      serializeTransition: (state, event) =>
        `${simpleStringify(state)}|${event?.type ?? ''}`,
      events: [],
      stateMatcher: (_, stateKey) => stateKey === '*',
      logger: {
        log: console.log.bind(console),
        error: console.error.bind(console)
      }
    };
  }

  constructor(
    public logic: ActorLogic<TSnapshot, TEvent, TInput>,
    options?: Partial<TestModelOptions<TSnapshot, TEvent>>
  ) {
    this.options = {
      ...this.getDefaultOptions(),
      ...options
    };
  }

  public getPaths(
    pathGenerator: PathGenerator<TSnapshot, TEvent, TInput>,
    options?: Partial<TraversalOptions<TSnapshot, TEvent>>
  ): Array<TestPath<TSnapshot, TEvent>> {
    const paths = pathGenerator(this.logic, this.resolveOptions(options));
    return deduplicatePaths(paths).map(this.toTestPath);
  }

  public getShortestPaths(
    options?: Partial<TraversalOptions<TSnapshot, TEvent>>
  ): Array<TestPath<TSnapshot, TEvent>> {
    return this.getPaths(createShortestPathsGen(), options);
  }

  public getShortestPathsFrom(
    paths: Array<TestPath<TSnapshot, TEvent>>,
    options?: Partial<TraversalOptions<TSnapshot, any>>
  ): Array<TestPath<TSnapshot, TEvent>> {
    const resultPaths: TestPath<TSnapshot, TEvent>[] = [];

    for (const path of paths) {
      const shortestPaths = this.getShortestPaths({
        ...options,
        fromState: path.state
      });
      for (const shortestPath of shortestPaths) {
        resultPaths.push(this.toTestPath(joinPaths(path, shortestPath)));
      }
    }

    return resultPaths;
  }

  public getSimplePaths(
    options?: Partial<TraversalOptions<TSnapshot, TEvent>>
  ): Array<TestPath<TSnapshot, TEvent>> {
    return this.getPaths(createSimplePathsGen(), options);
  }

  public getSimplePathsFrom(
    paths: Array<TestPath<TSnapshot, TEvent>>,
    options?: Partial<TraversalOptions<TSnapshot, any>>
  ): Array<TestPath<TSnapshot, TEvent>> {
    const resultPaths: TestPath<TSnapshot, TEvent>[] = [];

    for (const path of paths) {
      const shortestPaths = this.getSimplePaths({
        ...options,
        fromState: path.state
      });
      for (const shortestPath of shortestPaths) {
        resultPaths.push(this.toTestPath(joinPaths(path, shortestPath)));
      }
    }

    return resultPaths;
  }

  private toTestPath = (
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
      testSync: (params: TestParam<TSnapshot, TEvent>) =>
        this.testPathSync(statePath, params),
      description: isMachineSnapshot(statePath.state)
        ? `Reaches ${getDescription(
            statePath.state as any
          ).trim()}: ${eventsString}`
        : JSON.stringify(statePath.state)
    };
  };

  public getPathsFromEvents(
    events: TEvent[],
    options?: TraversalOptions<TSnapshot, TEvent>
  ): Array<TestPath<TSnapshot, TEvent>> {
    const paths = getPathsFromEvents(this.logic, events, options);

    return paths.map(this.toTestPath);
  }

  public getAllStates(): TSnapshot[] {
    const adj = getAdjacencyMap(this.logic, this.options);
    return Object.values(adj).map((x) => x.state);
  }

  /**
   * An array of adjacencies, which are objects that represent each `state` with the `nextState`
   * given the `event`.
   */
  public getAdjacencyList(): Array<{
    state: TSnapshot;
    event: TEvent;
    nextState: TSnapshot;
  }> {
    const adjMap = getAdjacencyMap(this.logic, this.options);
    const adjList: Array<{
      state: TSnapshot;
      event: TEvent;
      nextState: TSnapshot;
    }> = [];

    for (const adjValue of Object.values(adjMap)) {
      for (const transition of Object.values(
        (adjValue as AdjacencyValue<TSnapshot, TEvent>).transitions
      )) {
        adjList.push({
          state: (adjValue as AdjacencyValue<TSnapshot, TEvent>).state,
          event: transition.event,
          nextState: transition.state
        });
      }
    }

    return adjList;
  }

  public testPathSync(
    path: StatePath<TSnapshot, TEvent>,
    params: TestParam<TSnapshot, TEvent>,
    options?: Partial<TestModelOptions<TSnapshot, TEvent>>
  ): TestPathResult {
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
          this.testTransitionSync(params, step);
        } catch (err: any) {
          testStepResult.event.error = err;

          throw err;
        }

        try {
          this.testStateSync(params, step.state, options);
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

  public async testPath(
    path: StatePath<TSnapshot, TEvent>,
    params: TestParam<TSnapshot, TEvent>,
    options?: Partial<TestModelOptions<TSnapshot, TEvent>>
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
    options?: Partial<TestModelOptions<TSnapshot, TEvent>>
  ): Promise<void> {
    const resolvedOptions = this.resolveOptions(options);

    const stateTestKeys = this.getStateTestKeys(params, state, resolvedOptions);

    for (const stateTestKey of stateTestKeys) {
      await params.states?.[stateTestKey](state);
    }
  }

  private getStateTestKeys(
    params: TestParam<TSnapshot, TEvent>,
    state: TSnapshot,
    resolvedOptions: TestModelOptions<TSnapshot, TEvent>
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

  public testStateSync(
    params: TestParam<TSnapshot, TEvent>,
    state: TSnapshot,
    options?: Partial<TestModelOptions<TSnapshot, TEvent>>
  ): void {
    const resolvedOptions = this.resolveOptions(options);

    const stateTestKeys = this.getStateTestKeys(params, state, resolvedOptions);

    for (const stateTestKey of stateTestKeys) {
      errorIfPromise(
        params.states?.[stateTestKey](state),
        `The test for '${stateTestKey}' returned a promise - did you mean to use the sync method?`
      );
    }
  }

  private getEventExec(
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
    const eventExec = this.getEventExec(params, step);
    await (eventExec as EventExecutor<TSnapshot, TEvent>)?.(step);
  }

  public testTransitionSync(
    params: TestParam<TSnapshot, TEvent>,
    step: Step<TSnapshot, TEvent>
  ): void {
    const eventExec = this.getEventExec(params, step);

    errorIfPromise(
      (eventExec as EventExecutor<TSnapshot, TEvent>)?.(step),
      `The event '${step.event.type}' returned a promise - did you mean to use the sync method?`
    );
  }

  public resolveOptions(
    options?: Partial<TestModelOptions<TSnapshot, TEvent>>
  ): TestModelOptions<TSnapshot, TEvent> {
    return { ...this.defaultTraversalOptions, ...this.options, ...options };
  }
}

const errorIfPromise = (result: unknown, err: string) => {
  if (typeof result === 'object' && result && 'then' in result) {
    throw new Error(err);
  }
};
