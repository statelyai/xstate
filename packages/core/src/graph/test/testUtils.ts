import { EventObject, Snapshot } from '../../index.ts';
import { TestModel, TestParam, TestPath, fromTestParam } from '../index.ts';

async function testModel<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
>(
  model: TestModel<TSnapshot, TEvent, TInput>,
  params: TestParam<TSnapshot, TEvent>
) {
  for (const path of model.getShortestPaths()) {
    await path.test({ sut: fromTestParam(params) });
  }
}

async function testPaths<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(paths: TestPath<TSnapshot, TEvent>[], params: TestParam<TSnapshot, TEvent>) {
  for (const path of paths) {
    await path.test({ sut: fromTestParam(params) });
  }
}

export const testUtils = {
  testPaths,
  testModel
};
