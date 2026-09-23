import { StatePath } from './index.ts';
import { EventObject, Snapshot } from '../index.ts';
import { simpleStringify } from './utils.ts';

interface EventTrieNode {
  readonly children: Map<string, EventTrieNode>;
}

/**
 * Deduplicates your paths so that A -> B is not executed separately to A -> B
 * -> C
 *
 * Paths are returned longest first (stable for equal lengths). A path is
 * dropped when its event sequence is a prefix of, or equal to, the event
 * sequence of a path already kept.
 */
export const deduplicatePaths = <
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  paths: StatePath<TSnapshot, TEvent>[],
  serializeEvent: (event: TEvent) => string = simpleStringify
): StatePath<TSnapshot, TEvent>[] => {
  const pathsWithEventSequence = paths.map((path) => ({
    path,
    eventSequence: path.steps.map((step) => serializeEvent(step.event))
  }));

  // Sort by path length, descending (stable), so every kept path is at least
  // as long as any path checked against it.
  pathsWithEventSequence.sort(
    (a, z) => z.path.steps.length - a.path.steps.length
  );

  // Trie of the event sequences of kept paths: a path is a prefix of a kept
  // path exactly when its whole sequence can be walked from the root.
  const root: EventTrieNode = { children: new Map() };
  const kept: StatePath<TSnapshot, TEvent>[] = [];

  for (const { path, eventSequence } of pathsWithEventSequence) {
    let node: EventTrieNode | undefined = root;
    for (const event of eventSequence) {
      node = node.children.get(event);
      if (!node) {
        break;
      }
    }
    if (node && kept.length > 0) {
      continue;
    }

    let insertAt = root;
    for (const event of eventSequence) {
      let child = insertAt.children.get(event);
      if (!child) {
        child = { children: new Map() };
        insertAt.children.set(event, child);
      }
      insertAt = child;
    }
    kept.push(path);
  }

  return kept;
};
