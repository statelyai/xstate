import {
  SimpleBehavior,
  StatePlan,
  Step,
  TraversalOptions
} from '@xstate/graph';
import {
  AnyState,
  EventObject,
  ExtractEvent,
  MachineConfig,
  State,
  StateNode,
  StateNodeConfig,
  TransitionConfig
} from 'xstate';
export interface TestMeta<T, TContext> {
  test?: (testContext: T, state: State<TContext, any>) => Promise<void> | void;
  description?: string | ((state: State<TContext, any>) => string);
  skip?: boolean;
}
interface TestStep<T> {
  state: AnyState;
  event: EventObject;
  description: string;
  test: (testContext: T) => Promise<void>;
  exec: (testContext: T) => Promise<void>;
}
interface TestStateResult {
  error: null | Error;
}
export interface TestStepResult {
  step: Step<any, any>;
  state: TestStateResult;
  event: {
    error: null | Error;
  };
}
export interface TestPath<T> {
  weight: number;
  steps: Array<TestStep<T>>;
  description: string;
  /**
   * Tests and executes each step in `steps` sequentially, and then
   * tests the postcondition that the `state` is reached.
   */
  test: (testContext: T) => Promise<TestPathResult>;
}
export interface TestPathResult {
  steps: TestStepResult[];
  state: TestStateResult;
}

/**
 * A collection of `paths` used to verify that the SUT reaches
 * the target `state`.
 */
export interface TestPlan<TTestContext, TState> {
  /**
   * The target state.
   */
  state: TState;
  /**
   * The paths that reach the target `state`.
   */
  paths: Array<TestPath<TTestContext>>;
  /**
   * The description of the target `state` to be reached.
   */
  description: string;
  /**
   * Tests the postcondition that the `state` is reached.
   *
   * This should be tested after navigating any path in `paths`.
   */
  test: (
    /**
     * The test context used for verifying the SUT.
     */
    testContext: TTestContext
  ) => Promise<void> | void;
}

/**
 * A sample event object payload (_without_ the `type` property).
 *
 * @example
 *
 * ```js
 * {
 *   value: 'testValue',
 *   other: 'something',
 *   id: 42
 * }
 * ```
 */
interface EventCase {
  type?: never;
  [prop: string]: any;
}

export type StatePredicate<TState> = (state: TState) => boolean;
/**
 * Executes an effect using the `testContext` and `event`
 * that triggers the represented `event`.
 */
export type EventExecutor<TState, TEvent extends EventObject> = (
  step: Step<TState, TEvent>
) => Promise<any> | void;

export interface TestEventConfig<TState, TEvent extends EventObject> {
  /**
   * Executes an effect that triggers the represented event.
   *
   * @example
   *
   * ```js
   * exec: async (page, event) => {
   *   await page.type('.foo', event.value);
   * }
   * ```
   */
  exec?: EventExecutor<TState, TEvent>;
  /**
   * Sample event object payloads _without_ the `type` property.
   *
   * @example
   *
   * ```js
   * cases: [
   *   { value: 'foo' },
   *   { value: '' }
   * ]
   * ```
   */
  cases?: EventCase[];
}

export interface TestEventsConfig<TState, TEvent extends EventObject> {
  [eventType: string]:
    | EventExecutor<TState, TEvent>
    | TestEventConfig<TState, TEvent>;
}

export interface TestModelEventConfig<TState, TEvent extends EventObject> {
  cases?: () => Array<Omit<TEvent, 'type'> | TEvent>;
  exec?: EventExecutor<TState, TEvent>;
}

export interface TestModelOptions<TState, TEvent extends EventObject>
  extends TraversalOptions<TState, TEvent> {
  // testState: (state: TState) => void | Promise<void>;
  testTransition: (step: Step<TState, TEvent>) => void | Promise<void>;
  /**
   * Executes actions based on the `state` after the state is tested.
   */
  execute: (state: TState) => void | Promise<void>;
  getStates: () => TState[];
  stateMatcher: (state: TState, stateKey: string) => boolean;
  states: {
    [key: string]: (state: TState) => void | Promise<void>;
  };
  events: {
    [TEventType in string /* TODO: TEvent['type'] */]?: TestModelEventConfig<
      TState,
      ExtractEvent<TEvent, TEventType>
    >;
  };
  logger: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
  /**
   * Executed before each path is tested
   */
  beforePath?: () => void | Promise<void>;
  /**
   * Executed after each path is tested
   */
  afterPath?: () => void | Promise<void>;
}

export interface TestStateCoverage<TState> {
  state: TState;
  /**
   * Number of times state was visited
   */
  count: number;
}

export interface TestTransitionCoverage<TState, TEvent extends EventObject> {
  step: Step<TState, TEvent>;
  count: number;
}

export interface TestModelCoverage<TState, TEvent extends EventObject> {
  states: Record<string, TestStateCoverage<TState>>;
  transitions: Record<string, TestTransitionCoverage<TState, TEvent>>;
}

export interface CoverageOptions<TContext> {
  filter?: (stateNode: StateNode<TContext, any, any>) => boolean;
}

export interface Criterion<TState, TEvent extends EventObject> {
  predicate: (coverage: TestModelCoverage<TState, TEvent>) => boolean;
  description: string;
  skip?: boolean;
}

export interface CriterionResult<TState, TEvent extends EventObject> {
  criterion: Criterion<TState, TEvent>;
  /**
   * Whether the criterion was covered or not
   */
  status: 'uncovered' | 'covered' | 'skipped';
}

export interface TestTransitionConfig<
  TContext,
  TEvent extends EventObject,
  TTestContext
> extends TransitionConfig<TContext, TEvent> {
  test?: (state: State<TContext, TEvent>, testContext: TTestContext) => void;
}

export type TestTransitionsConfigMap<
  TContext,
  TEvent extends EventObject,
  TTestContext
> = {
  [K in TEvent['type']]?:
    | TestTransitionConfig<
        TContext,
        TEvent extends { type: K } ? TEvent : never,
        TTestContext
      >
    | string;
} & {
  ''?: TestTransitionConfig<TContext, TEvent, TTestContext> | string;
} & {
  '*'?: TestTransitionConfig<TContext, TEvent, TTestContext> | string;
};

export interface TestStateNodeConfig<
  TContext,
  TEvent extends EventObject,
  TTestContext
> extends StateNodeConfig<TContext, any, TEvent> {
  test?: (state: State<TContext, TEvent>, testContext: TTestContext) => void;
  on?: TestTransitionsConfigMap<TContext, TEvent, TTestContext>;
}

export interface TestMachineConfig<
  TContext,
  TEvent extends EventObject,
  TTestContext
> extends MachineConfig<TContext, any, TEvent> {
  states?: {
    [key: string]: TestStateNodeConfig<TContext, TEvent, TTestContext>;
  };
}

export type PlanGenerator<TState, TEvent extends EventObject> = (
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
) => Array<StatePlan<TState, TEvent>>;
