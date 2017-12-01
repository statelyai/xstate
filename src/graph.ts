import { StateNode } from "./index";
import { mapValues } from "./utils";

export interface IEdge {
  action: string;
  source: StateNode;
  target: StateNode;
}
export interface INodesAndEdges {
  nodes: StateNode[];
  edges: IEdge[];
}

export function getNodes(node: StateNode): StateNode[] {
  const { states } = node;
  const nodes = Object.keys(
    states
  ).reduce((accNodes: StateNode[], stateKey) => {
    const subState = states[stateKey];
    const subNodes = getNodes(states[stateKey]);

    accNodes.push(subState, ...subNodes);
    return accNodes;
  }, []);

  return nodes;
}

export function getEdges(
  node: StateNode,
  visited: Record<string, true> = {}
): IEdge[] {
  const { states } = node;
  visited[node.key] = true;
  const subNodeEdges = Object.keys(states).reduce((_edges: IEdge[], key) => {
    if (visited[key]) {
      return _edges;
    }

    const subState = states[key];
    _edges.push(...getEdges(subState, visited));
    visited[key] = true;
    return _edges;
  }, []);

  if (!node.on) {
    return subNodeEdges;
  }

  const edges = Object.keys(node.on).reduce((accEdges: IEdge[], action) => {
    if (!node.on || !node.parent) {
      return accEdges;
    }
    const subStateKey = node.on[action];
    const subNode = node.parent.getState(subStateKey) as StateNode;
    const edge: IEdge = { action, source: node, target: subNode };

    accEdges.push(edge);

    if (!visited[subStateKey]) {
      accEdges.push(...getEdges(subNode, visited));
      visited[subStateKey] = true;
    }

    return accEdges;
  }, []);

  return subNodeEdges.concat(edges);
}

export interface IPathMap {
  [key: string]: string[];
}

export interface IAdjacencyMap {
  [key: string]: Record<string, string>;
}

export function getAdjacencyMap(node: StateNode): IAdjacencyMap {
  const actionMap: Record<string, string> | undefined = node.parent
    ? {}
    : undefined;
  const adjacency: IAdjacencyMap = {};

  if (node.on) {
    for (const action of Object.keys(node.on)) {
      if (!node.parent || !actionMap) {
        continue;
      }

      const nextState = node.parent.getState(node.on[action]) as StateNode;
      let nextStateId = nextState.id;

      if (nextState.initial) {
        nextStateId += "." + nextState.initial;
      }

      actionMap[action] = nextStateId;
    }
  }

  if (actionMap) {
    adjacency[node.id] = actionMap;
  }

  if (node.states) {
    for (const stateKey of Object.keys(node.states)) {
      const state = node.states[stateKey];
      const stateAdjacency = mapValues(getAdjacencyMap(state), value => {
        return {
          ...actionMap,
          ...value
        };
      });

      Object.assign(adjacency, stateAdjacency);
    }
  }

  return adjacency;
}

export function getShortestPaths(machine: StateNode): IPathMap | undefined {
  if (!machine.states || !machine.initial) {
    return undefined;
  }
  const adjacency = getAdjacencyMap(machine);
  const initialId = machine.states[machine.initial].id;
  const pathMap = {
    [initialId]: []
  };

  shortestPaths(adjacency, initialId, pathMap);

  return pathMap;
}

export function shortestPaths(
  adjacency: IAdjacencyMap,
  stateId: string,
  pathMap: IPathMap,
  visited: Set<string> = new Set()
): IPathMap {
  visited.add(stateId);
  const actionMap = adjacency[stateId];
  for (const action of Object.keys(actionMap)) {
    const nextStateId = actionMap[action];
    if (
      !pathMap[nextStateId] ||
      pathMap[nextStateId].length > pathMap[stateId].length + 1
    ) {
      pathMap[nextStateId] = [...pathMap[stateId], stateId];
    }
  }

  for (const action of Object.keys(actionMap)) {
    const nextStateId = actionMap[action];

    if (visited.has(nextStateId)) {
      continue;
    }

    shortestPaths(adjacency, nextStateId, pathMap, visited);
  }

  return pathMap;
}
