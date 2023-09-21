import { ActorInternalState, EventObject } from 'xstate';
import { TestModel } from '../src/TestModel';
import { TestParam, TestPath } from '../src/types';

async function testModel<
  TSnapshot,
  TEvent extends EventObject,
  TInput,
  TOutput,
  TInternalState extends ActorInternalState<TSnapshot, TOutput>,
  TPersisted
>(
  model: TestModel<
    TSnapshot,
    TEvent,
    TInput,
    TOutput,
    TInternalState,
    TPersisted
  >,
  params: TestParam<TInternalState, TEvent>
) {
  for (const path of model.getShortestPaths()) {
    await path.test(params);
  }
}

async function testPaths<TInternalState, TEvent extends EventObject>(
  paths: TestPath<TInternalState, TEvent>[],
  params: TestParam<TInternalState, TEvent>
) {
  for (const path of paths) {
    await path.test(params);
  }
}

export const testUtils = {
  testPaths,
  testModel
};
