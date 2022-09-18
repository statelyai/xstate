import {
  SimpleBehavior,
  StatePath,
  TraversalOptions,
  getShortestPlans,
  getSimplePlans
} from '@xstate/graph';
import { EventObject } from 'xstate';
import { mapPlansToPaths } from './utils';

export const getShortestPaths = <TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
): Array<StatePath<TState, TEvent>> => {
  const plans = getShortestPlans(behavior, options);

  return mapPlansToPaths(plans);
};

export const getSimplePaths = <TState, TEvent extends EventObject>(
  behavior: SimpleBehavior<TState, TEvent>,
  options: TraversalOptions<TState, TEvent>
): Array<StatePath<TState, TEvent>> => {
  const plans = getSimplePlans(behavior, options);

  return mapPlansToPaths(plans);
};
