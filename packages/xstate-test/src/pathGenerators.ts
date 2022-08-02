import {
  SimpleBehavior,
  StatePath,
  TraversalOptions,
  traverseShortestPlans,
  traverseSimplePlans
} from '@xstate/graph';
import { EventObject } from 'xstate';
import { mapPlansToPaths } from './utils';

export const getShortestPaths = <TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
): Array<StatePath<TState, TEvent>> => {
  const plans = traverseShortestPlans(behavior, options);

  return mapPlansToPaths(plans);
};

export const getSimplePaths = <TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
): Array<StatePath<TState, TEvent>> => {
  const plans = traverseSimplePlans(behavior, options);

  return mapPlansToPaths(plans);
};
