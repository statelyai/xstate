import { StateNode } from './index';
import { toTrie } from './utils';
import { Transition, StateValue, Machine, Event } from './types';

const EMPTY_MAP = {};
export interface IEdge {
  event: string;
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

function getTransitionStateKeys(transition: Transition): string[] {
  if (typeof transition === 'string') {
    return [transition];
  }

  return Object.keys(transition) as string[];
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

  const edges = Object.keys(node.on).reduce((accEdges: IEdge[], event) => {
    if (!node.on || !node.parent) {
      return accEdges;
    }

    const { parent } = node;

    const transition = node.on[event];

    if (!transition) {
      return accEdges;
    }

    const subStateKeys = getTransitionStateKeys(transition);
    subStateKeys.forEach(subStateKey => {
      const subNode = parent.getState(subStateKey) as StateNode;
      const edge: IEdge = { event, source: node, target: subNode };

      accEdges.push(edge);

      if (!visited[subStateKey]) {
        accEdges.push(...getEdges(subNode, visited));
        visited[subStateKey] = true;
      }
    });

    return accEdges;
  }, []);

  return subNodeEdges.concat(edges);
}

export interface Segment {
  state: StateValue;
  event: Event;
}

export interface IPathMap {
  [key: string]: Segment[];
}

export interface IPathItem {
  state: StateValue;
  path: Segment[];
}

export interface IPathsItem {
  state: StateValue;
  paths: Segment[][];
}

export interface IPathsMap {
  [key: string]: Segment[][];
}

export interface ITransitionMap {
  state: StateValue | undefined;
}

export interface IAdjacencyMap {
  [stateId: string]: Record<string, ITransitionMap>;
}

export function getAdjacencyMap(node: Machine): IAdjacencyMap {
  const adjacency: IAdjacencyMap = {};

  const events = node.events;

  function findAdjacencies(stateValue: StateValue) {
    const stateKey = JSON.stringify(stateValue);

    if (adjacency[stateKey]) {
      return;
    }

    adjacency[stateKey] = {};

    for (const event of events) {
      const nextState = node.transition(stateValue, event);
      adjacency[stateKey][event] = { state: nextState.value };

      findAdjacencies(nextState.value);
    }
  }

  findAdjacencies(node.initialState.value);

  return adjacency;
}

export function getShortestPaths(machine: Machine): IPathMap {
  if (!machine.states) {
    return EMPTY_MAP;
  }
  const adjacency = getAdjacencyMap(machine);
  const initialStateId = JSON.stringify(machine.initialState.value);
  const pathMap: IPathMap = {
    [initialStateId]: []
  };
  const visited: Set<string> = new Set();

  function util(stateValue: StateValue): IPathMap {
    const stateId = JSON.stringify(stateValue);
    visited.add(stateId);
    const eventMap = adjacency[stateId];

    for (const event of Object.keys(eventMap)) {
      const nextStateValue = eventMap[event].state;

      if (!nextStateValue) {
        continue;
      }

      const nextStateId = JSON.stringify(toTrie(nextStateValue));

      if (
        !pathMap[nextStateId] ||
        pathMap[nextStateId].length > pathMap[stateId].length + 1
      ) {
        pathMap[nextStateId] = [
          ...(pathMap[stateId] || []),
          { state: stateValue, event }
        ];
      }
    }

    for (const event of Object.keys(eventMap)) {
      const nextStateValue = eventMap[event].state;

      if (!nextStateValue) {
        continue;
      }

      const nextStateId = JSON.stringify(nextStateValue);

      if (visited.has(nextStateId)) {
        continue;
      }

      util(nextStateValue);
    }

    return pathMap;
  }

  util(machine.initialState.value);

  return pathMap;
}

export function getShortestPathsAsArray(machine: Machine): IPathItem[] {
  const result = getShortestPaths(machine);
  return Object.keys(result).map(key => ({
    state: JSON.parse(key),
    path: result[key]
  }));
}

export function getSimplePaths(machine: Machine): IPathsMap {
  if (!machine.states) {
    return EMPTY_MAP;
  }

  const adjacency = getAdjacencyMap(machine);
  const visited = new Set();
  const path: Segment[] = [];
  const paths: IPathsMap = {};

  function util(fromPathId: string, toPathId: string) {
    visited.add(fromPathId);

    if (fromPathId === toPathId) {
      paths[toPathId] = paths[toPathId] || [];
      paths[toPathId].push([...path]);
    } else {
      for (const subEvent of Object.keys(adjacency[fromPathId])) {
        const nextStateValue = adjacency[fromPathId][subEvent].state;

        if (!nextStateValue) {
          continue;
        }

        const nextStateId = JSON.stringify(nextStateValue);

        if (!visited.has(nextStateId)) {
          path.push({ state: JSON.parse(fromPathId), event: subEvent });
          util(nextStateId, toPathId);
        }
      }
    }

    path.pop();
    visited.delete(fromPathId);
  }

  const initialStateId = JSON.stringify(machine.initialState.value);

  Object.keys(adjacency).forEach(nextStateId => {
    util(initialStateId, nextStateId);
  });

  return paths;
}

export function getSimplePathsAsArray(machine: Machine): IPathsItem[] {
  const result = getSimplePaths(machine);
  return Object.keys(result).map(key => ({
    state: JSON.parse(key),
    paths: result[key]
  }));
}
