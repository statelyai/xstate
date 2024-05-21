import { StatePath, Step, TraversalOptions } from '@xstate/graph';
import {
  EventObject,
  StateNodeConfig,
  TransitionConfig,
  ExtractEvent,
  MachineContext,
  ActorLogic,
  ParameterizedObject,
  Snapshot,
  MachineSnapshot
} from 'xstate';

type TODO = any;

export type GetPathsOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = Partial<
  TraversalOptions<TSnapshot, TEvent, TInput> & {
    pathGenerator?: PathGenerator<TSnapshot, TEvent, TInput>;
  }
>;

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
      TODO,
      TODO, // emitted
      TODO // meta
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

export interface TestMeta<T, TContext extends MachineContext> {
  test?: (
    testContext: T,
    state: MachineSnapshot<
      TContext,
      any,
      any,
      any,
      any,
      any,
      any // TMeta
    >
  ) => Promise<void> | void;
  description?:
    | string
    | ((
        state: MachineSnapshot<
          TContext,
          any,
          any,
          any,
          any,
          any,
          any // TMeta
        >
      ) => string);
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

export interface TestParam<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  states?: {
    [key: string]: (state: TSnapshot) => void | Promise<void>;
  };
  events?: {
    [TEventType in TEvent['type']]?: EventExecutor<
      TSnapshot,
      { type: ExtractEvent<TEvent, TEventType>['type'] }
    >;
  };
}

export interface TestPath<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> extends StatePath<TSnapshot, TEvent> {
  description: string;
  /**
   * Tests and executes each step in `steps` sequentially, and then
   * tests the postcondition that the `state` is reached.
   */
  test: (params: TestParam<TSnapshot, TEvent>) => Promise<TestPathResult>;
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
export type EventExecutor<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = (step: Step<TSnapshot, TEvent>) => Promise<any> | void;

export interface TestModelOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> extends TraversalOptions<TSnapshot, TEvent, TInput> {
  stateMatcher: (state: TSnapshot, stateKey: string) => boolean;
  logger: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
  serializeTransition: (
    state: TSnapshot,
    event: TEvent | undefined,
    prevState?: TSnapshot
  ) => string;
}

export interface TestTransitionConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTestContext
> extends TransitionConfig<
    TContext,
    TEvent,
    TEvent,
    TODO,
    TODO,
    TODO,
    string,
    TODO, // TEmitted
    TODO // TMeta
  > {
  test?: (
    state: MachineSnapshot<
      TContext,
      TEvent,
      any,
      any,
      any,
      any,
      any // TMeta
    >,
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
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = (
  behavior: ActorLogic<TSnapshot, TEvent, TInput>,
  options: TraversalOptions<TSnapshot, TEvent, TInput>
) => Array<StatePath<TSnapshot, TEvent>>;
