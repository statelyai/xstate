import {
  getShortestPlans,
  getSimplePlans,
  getShortestPlansTo,
  getShortestPlansFromTo,
  getSimplePlansTo,
  getSimplePlansFromTo
} from '@xstate/graph';
import { EventObject } from 'xstate';
import { PathGenerator } from './types';
import { mapPlansToPaths } from './utils';

export const createShortestPathsGen = <
  TState,
  TEvent extends EventObject
>(): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const plans = getShortestPlans(behavior, defaultOptions);

  return mapPlansToPaths(plans);
};

export const createShortestPathsToGen = <TState, TEvent extends EventObject>(
  predicate: (state: TState) => boolean
): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const plans = getShortestPlansTo(behavior, predicate, defaultOptions);

  return mapPlansToPaths(plans);
};

export const createShortestPathsFromToGen = <
  TState,
  TEvent extends EventObject
>(
  fromStatePredicate: (state: TState) => boolean,
  toStatePredicate: (state: TState) => boolean
): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const plans = getShortestPlansFromTo(
    behavior,
    fromStatePredicate,
    toStatePredicate,
    defaultOptions
  );

  return mapPlansToPaths(plans);
};

export const createSimplePathsGen = <
  TState,
  TEvent extends EventObject
>(): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const plans = getSimplePlans(behavior, defaultOptions);

  return mapPlansToPaths(plans);
};

export const createSimplePathsToGen = <TState, TEvent extends EventObject>(
  predicate: (state: TState) => boolean
): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const plans = getSimplePlansTo(behavior, predicate, defaultOptions);

  return mapPlansToPaths(plans);
};

export const createSimplePathsFromToGen = <TState, TEvent extends EventObject>(
  fromStatePredicate: (state: TState) => boolean,
  toStatePredicate: (state: TState) => boolean
): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const plans = getSimplePlansFromTo(
    behavior,
    fromStatePredicate,
    toStatePredicate,
    defaultOptions
  );

  return mapPlansToPaths(plans);
};
