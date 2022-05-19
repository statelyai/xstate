import { StatePath } from '@xstate/graph';
import { TestModel } from './TestModel';

const testModel = async (model: TestModel<any, any>) => {
  for (const path of model.getPaths()) {
    await model.testPath(path);
  }
};

const testPaths = async (
  model: TestModel<any, any>,
  paths: StatePath<any, any>[]
) => {
  for (const path of paths) {
    await model.testPath(path);
  }
};

export const testUtils = {
  testPaths,
  testModel
};
