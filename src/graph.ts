import { StateNode } from './index';
import { toStateValue, getActionType } from './utils';
import {
  StateValue,
  Machine,
  Edge,
  Segment,
  PathMap,
  PathItem,
  PathsItem,
  PathsMap,
  AdjacencyMap
} from './types';

const EMPTY_MAP = {};

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

function getEventEdges(node: StateNode, event: string): Edge[] {
  const transitions = node.on[event]!;

  return transitions.map(transition => {
    return {
      source: node,
      target: node.parent!.getState(transition.target)!,
      event,
      actions: transition.actions ? transition.actions.map(getActionType) : [],
      cond: transition.cond
    };
  });
}

export function getEdges(node: StateNode): Edge[] {
  const edges: Edge[] = [];

  if (node.states) {
    Object.keys(node.states).forEach(stateKey => {
      edges.push(...getEdges(node.states[stateKey]));
    });
  }

  Object.keys(node.on).forEach(event => {
    edges.push(...getEventEdges(node, event));
  });

  return edges;
}

export function getAdjacencyMap(node: Machine): AdjacencyMap {
  const adjacency: AdjacencyMap = {};

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

export function getShortestPaths(machine: Machine): PathMap {
  if (!machine.states) {
    return EMPTY_MAP;
  }
  const adjacency = getAdjacencyMap(machine);
  const initialStateId = JSON.stringify(machine.initialState.value);
  const pathMap: PathMap = {
    [initialStateId]: []
  };
  const visited: Set<string> = new Set();

  function util(stateValue: StateValue): PathMap {
    const stateId = JSON.stringify(stateValue);
    visited.add(stateId);
    const eventMap = adjacency[stateId];

    for (const event of Object.keys(eventMap)) {
      const nextStateValue = eventMap[event].state;

      if (!nextStateValue) {
        continue;
      }

      const nextStateId = JSON.stringify(
        toStateValue(nextStateValue, machine.delimiter)
      );

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

export function getShortestPathsAsArray(machine: Machine): PathItem[] {
  const result = getShortestPaths(machine);
  return Object.keys(result).map(key => ({
    state: JSON.parse(key),
    path: result[key]
  }));
}

export function getSimplePaths(machine: Machine): PathsMap {
  if (!machine.states) {
    return EMPTY_MAP;
  }

  const adjacency = getAdjacencyMap(machine);
  const visited = new Set();
  const path: Segment[] = [];
  const paths: PathsMap = {};

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

export function getSimplePathsAsArray(machine: Machine): PathsItem[] {
  const result = getSimplePaths(machine);
  return Object.keys(result).map(key => ({
    state: JSON.parse(key),
    paths: result[key]
  }));
}
