import { AnyStateNode } from '@xstate/graph';
import type { AnyState } from 'xstate';
import { getAllStateNodes } from 'xstate/lib/stateUtils';
import { TestModel } from './TestModel';
import { Criterion } from './types';

interface StateValueCoverageOptions {
  filter?: (stateNode: AnyStateNode) => boolean;
}

export function stateValueCoverage(
  options?: StateValueCoverageOptions
): (testModel: TestModel<AnyState, any, any>) => Array<Criterion<AnyState>> {
  const resolvedOptions: Required<StateValueCoverageOptions> = {
    filter: () => true,
    ...options
  };

  return (testModel) => {
    const allStateNodes = getAllStateNodes(testModel.behavior as AnyStateNode);

    return allStateNodes.map((stateNode) => {
      const skipped = !resolvedOptions.filter(stateNode);

      return {
        predicate: (stateCoverage) =>
          stateCoverage.state.configuration.includes(stateNode),
        description: `Visits ${JSON.stringify(stateNode.id)}`,
        skipped
      };
    });
  };
}
