import { StatePath } from '@xstate/graph';
import { EventObject, Snapshot } from 'xstate';
import { simpleStringify } from './utils.ts';

/**
 * Deduplicates your paths so that A -> B
 * is not executed separately to A -> B -> C
 */
export const deduplicatePaths = <
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  paths: StatePath<TSnapshot, TEvent>[],
  serializeEvent: (event: TEvent) => string = simpleStringify
): StatePath<TSnapshot, TEvent>[] => {
  /**
   * Put all paths on the same level so we can dedup them
   */
  const allPathsWithEventSequence: Array<{
    path: StatePath<TSnapshot, TEvent>;
    eventSequence: string[];
  }> = [];

  paths.forEach((path) => {
    allPathsWithEventSequence.push({
      path,
      eventSequence: path.steps.map((step) => serializeEvent(step.event))
    });
  });

  // Sort by path length, descending
  allPathsWithEventSequence.sort(
    (a, z) => z.path.steps.length - a.path.steps.length
  );

  const superpathsWithEventSequence: typeof allPathsWithEventSequence = [];

  /**
   * Filter out the paths that are subpaths of superpaths
   */
  pathLoop: for (const pathWithEventSequence of allPathsWithEventSequence) {
    // Check each existing superpath to see if the path is a subpath of it
    superpathLoop: for (const superpathWithEventSequence of superpathsWithEventSequence) {
      for (const i in pathWithEventSequence.eventSequence) {
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
          pathWithEventSequence.eventSequence[i] !==
          superpathWithEventSequence.eventSequence[i]
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
    superpathsWithEventSequence.push(pathWithEventSequence);
  }

  return superpathsWithEventSequence.map((path) => path.path);
};
