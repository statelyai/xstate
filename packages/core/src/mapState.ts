import { createActor } from './createActor';
import { setup } from './setup';
import {
  AnyMachineSnapshot,
  AnyStateNode,
  ContextFrom,
  MachineContext,
  StateSchema,
  StateSchemaFrom
} from './types';

type StateSchemaMapper<TC extends MachineContext, T extends StateSchema> = {
  map: (context: TC) => unknown;
  states?: {
    [K in keyof T['states']]?: T['states'][K] extends StateSchema
      ? StateSchemaMapper<TC, T['states'][K]>
      : never;
  };
};

export function mapState<T extends AnyMachineSnapshot>(
  snapshot: T,
  mapper: StateSchemaMapper<ContextFrom<T>, StateSchemaFrom<T['machine']>>
) {
  const results: unknown[] = [];

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
    currentMapper: StateSchemaMapper<
      ContextFrom<T>,
      StateSchemaFrom<T['machine']>
    >,
    nodePath: string[]
  ): StateSchemaMapper<ContextFrom<T>, any> | undefined => {
    let mapper: StateSchemaMapper<ContextFrom<T>, any> | undefined =
      currentMapper;

    // Traverse the node path forward (root to node) to find the nested mapper
    for (const key of nodePath) {
      if (!mapper?.states) {
        return undefined;
      }
      const states = mapper.states as Record<
        string,
        StateSchemaMapper<ContextFrom<T>, any>
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
    for (const node of pathToRoot) {
      // Get the path from root to this node (for mapper lookup)
      const nodePathFromRoot = node.path;

      // Find the mapper for this node
      const nodeMapper = findMapper(mapper, nodePathFromRoot);

      // If mapper exists, call map and add to results
      if (nodeMapper?.map) {
        results.push(nodeMapper.map(snapshot.context));
      }
    }
  }

  return results;
}

const machine = setup({}).createMachine({
  initial: 'a',
  states: {
    a: {
      initial: 'one',
      states: {
        one: {
          on: {
            NEXT: 'two'
          }
        },
        two: {}
      }
    },
    b: {
      on: {
        NEXT: 'c'
      }
    },
    c: {}
  }
});

mapState(createActor(machine).getSnapshot(), {
  map: (context) => context,
  states: {
    a: {
      map: (context) => context,
      states: {
        one: {
          map: (context) => context
        },
        two: {
          map: (context) => context
        }
      }
    }
  }
});
