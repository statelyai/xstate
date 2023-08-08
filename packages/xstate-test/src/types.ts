import { StatePath, Step, TraversalOptions } from '@xstate/graph';
import {
  EventObject,
  MachineConfig,
  MachineTypes,
  State,
  StateNodeConfig,
  TransitionConfig,
  TypegenConstraint,
  TypegenDisabled,
  ExtractEvent,
  MachineImplementations,
  MachineContext,
  ActorLogic,
  ParameterizedObject
} from 'xstate';

type TODO = any;

export type GetPathsOptions<TState, TEvent extends EventObject> = Partial<
  TraversalOptions<TState, TEvent> & {
    pathGenerator?: PathGenerator<TState, TEvent>;
  }
>;

export interface TestMachineConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
> extends TestStateNodeConfig<TContext, TEvent> {
  context?: MachineConfig<TContext, TEvent>['context'];
  types?: MachineTypes<TContext, TEvent, TODO, TTypesMeta>;
}

export interface TestStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends Pick<
    StateNodeConfig<TContext, TEvent, TODO, TODO, TODO>,
    | 'type'
    | 'history'
    | 'on'
    | 'onDone'
    | 'entry'
    | 'exit'
    | 'meta'
    | 'always'
    | 'output'
    | 'id'
    | 'tags'
    | 'description'
  > {
  initial?: string;
  states?: Record<string, TestStateNodeConfig<TContext, TEvent>>;
}

export type TestMachineOptions<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
> = Partial<
  Pick<
    MachineImplementations<
      TContext,
      TEvent,
      ParameterizedObject,
      any,
      TTypesMeta
    >,
    'actions' | 'guards'
  >
>;

export interface TestMeta<T, TContext extends MachineContext> {
  test?: (
    testContext: T,
    state: State<TContext, any, any, any>
  ) => Promise<void> | void;
  description?: string | ((state: State<TContext, any, any, any>) => string);
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

export interface TestParam<TState, TEvent extends EventObject> {
  states?: {
    [key: string]: (state: TState) => void | Promise<void>;
  };
  events?: {
    [TEventType in TEvent['type']]?: EventExecutor<
      TState,
      { type: ExtractEvent<TEvent, TEventType>['type'] }
    >;
  };
}

export interface TestPath<TState, TEvent extends EventObject>
  extends StatePath<TState, TEvent> {
  description: string;
  /**
   * Tests and executes each step in `steps` sequentially, and then
   * tests the postcondition that the `state` is reached.
   */
  test: (params: TestParam<TState, TEvent>) => Promise<TestPathResult>;
  testSync: (params: TestParam<TState, TEvent>) => TestPathResult;
}
export interface TestPathResult {
  steps: TestStepResult[];
  state: TestStateResult;
}

export type StatePredicate<TState> = (state: TState) => boolean;
/**
 * Executes an effect using the `testContext` and `event`
 * that triggers the represented `event`.
 */
export type EventExecutor<TState, TEvent extends EventObject> = (
  step: Step<TState, TEvent>
) => Promise<any> | void;

export interface TestModelOptions<TState, TEvent extends EventObject>
  extends TraversalOptions<TState, TEvent> {
  stateMatcher: (state: TState, stateKey: string) => boolean;
  logger: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
  serializeTransition: (
    state: TState,
    event: TEvent | undefined,
    prevState?: TState
  ) => string;
}

export interface TestTransitionConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTestContext
> extends TransitionConfig<TContext, TEvent> {
  test?: (
    state: State<TContext, TEvent, any, any>,
    testContext: TTestContext
  ) => void;
}

export type TestTransitionsConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTestContext
> = {
  [K in TEvent['type'] | '' | '*']?: K extends '' | '*'
    ? TestTransitionConfig<TContext, TEvent, TTestContext> | string
    :
        | TestTransitionConfig<TContext, ExtractEvent<TEvent, K>, TTestContext>
        | string;
};

export type PathGenerator<TState, TEvent extends EventObject> = (
  behavior: ActorLogic<TEvent, TState>,
  options: TraversalOptions<TState, TEvent>
) => Array<StatePath<TState, TEvent>>;
