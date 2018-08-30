import { StateNode, State } from './index';
import { toStateValue, getActionType, flatten } from './utils';
import {
  StateValue,
  Edge,
  Segment,
  PathMap,
  PathItem,
  PathsItem,
  PathsMap,
  AdjacencyMap,
  DefaultContext,
  ValueAdjacencyMap,
  Event
} from './types';

const EMPTY_MAP = {};

export function getNodes(node: StateNode): StateNode[] {
  const { states } = node;
  const nodes = Object.keys(states).reduce(
    (accNodes: StateNode[], stateKey) => {
      const subState = states[stateKey];
      const subNodes = getNodes(states[stateKey]);

      accNodes.push(subState, ...subNodes);
      return accNodes;
    },
    []
  );

  return nodes;
}

export function getEventEdges<TContext = DefaultContext>(
  node: StateNode<TContext>,
  event: string
): Array<Edge<TContext>> {
  const transitions = node.on[event]!;

  return flatten(
    transitions.map(transition => {
      const targets = transition.target
        ? ([] as string[]).concat(transition.target)
        : undefined;

      if (!targets) {
        return [
          {
            source: node,
            target: node,
            event,
            actions: transition.actions
              ? transition.actions.map(getActionType)
              : [],
            cond: transition.cond,
            transition
          }
        ];
      }

      return targets
        .map<Edge<TContext> | undefined>(target => {
          try {
            const targetNode = target
              ? node.getRelativeStateNodes(target, undefined, false)[0]
              : node;

            return {
              source: node,
              target: targetNode,
              event,
              actions: transition.actions
                ? transition.actions.map(getActionType)
                : [],
              cond: transition.cond,
              transition
            };
          } catch (e) {
            // tslint:disable-next-line:no-console
            console.warn(`Target '${target}' not found on '${node.id}'`);
            return undefined;
          }
        })
        .filter(maybeEdge => maybeEdge !== undefined) as Array<Edge<TContext>>;
    })
  );
}

export function getEdges<TContext = DefaultContext>(
  node: StateNode<TContext>,
  options?: { depth: null | number }
): Array<Edge<TContext>> {
  const { depth = null } = options || {};
  const edges: Array<Edge<TContext>> = [];

  if (node.states && depth === null) {
    Object.keys(node.states).forEach(stateKey => {
      edges.push(...getEdges<TContext>(node.states[stateKey]));
    });
  } else if (depth && depth > 0) {
    Object.keys(node.states).forEach(stateKey => {
      edges.push(
        ...getEdges<TContext>(node.states[stateKey], { depth: depth - 1 })
      );
    });
  }

  Object.keys(node.on).forEach(event => {
    edges.push(...getEventEdges<TContext>(node, event));
  });

  return edges;
}

export function getAdjacencyMap<TContext = DefaultContext>(
  node: StateNode<TContext>,
  extendedState?: any
): AdjacencyMap {
  const adjacency: AdjacencyMap = {};

  const events = node.events;

  function findAdjacencies(stateValue: StateValue) {
    const stateKey = JSON.stringify(stateValue);

    if (adjacency[stateKey]) {
      return;
    }

    adjacency[stateKey] = {};

    for (const event of events) {
      const nextState = node.transition(stateValue, event, extendedState);
      adjacency[stateKey][event] = { state: nextState.value };

      findAdjacencies(nextState.value);
    }
  }

  findAdjacencies(node.initialState.value);

  return adjacency;
}

function eventToString(event: Event): string {
  if (typeof event === 'string' || typeof event === 'number') {
    return `${event}`;
  }

  const { type, ...rest } = event;

  return `${type} | ${JSON.stringify(rest)}`;
}

export function getValueAdjacencyMap<TContext = DefaultContext>(
  node: StateNode<TContext>,
  eventMap: Record<string, Event[]>
): ValueAdjacencyMap {
  const adjacency: ValueAdjacencyMap = {};

  const events = flatten(node.events.map(event => eventMap[event] || [event]));

  function findAdjacencies(state: State<TContext>) {
    const { value, context } = state;
    const stateKey = JSON.stringify(value) + ' | ' + JSON.stringify(context);

    if (adjacency[stateKey]) {
      return;
    }

    adjacency[stateKey] = {};

    for (const event of events) {
      const nextState = node.transition(state, event);

      adjacency[stateKey][eventToString(event)] = {
        state: nextState.value,
        ext: nextState.context
      };

      findAdjacencies(nextState);
    }
  }

  findAdjacencies(node.initialState);

  return adjacency;
}

export function getShortestPaths<TContext = DefaultContext>(
  machine: StateNode<TContext>,
  extendedState?: any
): PathMap {
  if (!machine.states) {
    return EMPTY_MAP;
  }
  const adjacency = getAdjacencyMap(machine, extendedState);
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

export function getShortestPathsAsArray<TContext = DefaultContext>(
  machine: StateNode<TContext>,
  extendedState?: any
): PathItem[] {
  const result = getShortestPaths(machine, extendedState);
  return Object.keys(result).map(key => ({
    state: JSON.parse(key),
    path: result[key]
  }));
}

export function getSimplePaths<TContext = DefaultContext>(
  machine: StateNode<TContext>,
  extendedState?: any
): PathsMap {
  if (!machine.states) {
    return EMPTY_MAP;
  }

  const adjacency = getAdjacencyMap(machine, extendedState);
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

export function getSimplePathsAsArray<TContext = DefaultContext>(
  machine: StateNode<TContext>,
  extendedState?: any
): PathsItem[] {
  const result = getSimplePaths(machine, extendedState);
  return Object.keys(result).map(key => ({
    state: JSON.parse(key),
    paths: result[key]
  }));
}
