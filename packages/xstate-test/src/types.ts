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
  ParameterizedObject,
  ActorInternalState
} from 'xstate';

type TODO = any;

export type GetPathsOptions<
  TSnapshot,
  TEvent extends EventObject,
  TInput,
  TOutput,
  TInternalState extends ActorInternalState<TSnapshot, TOutput>,
  TPersisted
> = Partial<
  TraversalOptions<TInternalState, TEvent> & {
    pathGenerator?: PathGenerator<
      TSnapshot,
      TEvent,
      TInput,
      TOutput,
      TInternalState,
      TPersisted
    >;
  }
>;

export interface TestMachineConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
> extends TestStateNodeConfig<TContext, TEvent> {
  context?: MachineConfig<TContext, TEvent>['context'];
  types?: MachineTypes<
    TContext,
    TEvent,
    TODO,
    TODO,
    TODO,
    TODO,
    TODO,
    TODO, // delays
    TODO, // tags
    TTypesMeta
  >;
}

export interface TestStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends Pick<
    StateNodeConfig<
      TContext,
      TEvent,
      TODO,
      TODO,
      ParameterizedObject,
      TODO,
      TODO,
      TODO
    >,
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
      any,
      ParameterizedObject,
      ParameterizedObject,
      string,
      string,
      TTypesMeta
    >,
    'actions' | 'guards'
  >
>;

export interface TestMeta<T, TContext extends MachineContext> {
  test?: (
    testContext: T,
    state: State<TContext, any, any, any, any, any>
  ) => Promise<void> | void;
  description?:
    | string
    | ((state: State<TContext, any, any, any, any, any>) => string);
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
export type EventExecutor<TInternalState, TEvent extends EventObject> = (
  step: Step<TInternalState, TEvent>
) => Promise<any> | void;

export interface TestModelOptions<
  TInternalState extends ActorInternalState<any, any>,
  TEvent extends EventObject
> extends TraversalOptions<TInternalState, TEvent> {
  stateMatcher: (state: TInternalState, stateKey: string) => boolean;
  logger: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
  serializeTransition: (
    state: TInternalState,
    event: TEvent | undefined,
    prevState?: TInternalState
  ) => string;
}

export interface TestTransitionConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTestContext
> extends TransitionConfig<TContext, TEvent, TEvent, TODO, TODO, TODO, string> {
  test?: (
    state: State<TContext, TEvent, any, any, any, any>,
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

export type PathGenerator<
  TSnapshot,
  TEvent extends EventObject,
  TInput,
  TOutput,
  TInternalState extends ActorInternalState<TSnapshot, TOutput>,
  TPersisted
> = (
  behavior: ActorLogic<
    TSnapshot,
    TEvent,
    TInput,
    TOutput,
    TInternalState,
    TPersisted
  >,
  options: TraversalOptions<TInternalState, TEvent>
) => Array<StatePath<TInternalState, TEvent>>;
