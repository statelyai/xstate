import { TestModel } from './TestModel';
import { TestPath } from './types';

const testModel = async (model: TestModel<any, any>) => {
  for (const path of model.getPaths()) {
    await path.test();
  }
};

const testPaths = async (paths: TestPath<any, any>[]) => {
  for (const path of paths) {
    await path.test();
  }
};

export const testUtils = {
  testPaths,
  testModel
};
