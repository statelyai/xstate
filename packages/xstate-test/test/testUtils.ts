import { EventObject, Snapshot } from 'xstate';
import { TestModel } from '../src/TestModel';
import { TestParam, TestPath } from '../src/types';

async function testModel<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TPersisted
>(
  model: TestModel<TSnapshot, TEvent, TInput, TPersisted>,
  params: TestParam<TSnapshot, TEvent>
) {
  for (const path of model.getShortestPaths()) {
    await path.test(params);
  }
}

async function testPaths<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(paths: TestPath<TSnapshot, TEvent>[], params: TestParam<TSnapshot, TEvent>) {
  for (const path of paths) {
    await path.test(params);
  }
}

export const testUtils = {
  testPaths,
  testModel
};
