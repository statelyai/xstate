import { EventObject, State } from 'xstate';
export interface TestMeta<T, TContext> {
  test?: (testContext: T, state: State<TContext>) => Promise<void> | void;
  description?: string | ((state: State<TContext>) => string);
  skip?: boolean;
}
interface TestSegment<T> {
  state: State<any>;
  event: EventObject;
  description: string;
  test: (testContext: T) => Promise<void>;
  exec: (testContext: T) => Promise<void>;
}
interface TestStateResult {
  error: null | Error;
}
export interface TestSegmentResult {
  segment: TestSegment<any>;
  state: TestStateResult;
  event: {
    error: null | Error;
  };
}
interface TestPath<T> {
  weight: number;
  segments: Array<TestSegment<T>>;
  description: string;
  /**
   * Tests and executes each segment in `segments` sequentially, and then
   * tests the postcondition that the `state` is reached.
   */
  test: (testContext: T) => Promise<TestPathResult>;
}
export interface TestPathResult {
  segments: TestSegmentResult[];
  state: TestStateResult;
}
export interface TestPlan<T, TContext> {
  state: State<TContext>;
  paths: Array<TestPath<T>>;
  description: string;
  /**
   * Tests the postcondition that the `state` is reached.
   *
   * This should be tested after navigating any path in `paths`.
   */
  test: (testContext: T) => Promise<void>;
}
interface EventCase {
  type?: never;
  [prop: string]: any;
}
export type StatePredicate<TContext> = (state: State<TContext, any>) => boolean;
export type EventExecutor<T> = (
  testContext: T,
  event: EventObject
) => Promise<any> | void;
export interface TestModelOptions<T> {
  events: {
    [eventType: string]:
      | EventExecutor<T>
      | {
          exec?: EventExecutor<T>;
          cases?: EventCase[];
        };
  };
}
export interface TestModelCoverage {
  stateNodes: Map<string, number>;
  transitions: Map<string, Map<EventObject, number>>;
}
