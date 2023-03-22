import { TestModel } from '../src/TestModel';
import { TestParam, TestPath } from '../src/types';

const testModel = async (
  model: TestModel<any, any>,
  params: TestParam<any, any>
) => {
  for (const path of model.getShortestPaths()) {
    await path.test(params);
  }
};

const testPaths = async (
  paths: TestPath<any, any>[],
  params: TestParam<any, any>
) => {
  for (const path of paths) {
    await path.test(params);
  }
};

export const testUtils = {
  testPaths,
  testModel
};
