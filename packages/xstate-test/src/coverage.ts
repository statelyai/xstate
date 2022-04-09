import { AnyStateNode } from '@xstate/graph';
import type { AnyState, EventObject } from 'xstate';
import { getAllStateNodes } from 'xstate/lib/stateUtils';
import { flatten } from './utils';
import { TestModel } from './TestModel';
import { Criterion } from './types';

interface StateValueCoverageOptions {
  filter?: (stateNode: AnyStateNode) => boolean;
}

export type CoverageFunction<TState, TEvent extends EventObject> = (
  testModel: TestModel<TState, TEvent>
) => Array<Criterion<TState, TEvent>>;

export function coversAllStates<
  TState extends AnyState,
  TEvent extends EventObject
>(options?: StateValueCoverageOptions): CoverageFunction<TState, TEvent> {
  const resolvedOptions: Required<StateValueCoverageOptions> = {
    filter: () => true,
    ...options
  };

  return (testModel) => {
    const allStateNodes = getAllStateNodes(
      (testModel.behavior as unknown) as AnyStateNode
    );

    return allStateNodes.map((stateNode) => {
      const skip = !resolvedOptions.filter(stateNode);

      return {
        predicate: (coverage) =>
          Object.values(coverage.states).some(({ state }) =>
            state.configuration.includes(stateNode)
          ),
        description: `Visits ${JSON.stringify(stateNode.id)}`,
        skip
      };
    });
  };
}

export function coversAllTransitions<
  TState extends AnyState,
  TEvent extends EventObject
>(): CoverageFunction<TState, TEvent> {
  return (testModel) => {
    const allStateNodes = getAllStateNodes(
      (testModel.behavior as unknown) as AnyStateNode
    );
    const allTransitions = flatten(allStateNodes.map((sn) => sn.transitions));

    return allTransitions.map((t) => {
      return {
        predicate: (coverage) =>
          Object.values(coverage.transitions).some((transitionCoverage) => {
            return (
              transitionCoverage.step.state.configuration.includes(t.source) &&
              t.eventType === transitionCoverage.step.event.type
            );
          }),
        description: `Transitions ${t.source.key} on event ${t.eventType}`
      };
    });
    // return flatten(
    //   allStateNodes.map((sn) => {
    //     const transitions = sn.transitions;
    //     const transitionSerial = `${this.options.serializeState(
    //       step.state,
    //       null as any
    //     )} | ${this.options.serializeEvent(step.event)}`;

    //     return {
    //       predicate: () => true,
    //       description: ''
    //     };
    //   })
    // );

    // return [];
  };
}
