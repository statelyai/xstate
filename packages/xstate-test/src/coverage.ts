import { AnyStateNode } from '@xstate/graph';
import type { AnyState } from 'xstate';
import { getAllStateNodes } from 'xstate/lib/stateUtils';
import { TestModel } from './TestModel';
import { Criterion } from './types';

export function stateValueCoverage(): (
  testModel: TestModel<AnyState, any, any>
) => Array<Criterion<AnyState>> {
  return (testModel) => {
    const allStateNodes = getAllStateNodes(testModel.behavior as AnyStateNode);

    return allStateNodes.map((stateNode) => ({
      predicate: (stateCoverage) =>
        stateCoverage.state.configuration.includes(stateNode),
      description: `Visits ${JSON.stringify(stateNode.id)}`
    }));
  };
}
