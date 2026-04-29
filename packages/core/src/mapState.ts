import { isAtomicStateNode } from './stateUtils.ts';
import {
  AnyMachineSnapshot,
  AnyStateNode,
  StateSchema,
  StateSchemaFrom
} from './types.ts';

/**
 * A mapper object that defines how to transform a snapshot based on its state.
 * Can be nested to match the state hierarchy of the machine.
 */
type StateSchemaMapper<
  TSnapshot extends AnyMachineSnapshot,
  T extends StateSchema,
  TResult
> = {
  /** Maps the snapshot to a value when this state is active. */
  map?: (snapshot: TSnapshot) => TResult;
  /** Nested mappers for child states. */
  states?: {
    [K in keyof T['states']]?: T['states'][K] extends StateSchema
      ? StateSchemaMapper<TSnapshot, T['states'][K], TResult>
      : never;
  };
};

/**
 * Maps a machine snapshot to an array of result objects based on active states.
 *
 * Traverses all active state nodes (from atomic/leaf states up to root) and
 * collects results from matching `map` functions in the mapper object. Results
 * are ordered leaf-to-root (most specific state first).
 */
export function mapState<T extends AnyMachineSnapshot, TResult>(
  snapshot: T,
  mapper: StateSchemaMapper<T, StateSchemaFrom<T['machine']>, TResult>
): { stateNode: AnyStateNode; result: TResult }[] {
  const results: { stateNode: AnyStateNode; result: TResult }[] = [];

  const findMapper = (
    nodePath: string[]
  ): StateSchemaMapper<T, any, TResult> | undefined => {
    if (!nodePath.length) {
      // root
      return mapper;
    }
    let cursor = mapper;
    for (let i = 0; i < nodePath.length; i++) {
      const key = nodePath[i];
      if (!cursor?.states) {
        return undefined;
      }
      const states = cursor.states as Record<
        string,
        StateSchemaMapper<T, any, TResult>
      >;
      if (!(key in states)) {
        return undefined;
      }
      cursor = states[key];
      if (i === nodePath.length - 1) {
        return cursor;
      }
    }
  };

  const visited = new Set<AnyStateNode>();

  for (const atomicNode of snapshot._nodes.filter(isAtomicStateNode)) {
    let current: AnyStateNode | undefined = atomicNode;
    while (current && !visited.has(current)) {
      visited.add(current);

      const nodeMapper = findMapper(current.path);
      if (nodeMapper?.map) {
        results.push({ stateNode: current, result: nodeMapper.map(snapshot) });
      }

      current = current.parent;
    }
  }

  return results;
}
