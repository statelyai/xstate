import { StateNode } from './index';
import { mapValues } from './utils';
import { Transition, StateValue } from './types';

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

function getTransitionStateKeys<TStateKey extends string = string>(
  transition: Transition<TStateKey>
): TStateKey[] {
  if (typeof transition === 'string') {
    return [transition];
  }

  return Object.keys(transition) as TStateKey[];
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

export interface IPathMap {
  [key: string]: Array<{ state: string; event: string }>;
}

export interface ITransitionMap {
  state: StateValue | undefined;
}

export interface IAdjacencyMap {
  [stateId: string]: Record<string, ITransitionMap>;
}

export function getAdjacencyMap(node: StateNode): IAdjacencyMap {
  const eventMap: Record<string, ITransitionMap> | undefined = node.parent
    ? {}
    : undefined;
  const adjacency: IAdjacencyMap = {};

  if (node.on) {
    for (const event of Object.keys(node.on)) {
      if (!node.parent || !eventMap) {
        continue;
      }

      const nextState = node.machine.transition(node.relativeId, event);

      if (!nextState) {
        continue;
      }

      eventMap[event] = { state: nextState.value };

      // const transitionConfig = node.on[event];
      // const subStateKeys = getTransitionStateKeys(transitionConfig);

      // if (!subStateKeys.length) {
      //   continue;
      // }

      // // for non-conditional adjacency maps, just return first substate
      // const nextState = node.parent.getState(subStateKeys[0]) as StateNode;
      // let nextStateId = nextState.id;

      // if (nextState.initial) {
      //   nextStateId += '.' + nextState.initial;
      // }

      // eventMap[event] = nextStateId;
    }
  }

  if (eventMap) {
    adjacency[node.relativeId] = eventMap;
  }

  if (node.states) {
    for (const stateKey of Object.keys(node.states)) {
      const state = node.states[stateKey];
      const stateAdjacency = mapValues(getAdjacencyMap(state), value => {
        return {
          ...eventMap,
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
  const initialId = trieToString(machine.initialState as StateValue);
  const pathMap = {
    [initialId]: []
  };

  shortestPaths(adjacency, initialId, pathMap);

  return pathMap;
}

function trieToString(trie: StateValue): string {
  if (typeof trie === 'string') {
    return trie;
  }

  const firstKey = Object.keys(trie)[0] as string;

  return [firstKey].concat(trieToString(trie[firstKey])).join('.');
}

function shortestPaths(
  adjacency: IAdjacencyMap,
  stateId: string,
  pathMap: IPathMap,
  visited: Set<string> = new Set()
): IPathMap {
  visited.add(stateId);
  const eventMap = adjacency[stateId];

  for (const event of Object.keys(eventMap)) {
    const nextStateValue = eventMap[event].state;

    if (!nextStateValue) {
      continue;
    }

    const nextStateId = trieToString(nextStateValue);

    if (
      !pathMap[nextStateId] ||
      pathMap[nextStateId].length > pathMap[stateId].length + 1
    ) {
      pathMap[nextStateId] = [...pathMap[stateId], { state: stateId, event }];
    }
  }

  for (const event of Object.keys(eventMap)) {
    const nextStateValue = eventMap[event].state;

    if (!nextStateValue) {
      continue;
    }

    const nextStateId = trieToString(nextStateValue);

    if (visited.has(nextStateId)) {
      continue;
    }

    shortestPaths(adjacency, nextStateId, pathMap, visited);
  }

  return pathMap;
}

export function getSimplePaths(machine: StateNode): void {
  if (!machine.states || !machine.initial) {
    return undefined;
  }

  const adjacency = getAdjacencyMap(machine);
  const visited = new Set();
  const paths: string[] = [];

  // console.log({ adjacency });

  function util(fromPathId: string, toPathId: string) {
    // console.log({ fromPathId, toPathId });
    visited.add(fromPathId);
    paths.push(fromPathId);

    if (fromPathId === toPathId) {
      console.log(paths.join(' > '));
    } else {
      for (const event of Object.keys(adjacency[fromPathId])) {
        const nextStateValue = adjacency[fromPathId][event].state;

        if (!nextStateValue) {
          continue;
        }

        const nextStateId = trieToString(nextStateValue);

        if (!visited.has(nextStateId)) {
          util(nextStateId, toPathId);
        }
      }
    }

    paths.pop();
    visited.delete(fromPathId);
  }

  Object.keys(adjacency).forEach(stateId => {
    util(machine.initial as string, stateId);
  });
}
