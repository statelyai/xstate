import { EventObject } from 'xstate';
import { StatePath, StatePlan } from './types';

export const mapPlansToPaths = <TState, TEvent extends EventObject>(
  plans: StatePlan<TState, TEvent>[]
): Array<StatePath<TState, TEvent>> => {
  return plans.reduce((acc, plan) => {
    return acc.concat(plan.paths);
  }, [] as Array<StatePath<TState, TEvent>>);
};
