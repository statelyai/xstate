import { StatePath, StatePlan } from '@xstate/graph';
import { EventObject } from 'xstate';
import { PlanGenerator } from './types';

/**
 * Deduplicates your path plans so that A -> B
 * is not executed separately to A -> B -> C
 */
export const addDedupToPlanGenerator = <TState, TEvent extends EventObject>(
  planGenerator: PlanGenerator<TState, TEvent>
): PlanGenerator<TState, TEvent> => (behavior, options) => {
  const pathPlans = planGenerator(behavior, options);

  /**
   * Put all plans on the same level so we can dedup them
   */
  const allPathsWithPlan: {
    path: StatePath<TState, TEvent>;
    planIndex: number;
    serialisedSteps: string[];
  }[] = [];

  pathPlans.forEach((plan, index) => {
    plan.paths.forEach((path) => {
      allPathsWithPlan.push({
        path,
        planIndex: index,
        serialisedSteps: path.steps.map((step) =>
          options.serializeEvent(step.event)
        )
      });
    });
  });

  /**
   * Filter out the paths that are just shorter versions
   * of other paths
   */
  const filteredPaths = allPathsWithPlan.filter((path) => {
    if (path.serialisedSteps.length === 0) return false;

    /**
     * @example
     * { type: 'EVENT_1' }{ type: 'EVENT_2' }
     */
    const concatenatedPath = path.serialisedSteps.join('');

    return !allPathsWithPlan.some((pathToCompare) => {
      const concatenatedPathToCompare = pathToCompare.serialisedSteps.join('');
      /**
       * Filter IN (return false) if it's the same as the current plan,
       * because it's not a valid comparison
       */
      if (concatenatedPathToCompare === concatenatedPath) {
        return false;
      }

      /**
       * Filter IN (return false) if the plan to compare against has length 0
       */
      if (pathToCompare.serialisedSteps.length === 0) {
        return false;
      }

      /**
       * We filter OUT (return true) if the segment to compare includes
       * our current segment
       */
      return concatenatedPathToCompare.includes(concatenatedPath);
    });
  });

  const newPathPlans = pathPlans
    .map(
      (plan, index): StatePlan<TState, TEvent> => {
        /**
         * Grab the paths which were originally related
         * to this planIndex
         */
        const newPaths = filteredPaths
          .filter(({ planIndex }) => planIndex === index)
          .map(({ path }) => path);
        return {
          state: plan.state,
          paths: newPaths
        };
      }
    )
    /**
     * Filter out plans which don't have any unique paths
     */
    .filter((plan) => plan.paths.length > 0);

  return newPathPlans;
};
