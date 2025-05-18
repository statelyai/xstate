import { EventObject, Snapshot } from '../..';
import { TestModel } from '..';
import { TestParam, TestPath } from '..';

async function testModel<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
>(
  model: TestModel<TSnapshot, TEvent, TInput>,
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
