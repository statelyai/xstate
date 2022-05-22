import {
  SimpleBehavior,
  StatePath,
  Step,
  TraversalOptions
} from '@xstate/graph';
import {
  BaseActionObject,
  EventObject,
  ExtractEvent,
  MachineConfig,
  MachineOptions,
  MachineSchema,
  ServiceMap,
  State,
  StateNodeConfig,
  StateSchema,
  TransitionConfig,
  TypegenConstraint,
  TypegenDisabled
} from 'xstate';

export type GetPathsOptions<TState, TEvent extends EventObject> = Partial<
  TraversalOptions<TState, TEvent> & {
    pathGenerator?: PathGenerator<TState, TEvent>;
  }
>;

export interface TestMachineConfig<
  TContext,
  TEvent extends EventObject,
  TTypesMeta = TypegenDisabled
> extends TestStateNodeConfig<TContext, TEvent> {
  context?: MachineConfig<TContext, StateSchema, TEvent>['context'];
  schema?: MachineSchema<TContext, TEvent, ServiceMap>;
  tsTypes?: TTypesMeta;
}

export interface TestStateNodeConfig<TContext, TEvent extends EventObject>
  extends Pick<
    StateNodeConfig<TContext, StateSchema, TEvent>,
    | 'type'
    | 'history'
    | 'on'
    | 'onDone'
    | 'entry'
    | 'exit'
    | 'meta'
    | 'always'
    | 'data'
    | 'id'
    | 'tags'
    | 'description'
  > {
  initial?: string;
  states?: Record<string, TestStateNodeConfig<TContext, TEvent>>;
}

export type TestMachineOptions<
  TContext,
  TEvent extends EventObject,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
> = Pick<
  MachineOptions<TContext, TEvent, BaseActionObject, ServiceMap, TTypesMeta>,
  'actions' | 'guards'
>;

export interface TestMeta<T, TContext> {
  test?: (testContext: T, state: State<TContext, any>) => Promise<void> | void;
  description?: string | ((state: State<TContext, any>) => string);
  skip?: boolean;
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
export interface TestPath<TState, TEvent extends EventObject>
  extends StatePath<TState, TEvent> {
  description: string;
  /**
   * Tests and executes each step in `steps` sequentially, and then
   * tests the postcondition that the `state` is reached.
   */
  test: () => Promise<TestPathResult>;
  testSync: () => TestPathResult;
}
export interface TestPathResult {
  steps: TestStepResult[];
  state: TestStateResult;
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
type EventCase<TEvent extends EventObject> = Omit<TEvent, 'type'>;

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
  cases?: Array<EventCase<TEvent>>;
}

export type TestEventsConfig<TState, TEvent extends EventObject> = {
  [EventType in TEvent['type']]?:
    | EventExecutor<TState, TEvent>
    | TestEventConfig<TState, TEvent>;
};

export interface TestModelEventConfig<TState, TEvent extends EventObject> {
  cases?:
    | ((state: TState) => Array<EventCase<TEvent>>)
    | Array<EventCase<TEvent>>;
  exec?: EventExecutor<TState, TEvent>;
}

export interface TestModelOptions<TState, TEvent extends EventObject>
  extends TraversalOptions<TState, TEvent> {
  // testState: (state: TState) => void | Promise<void>;
  // testTransition: (step: Step<TState, TEvent>) => void | Promise<void>;
  /**
   * Executes actions based on the `state` after the state is tested.
   */
  execute: (state: TState) => void;
  getStates: () => TState[];
  stateMatcher: (state: TState, stateKey: string) => boolean;
  states: {
    [key: string]: (state: TState) => void | Promise<void>;
  };
  events: {
    [TEventType in TEvent['type']]?:
      | EventExecutor<TState, TEvent>
      | TestModelEventConfig<TState, ExtractEvent<TEvent, TEventType>>;
  };
  logger: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
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

export type PathGenerator<TState, TEvent extends EventObject> = (
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
) => Array<StatePath<TState, TEvent>>;
