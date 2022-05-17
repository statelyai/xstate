import { StatePlan } from '@xstate/graph';
import { TestModel } from './TestModel';

const testModel = async (model: TestModel<any, any>) => {
  for (const plan of model.getPlans()) {
    await model.testPlan(plan);
  }
};

const testPlans = async (
  model: TestModel<any, any>,
  plans: StatePlan<any, any>[]
) => {
  for (const plan of plans) {
    await model.testPlan(plan);
  }
};

export const testUtils = {
  testPlans,
  testModel
};
