import { Step, TraversalOptions } from '@xstate/graph';
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
export type EventExecutor<T> = (
  /**
   * The testing context used to execute the effect
   */
  testContext: T,
  /**
   * The represented event that will be triggered when executed
   */
  event: EventObject
) => Promise<any> | void;

export interface TestEventConfig<TTestContext> {
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
  exec?: EventExecutor<TTestContext>;
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

export interface TestEventsConfig<TTestContext> {
  [eventType: string]:
    | EventExecutor<TTestContext>
    | TestEventConfig<TTestContext>;
}

export interface TestModelOptions<
  TState,
  TEvent extends EventObject,
  TTestContext
> extends TraversalOptions<TState, TEvent> {
  testState: (state: TState, testContext: TTestContext) => void | Promise<void>;
  testTransition: (
    step: Step<TState, TEvent>,
    testContext: TTestContext
  ) => void | Promise<void>;
  /**
   * Executes actions based on the `state` after the state is tested.
   */
  execute: (state: TState, testContext: TTestContext) => void | Promise<void>;
  getStates: () => TState[];
  events: {
    [TEventType in TEvent['type']]?: {
      cases?: () => Array<
        | Omit<ExtractEvent<TEvent, TEventType>, 'type'>
        | ExtractEvent<TEvent, TEventType>
      >;
      exec?: EventExecutor<TTestContext>;
    };
  };
  logger: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface TestStateCoverage<TState> {
  state: TState;
  /**
   * Number of times state was visited
   */
  count: number;
}

export interface TestModelCoverage<TState> {
  states: Record<string, TestStateCoverage<TState>>;
  transitions: Record<string, Map<EventObject, number>>;
}

export interface CoverageOptions<TContext> {
  filter?: (stateNode: StateNode<TContext, any, any>) => boolean;
}

export interface Criterion<TState> {
  predicate: (stateCoverage: TestStateCoverage<TState>) => boolean;
  description: string;
  skip?: boolean;
}

export interface CriterionResult<TState> {
  criterion: Criterion<TState>;
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
