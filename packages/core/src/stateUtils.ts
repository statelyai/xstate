import { EventObject, StateNode, StateValue } from '.';
import { keys, flatten } from './utils';

type Configuration<
  TC,
  TE extends EventObject,
  TA extends { type: string }
> = Iterable<StateNode<TC, any, TE, any, TA>>;

type AdjList<TC, TE extends EventObject, TA extends { type: string }> = Map<
  StateNode<TC, any, TE, any, TA>,
  Array<StateNode<TC, any, TE, any, TA>>
>;

export const isLeafNode = (stateNode: StateNode<any, any, any, any, any>) =>
  stateNode.type === 'atomic' || stateNode.type === 'final';

export function getChildren<
  TC,
  TE extends EventObject,
  TA extends { type: string }
>(
  stateNode: StateNode<TC, any, TE, any, TA>
): Array<StateNode<TC, any, TE, any, TA>> {
  return keys(stateNode.states).map((key) => stateNode.states[key]);
}

export function getAllStateNodes<TC, TE extends EventObject>(
  stateNode: StateNode<TC, any, TE, any, any>
): Array<StateNode<TC, any, TE>> {
  const stateNodes = [stateNode];

  if (isLeafNode(stateNode)) {
    return stateNodes;
  }

  return stateNodes.concat(
    flatten(getChildren(stateNode).map(getAllStateNodes))
  );
}

export function getConfiguration<
  TC,
  TE extends EventObject,
  TA extends { type: string }
>(
  prevStateNodes: Iterable<StateNode<TC, any, TE, any, TA>>,
  stateNodes: Iterable<StateNode<TC, any, TE, any, TA>>
): Iterable<StateNode<TC, any, TE, any, TA>> {
  const prevConfiguration = new Set(prevStateNodes);
  const prevAdjList = getAdjList(prevConfiguration);

  const configuration = new Set(stateNodes);

  // add all ancestors
  for (const s of configuration) {
    let m = s.parent;

    while (m && !configuration.has(m)) {
      configuration.add(m);
      m = m.parent;
    }
  }

  const adjList = getAdjList(configuration);

  // add descendants
  for (const s of configuration) {
    // if previously active, add existing child nodes
    if (s.type === 'compound' && (!adjList.get(s) || !adjList.get(s)!.length)) {
      if (prevAdjList.get(s)) {
        prevAdjList.get(s)!.forEach((sn) => configuration.add(sn));
      } else {
        s.initialStateNodes.forEach((sn) => configuration.add(sn));
      }
    } else {
      if (s.type === 'parallel') {
        for (const child of getChildren(s)) {
          if (child.type === 'history') {
            continue;
          }

          if (!configuration.has(child)) {
            configuration.add(child);

            if (prevAdjList.get(child)) {
              prevAdjList.get(child)!.forEach((sn) => configuration.add(sn));
            } else {
              child.initialStateNodes.forEach((sn) => configuration.add(sn));
            }
          }
        }
      }
    }
  }

  // add all ancestors
  for (const s of configuration) {
    let m = s.parent;

    while (m && !configuration.has(m)) {
      configuration.add(m);
      m = m.parent;
    }
  }

  return configuration;
}

function getValueFromAdj<
  TC,
  TE extends EventObject,
  TA extends { type: string }
>(
  baseNode: StateNode<TC, any, TE, any, TA>,
  adjList: AdjList<TC, TE, TA>
): StateValue {
  const childStateNodes = adjList.get(baseNode);

  if (!childStateNodes) {
    return {}; // todo: fix?
  }

  if (baseNode.type === 'compound') {
    const childStateNode = childStateNodes[0];
    if (childStateNode) {
      if (isLeafNode(childStateNode)) {
        return childStateNode.key;
      }
    } else {
      return {};
    }
  }

  const stateValue = {};
  childStateNodes.forEach((csn) => {
    stateValue[csn.key] = getValueFromAdj(csn, adjList);
  });

  return stateValue;
}

export function getAdjList<
  TC,
  TE extends EventObject,
  TA extends { type: string }
>(configuration: Configuration<TC, TE, TA>): AdjList<TC, TE, TA> {
  const adjList: AdjList<TC, TE, TA> = new Map();

  for (const s of configuration) {
    if (!adjList.has(s)) {
      adjList.set(s, []);
    }

    if (s.parent) {
      if (!adjList.has(s.parent)) {
        adjList.set(s.parent, []);
      }

      adjList.get(s.parent)!.push(s);
    }
  }

  return adjList;
}

export function getValue<TC, TE extends EventObject>(
  rootNode: StateNode<TC, any, TE, any, any>,
  configuration: Configuration<TC, TE, any>
): StateValue {
  const config = getConfiguration([rootNode], configuration);

  return getValueFromAdj(rootNode, getAdjList(config));
}

export function has<T>(iterable: Iterable<T>, item: T): boolean {
  if (Array.isArray(iterable)) {
    return iterable.some((member) => member === item);
  }

  if (iterable instanceof Set) {
    return iterable.has(item);
  }

  return false; // TODO: fix
}

export function nextEvents<
  TC,
  TE extends EventObject,
  TA extends { type: string } = { type: string; [key: string]: any }
>(configuration: Array<StateNode<TC, any, TE, any, TA>>): Array<TE['type']> {
  return flatten([...new Set(configuration.map((sn) => sn.ownEvents))]);
}

export function isInFinalState<TC, TE extends EventObject>(
  configuration: Array<StateNode<TC, any, TE, any, any>>,
  stateNode: StateNode<TC, any, TE, any, any>
): boolean {
  if (stateNode.type === 'compound') {
    return getChildren(stateNode).some(
      (s) => s.type === 'final' && has(configuration, s)
    );
  }
  if (stateNode.type === 'parallel') {
    return getChildren(stateNode).every((sn) =>
      isInFinalState(configuration, sn)
    );
  }

  return false;
}
