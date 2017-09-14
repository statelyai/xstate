import { StateNode } from './index';
import { mapValues } from './utils';

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
  const nodes = Object.keys(node.states).reduce((accNodes, stateKey) => {
    const subState = node.states[stateKey];
    const subNodes = getNodes(node.states[stateKey]);

    accNodes.push(subState, ...subNodes);
    return accNodes;
  }, []);

  return nodes;
}

export function getEdges(
  node: StateNode,
  visited: Record<string, true> = {}
): IEdge[] {
  visited[node.key] = true;
  const subNodeEdges = Object.keys(node.states).reduce((edges, key) => {
    if (visited[key]) {
      return edges;
    }

    const subState = node.states[key];
    edges.push(...getEdges(subState, visited));
    visited[key] = true;
    return edges;
  }, []);

  if (!node.on) {
    return subNodeEdges;
  }

  const edges = Object.keys(node.on).reduce((accEdges, action) => {
    const subStateKey = node.on[action];
    const subNode = node.parent.getState(subStateKey);
    const edge = { action, source: node, target: subNode };

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
  const actionMap: Record<string, string> = node.parent ? {} : undefined;
  const adjacency: IAdjacencyMap = {};

  if (node.on) {
    for (const action of Object.keys(node.on)) {
      const nextState = node.parent.getState(node.on[action]);
      let nextStateId = nextState.id;

      if (nextState.initial) {
        nextStateId += '.' + nextState.initial;
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

export function getShortestPaths(machine: StateNode): IPathMap {
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
