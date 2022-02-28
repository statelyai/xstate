import type { AnyState } from 'xstate';
import { TestModel } from './TestModel';
import { Criterion } from './types';

export function stateValueCoverage(): (
  testModel: TestModel<AnyState, any, any>
) => Array<Criterion<AnyState>> {
  return (testModel) => {
    const allStates = testModel.getAllStates();

    return allStates.map((state) => ({
      predicate: (testedState) => testedState.matches(state.value),
      description: `Matches ${JSON.stringify(state.value)}`
    }));
  };
}
