import {
  AnyMachineSnapshot,
  AnyStateNode,
  StateSchema,
  StateSchemaFrom
} from './types';

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
 * collects results from matching `map` functions in the mapper object.
 */
export function mapState<T extends AnyMachineSnapshot, TResult>(
  snapshot: T,
  mapper: StateSchemaMapper<T, StateSchemaFrom<T['machine']>, TResult>
): { stateNode: AnyStateNode; result: TResult }[] {
  const results: { stateNode: AnyStateNode; result: TResult }[] = [];

  // Helper to check if a node is atomic
  const isAtomicStateNode = (stateNode: AnyStateNode) =>
    stateNode.type === 'atomic' || stateNode.type === 'final';

  // Helper to get the path from a node to root (including the node itself)
  const getPathToRoot = (node: AnyStateNode): AnyStateNode[] => {
    const path: AnyStateNode[] = [node];
    let current: AnyStateNode | undefined = node.parent;
    while (current) {
      path.push(current);
      current = current.parent;
    }
    return path;
  };

  // Helper to find the mapper for a given node key path
  // nodePath is from root to the node (e.g., ['a', 'one'])
  const findMapper = (
    currentMapper: StateSchemaMapper<T, StateSchemaFrom<T['machine']>, TResult>,
    nodePath: string[]
  ): StateSchemaMapper<T, any, TResult> | undefined => {
    let mapper: StateSchemaMapper<T, any, TResult> | undefined = currentMapper;

    // Traverse the node path forward (root to node) to find the nested mapper
    for (const key of nodePath) {
      if (!mapper?.states) {
        return undefined;
      }
      const states = mapper.states as Record<
        string,
        StateSchemaMapper<T, any, TResult>
      >;
      if (!(key in states)) {
        return undefined;
      }
      mapper = states[key];
    }

    return mapper;
  };

  // Get all atomic nodes
  const atomicNodes = snapshot._nodes.filter(isAtomicStateNode);

  // For each atomic node, traverse up to root and collect mapping results
  for (const atomicNode of atomicNodes) {
    const pathToRoot = getPathToRoot(atomicNode);

    // Process from atomic node up to root
    for (const stateNode of pathToRoot) {
      // Get the path from root to this node (for mapper lookup)
      const nodePathFromRoot = stateNode.path;

      // Find the mapper for this node
      const nodeMapper = findMapper(mapper, nodePathFromRoot);

      // If mapper exists, call map and add to results
      if (nodeMapper?.map) {
        results.push({ stateNode, result: nodeMapper.map(snapshot) });
      }
    }
  }

  return results;
}
