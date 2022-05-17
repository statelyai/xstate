import { StatePath, StatePlan } from '@xstate/graph';
import { EventObject } from 'xstate';
import { PlanGenerator } from './types';

/**
 * Deduplicates your path plans so that A -> B
 * is not executed separately to A -> B -> C
 */
export const planGeneratorWithDedup = <TState, TEvent extends EventObject>(
  planGenerator: PlanGenerator<TState, TEvent>
): PlanGenerator<TState, TEvent> => (behavior, options) => {
  const pathPlans = planGenerator(behavior, options);

  /**
   * Put all plans on the same level so we can dedup them
   */
  const allPathsWithPlan: Array<{
    path: StatePath<TState, TEvent>;
    planIndex: number;
    eventSequence: string[];
  }> = [];

  pathPlans.forEach((plan, index) => {
    plan.paths.forEach((path) => {
      allPathsWithPlan.push({
        path,
        planIndex: index,
        eventSequence: path.steps.map((step) =>
          options.serializeEvent(step.event)
        )
      });
    });
  });

  // Sort by path length, descending
  allPathsWithPlan.sort((a, z) => z.path.steps.length - a.path.steps.length);

  const superpathsWithPlan: typeof allPathsWithPlan = [];

  /**
   * Filter out the paths that are subpaths of superpaths
   */
  pathLoop: for (const pathWithPlan of allPathsWithPlan) {
    // Check each existing superpath to see if the path is a subpath of it
    superpathLoop: for (const superpathWithPlan of superpathsWithPlan) {
      for (const i in pathWithPlan.eventSequence) {
        // Check event sequence to determine if path is subpath, e.g.:
        //
        // This will short-circuit the check
        // ['a', 'b', 'c', 'd'] (superpath)
        // ['a', 'b', 'x']      (path)
        //
        // This will not short-circuit; path is subpath
        // ['a', 'b', 'c', 'd'] (superpath)
        // ['a', 'b', 'c']      (path)
        if (
          pathWithPlan.eventSequence[i] !== superpathWithPlan.eventSequence[i]
        ) {
          // If the path is different from the superpath,
          // continue to the next superpath
          continue superpathLoop;
        }
      }

      // If we reached here, path is subpath of superpath
      // Continue & do not add path to superpaths
      continue pathLoop;
    }

    // If we reached here, path is not a subpath of any existing superpaths
    // So add it to the superpaths
    superpathsWithPlan.push(pathWithPlan);
  }

  const newPathPlans = pathPlans
    .map(
      (plan, index): StatePlan<TState, TEvent> => {
        /**
         * Grab the paths which were originally related
         * to this planIndex
         */
        const newPaths = superpathsWithPlan
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
